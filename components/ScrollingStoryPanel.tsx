"use client";

import { useEffect, useRef } from "react";
import type { Chapter } from "@/lib/types";
import StoryCard from "@/components/StoryCard";

type Props = {
  chapters: Chapter[];
  selectedId: string;
  /**
   * The debounced version of whichever chapter currently matches `selectedId`
   * (see lib/useDebouncedPreview.ts). Every other section renders its chapter
   * straight from `chapters`, since nothing is ever being typed into it —
   * debouncing exists only to smooth the card someone is actively editing.
   */
  previewChapter: Chapter;
  /** The same setter that ChapterList's clicks already use — one selection, two ways to move it. */
  onSelectedChange: (id: string) => void;
  language: "de" | "en";
  onLanguageChange: (lang: "de" | "en") => void;
  /**
   * False while the panel's own top-right "close" button has hidden it. Kept
   * mounted rather than unrendered — display:none only — so scroll position,
   * the observer's refs and which chapter is centred all survive a close and
   * reopen instead of resetting to the top.
   */
  visible: boolean;
};

/**
 * The right-hand pane's real scroll surface: every chapter stacked as its own
 * card in one continuous scroll, the way the published page itself works. An
 * IntersectionObserver watches which card sits across the middle of this
 * panel and reports it as `selectedId` — the exact state ChapterList's clicks
 * already drive, so the map's existing chapter-change effect flies the camera
 * with no new code, whichever way the selection changed.
 */
