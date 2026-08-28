"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type * as MapLibre from "maplibre-gl";

import type { Chapter, MapView, Metrics } from "@/lib/types";
import { EMPTY_CHAPTER, EMPTY_METRICS } from "@/lib/types";
import { countBySeverity, evaluateCached, evaluateProject, summarise } from "@/lib/rules";
import { useDebouncedPreview } from "@/lib/useDebouncedPreview";
import type { LayerId } from "@/lib/layers";

import ChapterList from "@/components/ChapterList";
import MapPlaceholder from "@/components/MapPlaceholder";
import ChapterForm from "@/components/ChapterForm";
import CheckerPanel from "@/components/CheckerPanel";
import MetricsPanel from "@/components/MetricsPanel";
import ScrollingStoryPanel from "@/components/ScrollingStoryPanel";

/** How long the story card lags behind typing. Camera and checker are never debounced. */
const PREVIEW_DEBOUNCE_MS = 120;

// MapLibre needs a real browser, so the preview never renders on the server. It is
// also a large download, and loading it separately is what lets the editor, the
// panels and the story card paint immediately instead of waiting on the map.
const MapPreview = dynamic(() => import("@/components/MapPreview"), {
  ssr: false,
  loading: () => <MapPlaceholder />,
});

const round = (n: number, places: number) => Number(n.toFixed(places));

type Props = {
  /**
   * Loaded server-side through the GraphQL schema in lib/graphql/schema.ts —
   * see app/page.tsx — not imported from the JSON file directly. Everything
   * after this line is local React state; edits are not written back anywhere.
   */
  initialChapters: Chapter[];
  /** Set only if the server-side query itself failed. Chapters may still be []. */
  loadError?: string;
};

