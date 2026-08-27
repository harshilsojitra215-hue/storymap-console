"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type * as MapLibre from "maplibre-gl";

import seed from "@/data/chapters.json";
import type { Chapter, MapView, Metrics } from "@/lib/types";
import { EMPTY_METRICS } from "@/lib/types";
import { countBySeverity, evaluate, summarise } from "@/lib/rules";

import ChapterList from "@/components/ChapterList";
import ChapterForm from "@/components/ChapterForm";
import CheckerPanel from "@/components/CheckerPanel";
import MetricsPanel from "@/components/MetricsPanel";
import StoryCard from "@/components/StoryCard";

// MapLibre needs a real browser, so the preview never renders on the server.
const MapPreview = dynamic(() => import("@/components/MapPreview"), {
  ssr: false,
  loading: () => <div className="map-canvas map-loading">Loading map…</div>,
});

const round = (n: number, places: number) => Number(n.toFixed(places));

export default function Page() {
  const [chapters, setChapters] = useState<Chapter[]>(() =>
    structuredClone(seed as Chapter[]),
  );
  const [selectedId, setSelectedId] = useState<string>((seed as Chapter[])[0].id);
  const [metrics, setMetrics] = useState<Metrics>(EMPTY_METRICS);
  const [language, setLanguage] = useState<"de" | "en">("de");
  const [mapReady, setMapReady] = useState(false);
  const [usedFallbackStyle, setUsedFallbackStyle] = useState(false);
  /** Bumped by "Use this view" so the form drops any half-typed numbers. */
  const [captureCount, setCaptureCount] = useState(0);

  const mapRef = useRef<MapLibre.Map | null>(null);

  const selected = chapters.find((c) => c.id === selectedId) ?? chapters[0];
  const findings = useMemo(() => evaluate(selected), [selected]);

  const projectCounts = useMemo(() => {
    const all = chapters.flatMap((c) => evaluate(c));
    return countBySeverity(all);
  }, [chapters]);

  const recordEdit = useCallback((chapterId: string, field: string) => {
    setMetrics((m) => {
      const forChapter = { ...(m.perChapter[chapterId] ?? {}) };
      forChapter[field] = (forChapter[field] ?? 0) + 1;
      return {
        perChapter: { ...m.perChapter, [chapterId]: forChapter },
        totalEdits: m.totalEdits + 1,
        // The map, once created, is never rebuilt — so every edit after it exists
        // is an edit that cost no reload. Counted, not assumed.
        editsSinceMapCreated: mapRef.current
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

  const handleMapReady = useCallback((map: MapLibre.Map) => {
    mapRef.current = map;
    setMapReady(true);
  }, []);

  const handleStyleFallback = useCallback(() => setUsedFallbackStyle(true), []);

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1 className="app-title">Storymap Editor Console</h1>
          <p className="app-subtitle">
            Edit and see, in one screen, with no reload between the two.
          </p>
        </div>
        <div className="topbar-status">
          <span className="topbar-status-label">Across {chapters.length} chapters</span>
          <span
            className={
              projectCounts.blocker > 0 ? "topbar-status-value has-blocker" : "topbar-status-value"
            }
          >
            {summarise(chapters.flatMap((c) => evaluate(c)))}
          </span>
        </div>
      </header>

      <div className="split">
        <section className="pane pane-left" aria-label="Editor">
          <ChapterList chapters={chapters} selectedId={selectedId} onSelect={setSelectedId} />

          <ChapterForm
            chapter={selected}
            onTextChange={handleTextChange}
            onViewChange={handleViewChange}
            onUseThisView={handleUseThisView}
            mapReady={mapReady}
            resetKey={`${selectedId}:${captureCount}`}
          />

          <CheckerPanel findings={findings} />

          <MetricsPanel metrics={metrics} chapter={selected} />

          <footer className="disclaimer">
            Unaffiliated prototype, built in response to a public challenge brief. No client
            code, CMS, content or branding is used. Text and imagery here are invented;
            coordinates are approximate and public.
          </footer>
        </section>

        <section className="pane pane-right" aria-label="Live preview">
          <MapPreview
            view={selected.view}
            chapterId={selected.id}
            onMapReady={handleMapReady}
            onStyleFallback={handleStyleFallback}
          />
          <StoryCard chapter={selected} language={language} onLanguageChange={setLanguage} />
          {usedFallbackStyle && (
            <p className="style-note">
              OpenFreeMap was unreachable — showing the MapLibre demo style instead. 3D
              buildings are unavailable on that style.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
