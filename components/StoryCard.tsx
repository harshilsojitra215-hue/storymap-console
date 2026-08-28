"use client";

import { useState } from "react";
import Image from "next/image";
import type { Chapter } from "@/lib/types";

/** Matches the real aspect ratio every seed photo is cropped to server-side (see public/photos/). */
const IMAGE_WIDTH = 900;
const IMAGE_HEIGHT = 620;

type Props = {
  chapter: Chapter;
  /** The full list, in order — for the "Kapitel Navigation" pill and the next-chapter teaser. */
  chapters: Chapter[];
  language: "de" | "en";
  onLanguageChange: (lang: "de" | "en") => void;
  /** Same setter a chapter-list click and a scroll already use. */
  onSelectChapter: (id: string) => void;
};

const ListIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    aria-hidden="true"
    style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.2s ease" }}
  >
    <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * The floating story panel's content for one chapter, laid out the way the
 * real product does it: image bleeding to the card edges, title lifted over
 * its own fading gradient, everything else read on the teal. Every chapter in
 * ScrollingStoryPanel renders one of these — this component only knows about
 * the single chapter it was given plus the full list, for its own nav pill
 * and end-of-chapter teaser.
 */
export default function StoryCard({ chapter, chapters, language, onLanguageChange, onSelectChapter }: Props) {
  const [navOpen, setNavOpen] = useState(false);
  const body = language === "de" ? chapter.bodyDe : chapter.bodyEn;
  const index = chapters.findIndex((c) => c.id === chapter.id);
  const next = index >= 0 ? chapters[index + 1] : undefined;

  return (
    <article className="story-card">
      <div className="story-card-media">
        {chapter.imageUrl.trim() ? (
          <Image
            className="story-card-image"
            src={chapter.imageUrl}
            alt={chapter.imageAlt}
            width={IMAGE_WIDTH}
            height={IMAGE_HEIGHT}
            sizes="(max-width: 900px) 90vw, 420px"
            // The Image URL field is free text an editor can point anywhere, so the
            // fixed domain allowlist next/image normally enforces can't apply here.
            unoptimized
          />
        ) : (
          <div className="story-card-image story-card-image-empty" aria-hidden="true" />
        )}
        {/* The fade from photo to the card's own teal — the one gradient this
            design allows, since it exists to keep the title legible over
            whatever the photo happens to be, not to decorate a surface. */}
        <div className="story-card-scrim" aria-hidden="true" />

        <div className="story-card-heading">
          <span className="story-card-eyebrow">
            {index >= 0 ? `Chapter ${index + 1} of ${chapters.length}` : "Chapter"}
          </span>
          <h2 className="story-card-title">
            {chapter.title.trim() || <span className="placeholder-text">Untitled chapter</span>}
          </h2>
        </div>
      </div>

      <div className="story-card-body">
        <div className="story-card-controls">
          <button
            type="button"
            className="story-nav-pill"
            onClick={() => setNavOpen((v) => !v)}
            aria-expanded={navOpen}
          >
            <ListIcon />
            <span>Kapitel Navigation</span>
            <ChevronIcon open={navOpen} />
          </button>

          <div className="lang-toggle" role="group" aria-label="Preview language">
            {(["de", "en"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                className={language === lang ? "lang-btn is-active" : "lang-btn"}
                onClick={() => onLanguageChange(lang)}
                aria-pressed={language === lang}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {navOpen && (
          <nav className="story-nav-list" aria-label="Chapters">
            {chapters.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className={c.id === chapter.id ? "story-nav-item is-current" : "story-nav-item"}
                onClick={() => {
                  onSelectChapter(c.id);
                  setNavOpen(false);
                }}
                aria-current={c.id === chapter.id}
              >
                <span className="story-nav-item-index">{i + 1}</span>
                <span className="story-nav-item-name">
                  {c.title.trim() || <em className="placeholder-text">Untitled chapter</em>}
                </span>
              </button>
            ))}
          </nav>
        )}

        {body.trim() ? (
          <p className="story-card-text">{body}</p>
        ) : (
          <p className="story-card-text placeholder-text">
            {language === "de"
              ? "Kein deutscher Text für dieses Kapitel."
              : "No English text for this chapter."}
          </p>
        )}

        {next && (
          <button type="button" className="story-teaser" onClick={() => onSelectChapter(next.id)}>
            {next.imageUrl.trim() ? (
              <Image
                className="story-teaser-image"
                src={next.imageUrl}
                alt=""
                width={200}
                height={140}
                unoptimized
              />
            ) : (
              <span className="story-teaser-image story-card-image-empty" aria-hidden="true" />
            )}
            <span className="story-teaser-label">
              <span className="story-teaser-eyebrow">Next</span>
              <span className="story-teaser-title">
                {next.title.trim() || <em className="placeholder-text">Untitled chapter</em>}
              </span>
            </span>
            <span className="story-teaser-arrow" aria-hidden="true">
              <ArrowIcon />
            </span>
          </button>
        )}
      </div>
    </article>
  );
}