export default function StorymapConsole({ initialChapters, loadError }: Props) {
  const [chapters, setChapters] = useState<Chapter[]>(() => structuredClone(initialChapters));
  const [selectedId, setSelectedId] = useState<string>(initialChapters[0]?.id ?? "");
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [language, setLanguage] = useState<"de" | "en">("de");
  const [mapReady, setMapReady] = useState(false);
  /** Bumped by "Use this view" so the form drops any half-typed numbers. */
  const [captureCount, setCaptureCount] = useState(0);
  /** The floating story panel's own top-right "close" button hides it; the
   *  map furniture's bottom-left button (and reselecting a chapter) brings it back. */
  const [storyVisible, setStoryVisible] = useState(true);

  const mapRef = useRef<MapLibre.Map | null>(null);
  /** True once the map instance exists — which it does for the rest of the session. */
  const mapExistsRef = useRef(false);

  const selected = chapters.find((c) => c.id === selectedId) ?? chapters[0];
  const findings = useMemo(() => (selected ? evaluateCached(selected) : []), [selected]);

  // Project-wide findings — "a layer no chapter shows" — can't be pinned to any
  // one chapter, so they are computed once here and folded into the header
  // total alongside every chapter's own findings.
  const projectFindings = useMemo(() => evaluateProject(chapters), [chapters]);

  // Computed once and reused for both the header count and the summary line,
  // rather than walking every chapter's rules twice per render.
  const allFindings = useMemo(
    () => [...chapters.flatMap(evaluateCached), ...projectFindings],
    [chapters, projectFindings],
  );
  const projectCounts = useMemo(() => countBySeverity(allFindings), [allFindings]);
  const projectSummary = useMemo(() => summarise(allFindings), [allFindings]);

  const previewChapter = useDebouncedPreview(selected ?? EMPTY_CHAPTER, PREVIEW_DEBOUNCE_MS);

  const recordEdit = useCallback((chapterId: string, field: string) => {
    setMetrics((m) => {
      const forChapter = { ...(m.perChapter[chapterId] ?? {}) };
      forChapter[field] = (forChapter[field] ?? 0) + 1;
      return {
        perChapter: { ...m.perChapter, [chapterId]: forChapter },
        totalEdits: m.totalEdits + 1,
        // The map, once created, is never rebuilt — so every edit after it exists
        // is an edit that cost no reload. Counted, not assumed.
        editsSinceMapCreated: mapExistsRef.current
          ? m.editsSinceMapCreated + 1
          : m.editsSinceMapCreated,
      };
    });
  }, []);

  const patchSelected = useCallback(
    (patch: Partial<Chapter>) => {
      setChapters((list) =>
        list.map((c) => (c.id === selectedId ? { ...c, ...patch } : c)),
      );
    },
    [selectedId],
  );

  const handleTextChange = useCallback(
    (field: "title" | "bodyDe" | "bodyEn" | "imageUrl" | "imageAlt", value: string) => {
      patchSelected({ [field]: value });
      recordEdit(selectedId, field);
    },
    [patchSelected, recordEdit, selectedId],
  );

  const handleViewChange = useCallback(
    (field: keyof MapView, value: number) => {
      setChapters((list) =>
        list.map((c) =>
          c.id === selectedId ? { ...c, view: { ...c.view, [field]: value } } : c,
        ),
      );
      recordEdit(selectedId, field);
    },
    [recordEdit, selectedId],
  );

  const handleLayerToggle = useCallback(
    (id: LayerId, visible: boolean) => {
      setChapters((list) =>
        list.map((c) =>
          c.id !== selectedId
            ? c
            : {
                ...c,
                layers: visible ? [...c.layers, id] : c.layers.filter((l) => l !== id),
              },
        ),
      );
      recordEdit(selectedId, `layer:${id}`);
    },
    [recordEdit, selectedId],
  );

  /**
   * The headline feature. Instead of guessing five numbers, look at the map,
   * get it right by hand, and take the numbers off it.
   */
  const handleUseThisView = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const centre = map.getCenter();
    patchSelected({
      view: {
        lat: round(centre.lat, 5),
        lon: round(centre.lng, 5),
        zoom: round(map.getZoom(), 2),
        pitch: round(map.getPitch(), 2),
        bearing: round(map.getBearing(), 2),
      },
      viewCaptured: true,
    });
    recordEdit(selectedId, "useThisView");
    setCaptureCount((n) => n + 1);
  }, [patchSelected, recordEdit, selectedId]);

  const handleMapCreated = useCallback(() => {
    mapExistsRef.current = true;
  }, []);

  const handleMapReady = useCallback((map: MapLibre.Map) => {
    mapRef.current = map;
    setMapReady(true);
  }, []);

  const selectedIndex = chapters.findIndex((c) => c.id === selectedId);

  const handleStoryBack = useCallback(() => {
    if (selectedIndex > 0) setSelectedId(chapters[selectedIndex - 1].id);
  }, [chapters, selectedIndex]);

  const handleStoryClose = useCallback(() => setStoryVisible(false), []);
  const handleOpenChapterList = useCallback(() => setStoryVisible(true), []);

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <div className="wordmark">
            <h1 className="wordmark-mark">Storymap Editor Console</h1>
            <span className="wordmark-tag">Prototype</span>
          </div>
          <p className="app-subtitle">
            Edit and see, in one screen, with no reload between the two.
          </p>
          <p className="app-strapline">
            Internal editing tool. The public page is Storymap itself, this is the workspace an
            editor uses to build one.
          </p>
        </div>
        <div className="topbar-status">
          <span className="topbar-status-label">Across {chapters.length} chapters</span>
          <span
            className={
              projectCounts.blocker > 0 ? "topbar-status-value has-blocker" : "topbar-status-value"
            }
          >
            {chapters.length > 0 ? projectSummary : "—"}
          </span>
        </div>
      </header>

      {loadError && (
        <p className="data-error-banner" role="alert">
          Chapters could not be loaded from the GraphQL API ({loadError}). Showing an empty
          workspace instead of a broken one.
        </p>
      )}

      <div className="split">
        <section className="pane pane-left" aria-label="Editor">
          <p className="pane-header">Editor</p>

          {chapters.length === 0 || !selected ? (
            <p className="empty-state">
              No chapters available. Add a chapter to <code>data/chapters.json</code> and reload.
            </p>
          ) : (
            <>
              <ChapterList chapters={chapters} selectedId={selectedId} onSelect={setSelectedId} />

              <ChapterForm
                chapter={selected}
                onTextChange={handleTextChange}
                onViewChange={handleViewChange}
                onLayerToggle={handleLayerToggle}
                onUseThisView={handleUseThisView}
                mapReady={mapReady}
                resetKey={`${selectedId}:${captureCount}`}
              />

              <CheckerPanel findings={findings} projectFindings={projectFindings} />

              <MetricsPanel metrics={metrics} chapter={selected} />
            </>
          )}

          <footer className="disclaimer">
            <p>
              Unaffiliated prototype, built in response to a public challenge brief. No client
              code, CMS, content or branding is used. Text is invented; coordinates are
              approximate and public. Photographs are real and credited below.
            </p>
            <p>
              Independent prototype built in response to the public Challenge #2 brief. Not
              affiliated with die wegmeister GmbH.
            </p>
            <details className="photo-credits">
              <summary>Photograph credits</summary>
              <ul>
                <li>
                  Station facade — Megalogiannis,{" "}
                  <a
                    href="https://commons.wikimedia.org/wiki/File:Frankfurt_(Main)_Hauptbahnhof_facade.jpg"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Wikimedia Commons
                  </a>
                  , CC BY-SA 4.0
                </li>
                <li>
                  Platform hall — MHM55,{" "}
                  <a
                    href="https://commons.wikimedia.org/wiki/File:Platform_hall-Frankfurt_(Main)_Hauptbahnhof-06.jpg"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Wikimedia Commons
                  </a>
                  , CC BY-SA 4.0
                </li>
                <li>
                  Station exterior — Jonashtand,{" "}
                  <a
                    href="https://commons.wikimedia.org/wiki/File:202206_Frankfurt_(Main)_Hauptbahnhof_02.jpg"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Wikimedia Commons
                  </a>
                  , CC BY-SA 4.0
                </li>
                <li>
                  Frankfurt Süd sign — GeorgDerReisende,{" "}
                  <a
                    href="https://commons.wikimedia.org/wiki/File:Bahnhof_Frankfurt_(Main)_S%C3%BCd,_1,_Sachsenhausen,_Frankfurt_am_Main.jpg"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Wikimedia Commons
                  </a>
                  , CC BY-SA 4.0
                </li>
              </ul>
            </details>
          </footer>
        </section>

        <section className="pane pane-right" aria-label="Live preview">
          <p className="pane-header pane-header-floating">Live preview of the published page</p>
          {selected && (
            <>
              <MapPreview
                view={selected.view}
                chapterId={selected.id}
                layers={selected.layers}
                onMapCreated={handleMapCreated}
                onMapReady={handleMapReady}
                onOpenChapterList={handleOpenChapterList}
              />

              {storyVisible && (
                <>
                  <button
                    type="button"
                    className="story-corner-btn story-corner-back"
                    onClick={handleStoryBack}
                    disabled={selectedIndex <= 0}
                    aria-label="Previous chapter"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="story-corner-btn story-corner-close"
                    onClick={handleStoryClose}
                    aria-label="Close story panel"
                  >
                    ×
                  </button>
                </>
              )}

              <ScrollingStoryPanel
                chapters={chapters}
                selectedId={selectedId}
                previewChapter={previewChapter}
                onSelectedChange={setSelectedId}
                language={language}
                onLanguageChange={setLanguage}
                visible={storyVisible}
              />
            </>
          )}
          <p className="preview-scope-note">
            Preview reproduces only enough of the published page to demonstrate the editing loop.
            {selected?.layers.includes("route") &&
              " The route line shown is illustrative, not real project geometry."}
          </p>
        </section>
      </div>
    </main>
  );
}