export default function ScrollingStoryPanel({
  chapters,
  selectedId,
  previewChapter,
  onSelectedChange,
  language,
  onLanguageChange,
  visible,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef(new Map<string, HTMLDivElement>());
  /**
   * The id this panel itself last reported outward. Tells "the user scrolled,
   * so tell the parent" apart from "the parent's selectedId changed some other
   * way (a chapter-list click), so scroll to match" — without this split, each
   * side reacting to the other would bounce indefinitely.
   */
  const lastObservedIdRef = useRef(selectedId);
  /**
   * True while a click-triggered `scrollIntoView` animation is in flight. A
   * smooth scroll spends its middle frames with the OUTGOING card still
   * inside the centre band and the incoming one not there yet — read naively,
   * that looks like "the old chapter is selected again" and reverts the very
   * change the click just made. Ignoring the observer for the animation's
   * duration is what keeps a click-then-settle from bouncing back.
   */
  const suppressObserverRef = useRef(false);
  /**
   * Every chapter's most recently reported overlap with the centre band (see
   * below), kept up to date across callbacks rather than read fresh from
   * whatever this one callback happened to include.
   *
   * `threshold: 0` alone is not enough here: it only fires when a card crosses
   * the band's edge, not while its overlap keeps growing afterwards. With
   * roomy cards, TWO neighbours can both have a sliver of overlap at once —
   * the tail of the outgoing card and the head of the incoming one — and if
   * the outgoing sliver never actually drops to zero (it just keeps SHRINKING
   * as the ratio-only-grows case for the incoming card plays out), no further
   * callback ever arrives to say "the other one is bigger now". Tracking
   * every card's ratio and always picking the largest is what actually
   * answers "which one is genuinely dominant right now".
   */
  const ratiosRef = useRef(new Map<string, number>());
  /**
   * False until the panel has actually been scrolled at least once — by wheel,
   * touch, or the click-driven scrollIntoView below.
   *
   * The FIRST chapter's card is tall enough, on some viewport heights, that at
   * rest (scrollTop 0) its overlap with the centre band is a hair smaller than
   * the second card's own leading sliver — a real measurement, not a bug in
   * the ratio math, just an ambiguous one. Without this guard the observer's
   * very first callback (which fires as soon as observation starts, before
   * any user action) could "correct" the selection away from the first
   * chapter before the page has even finished settling. Gating on a real
   * scroll having happened at least once means the deliberate initial
   * selection is never overridden by geometry alone.
   */
  const hasScrolledRef = useRef(false);
  /**
   * Until this timestamp (Date.now()-based), the observer's own callback
   * ignores whatever it sees. Set whenever focus lands inside the panel:
   * every chapter's controls stay mounted (display:none only), so Tab can
   * reach an off-screen card's button and the browser auto-scrolls it into
   * view as a side effect of focusing — that scroll is keyboard navigation,
   * not a "switch chapters" gesture, and must not reassign selectedId or
   * refly the map out from under someone tabbing through controls. A time
   * window rather than a boolean because it must coexist with (never get
   * cut short by) the click-driven suppressObserverRef below, which uses its
   * own release/lifetime — a shared boolean would let one path's release
   * cancel the other's.
   */
  const focusSuppressUntilRef = useRef(0);

  /**
   * Where the panel is actually scrolled to, measured fresh off the DOM
   * rather than trusted from ratiosRef's cache. ratiosRef is only ever
   * updated inside the IntersectionObserver's own (async, browser-scheduled)
   * callback — reading it right after a scroll completes can still hold
   * pre-scroll values if that callback hasn't run yet, which is exactly what
   * let an instant (prefers-reduced-motion) scrollIntoView revert the very
   * selection it had just made: scrollend fired, the stale cache still said
   * the OLD card was centred, and that got committed straight back.
   * Measuring live sidesteps the race instead of trying to win it.
   */
  const computeCenteredId = (): string | null => {
    const container = containerRef.current;
    if (!container) return null;
    const centerY = container.getBoundingClientRect().top + container.clientHeight / 2;
    let bestId: string | null = null;
    let bestDistance = Infinity;
    sectionRefs.current.forEach((el, id) => {
      const rect = el.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - centerY);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = id;
      }
    });
    return bestId;
  };

  /**
   * Reads ratiosRef and, if a card other than the last-reported one is now
   * the strongest candidate, commits it. This is the observer callback's own
   * commit path — driven by live intersection data as it arrives, so no
   * staleness risk there. (The click-driven effect below settles via
   * computeCenteredId instead, for the reason explained on that function.)
   */
  const commitBestCandidate = () => {
    let bestId: string | null = null;
    let bestRatio = 0;
    ratiosRef.current.forEach((ratio, id) => {
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestId = id;
      }
    });
    if (!bestId || bestId === lastObservedIdRef.current) return;
    lastObservedIdRef.current = bestId;
    onSelectedChange(bestId);
  };

  // Set up once. The set of chapters (and therefore the set of sections) is
  // fixed for the life of this session — nothing here adds or removes a
  // chapter — so there is no need to tear the observer down and rebuild it on
  // every keystroke a chapter object reference change would otherwise imply.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const markScrolled = () => {
      hasScrolledRef.current = true;
    };
    container.addEventListener("scroll", markScrolled, { once: true, passive: true });

    // See focusSuppressUntilRef above: a Tab landing on an off-screen card's
    // control auto-scrolls it into view, and that must not read as "the user
    // scrolled to switch chapters."
    const handleFocusIn = () => {
      focusSuppressUntilRef.current = Date.now() + 300;
    };
    container.addEventListener("focusin", handleFocusIn);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-chapter-id");
          if (id) ratiosRef.current.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
        }
        if (
          suppressObserverRef.current ||
          !hasScrolledRef.current ||
          Date.now() < focusSuppressUntilRef.current
        )
          return;
        commitBestCandidate();
      },
      // A band around the panel's own vertical middle, not its edges: a card
      // only counts as selected once it crosses the centre. Narrower flickers
      // between neighbours right at the boundary (each flicker would fire
      // another camera flyTo); wider lets two cards claim the centre at once.
      // The fine-grained threshold list is what keeps ratiosRef genuinely
      // current as a card's overlap grows or shrinks, not just at the two
      // instants it enters or leaves the band.
      {
        root: container,
        rootMargin: "-40% 0px -40% 0px",
        threshold: Array.from({ length: 21 }, (_, i) => i / 20),
      },
    );

    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", markScrolled);
      container.removeEventListener("focusin", handleFocusIn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A selectedId change that did NOT come from this panel's own observer —
  // a click over in the editor's chapter list — scrolls the matching card
  // into view, so the list and the preview never point at two chapters.
  useEffect(() => {
    if (selectedId === lastObservedIdRef.current) return;
    lastObservedIdRef.current = selectedId;

    const container = containerRef.current;
    const target = sectionRefs.current.get(selectedId);
    if (!container || !target) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    suppressObserverRef.current = true;
    const release = () => {
      suppressObserverRef.current = false;
      container.removeEventListener("scrollend", release);
      // Re-check what's actually centred now, rather than trusting that the
      // click's own target is still what settled — a scrollbar drag or
      // another click landing mid-animation can leave a DIFFERENT card
      // centred by the time this fires, and nothing else will correct it.
      // Measured live (see computeCenteredId) rather than via
      // commitBestCandidate's ratiosRef cache, which is only updated by the
      // observer's own async callback and can still hold pre-scroll values
      // at this exact instant — trusting it here was what let an instant
      // (prefers-reduced-motion) scroll revert itself.
      const centeredId = computeCenteredId();
      if (centeredId && centeredId !== lastObservedIdRef.current) {
        lastObservedIdRef.current = centeredId;
        onSelectedChange(centeredId);
      }
    };
    container.addEventListener("scrollend", release);
    // Belt-and-braces: if the browser never fires scrollend for this scroll
    // (e.g. the target was already at rest, so there is nothing to animate),
    // don't leave the observer suppressed indefinitely.
    const fallback = setTimeout(release, 1200);

    // "center", to match both the CSS scroll-snap point (see .story-panel-item)
    // and the observer's own centre-band — all three need to agree on what
    // "this chapter is selected" looks like as a scroll position.
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });

    return () => {
      clearTimeout(fallback);
      container.removeEventListener("scrollend", release);
    };
  }, [selectedId]);

  return (
    <div ref={containerRef} className={visible ? "story-panel" : "story-panel is-hidden"}>
      {chapters.map((chapter) => (
        <div
          key={chapter.id}
          ref={(el) => {
            if (el) sectionRefs.current.set(chapter.id, el);
            else sectionRefs.current.delete(chapter.id);
          }}
          className="story-panel-item"
          data-chapter-id={chapter.id}
        >
          <StoryCard
            chapter={chapter.id === previewChapter.id ? previewChapter : chapter}
            chapters={chapters}
            language={language}
            onLanguageChange={onLanguageChange}
            onSelectChapter={onSelectedChange}
          />
        </div>
      ))}
    </div>
  );
}
