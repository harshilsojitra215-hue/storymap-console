"use client";

import { useEffect, useRef, useState } from "react";
import type { Chapter, MapView } from "@/lib/types";
import { LAYER_DEFINITIONS, type LayerId } from "@/lib/layers";

type TextField = "title" | "bodyDe" | "bodyEn" | "imageUrl" | "imageAlt";

type Props = {
  chapter: Chapter;
  onTextChange: (field: TextField, value: string) => void;
  onViewChange: (field: keyof MapView, value: number) => void;
  onLayerToggle: (id: LayerId, visible: boolean) => void;
  onUseThisView: () => void;
  mapReady: boolean;
  /** Changes whenever the fields are replaced from outside, e.g. by "Use this view". */
  resetKey: string;
  /** Bumped only by "Use this view" (unlike resetKey, unaffected by switching
   *  chapters) — the one signal that means "the five fields below just got
   *  written from the map," not "a different chapter's own numbers loaded." */
  captureCount: number;
  /** True until "Use this view" has been used once, ever — see StorymapConsole. */
  emphasizeUseThisView: boolean;
};

const VIEW_FIELDS: { key: keyof MapView; label: string; step: number; hint: string }[] = [
  { key: "lat", label: "Centre latitude", step: 0.0001, hint: "47 to 55 in Germany" },
  { key: "lon", label: "Centre longitude", step: 0.0001, hint: "5.5 to 15.5 in Germany" },
  { key: "zoom", label: "Zoom", step: 0.1, hint: "6 to 18 is usable" },
  { key: "pitch", label: "Pitch", step: 1, hint: "0 flat, 85 max" },
  { key: "bearing", label: "Bearing", step: 1, hint: "0 is north" },
];

export default function ChapterForm({
  chapter,
  onTextChange,
  onViewChange,
  onLayerToggle,
  onUseThisView,
  mapReady,
  resetKey,
  captureCount,
  emphasizeUseThisView,
}: Props) {
  /**
   * Number inputs keep whatever the person has literally typed until it parses.
   * Without this, typing "-" or "8." in a latitude field snaps back the instant
   * the character lands, and the field becomes unusable.
   */
  const [drafts, setDrafts] = useState<Partial<Record<keyof MapView, string>>>({});

  useEffect(() => {
    setDrafts({});
  }, [resetKey]);

  /**
   * True for one brief window right after "Use this view" writes new numbers
   * in, so the five fields below can flash to show the eye where to look.
   * Keyed off captureCount specifically (not resetKey, which also changes on
   * a plain chapter switch) — a switch should not replay this, only an
   * actual capture should. The ref starts at the same value captureCount
   * already has, so the very first render (mount) never fires it.
   */
  const [justCapturedFor, setJustCapturedFor] = useState<string | null>(null);
  const prevCaptureCount = useRef(captureCount);

  useEffect(() => {
    if (captureCount === prevCaptureCount.current) return;
    prevCaptureCount.current = captureCount;
    // Recorded against the chapter it happened on — this form doesn't remount
    // on a chapter switch, so a flash started here and still in flight when
    // someone clicks a different chapter would otherwise keep playing on
    // that chapter's completely unrelated numbers.
    setJustCapturedFor(chapter.id);
    const timer = setTimeout(() => setJustCapturedFor(null), 500);
    return () => clearTimeout(timer);
  }, [captureCount, chapter.id]);

  const justCaptured = justCapturedFor === chapter.id;

  const handleNumber = (key: keyof MapView, raw: string) => {
    setDrafts((d) => ({ ...d, [key]: raw }));
    const parsed = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(parsed)) onViewChange(key, parsed);
  };

  return (
    <div className="form">
      <label className="field">
        <span className="field-label">Chapter title</span>
        <input
          type="text"
          value={chapter.title}
          onChange={(e) => onTextChange("title", e.target.value)}
          placeholder="e.g. Frankfurt Hauptbahnhof"
        />
      </label>

      <label className="field">
        <span className="field-label">Body text (German)</span>
        <textarea
          rows={4}
          value={chapter.bodyDe}
          onChange={(e) => onTextChange("bodyDe", e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">Body text (English)</span>
        <textarea
          rows={4}
          value={chapter.bodyEn}
          onChange={(e) => onTextChange("bodyEn", e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">Image URL</span>
        <input
          type="text"
          value={chapter.imageUrl}
          onChange={(e) => onTextChange("imageUrl", e.target.value)}
          placeholder="/placeholders/example.svg"
        />
      </label>

      <label className="field">
        <span className="field-label">Image alt text</span>
        <input
          type="text"
          value={chapter.imageAlt}
          onChange={(e) => onTextChange("imageAlt", e.target.value)}
          placeholder="What the image shows, for screen readers"
        />
      </label>

      <section className="view-block">
        <div className="view-head">
          <h3 className="view-title">Map view</h3>
          <button
            type="button"
            className={emphasizeUseThisView ? "primary-btn is-emphasized" : "primary-btn"}
            onClick={onUseThisView}
            disabled={!mapReady}
            title="Write the map's current camera into these five fields"
          >
            Use this view
          </button>
        </div>
        <p className="view-explainer">
          Drag, zoom, tilt and rotate the map until the shot is right, then take the numbers
          from it instead of guessing them.
        </p>

        <div className="view-grid">
          {VIEW_FIELDS.map(({ key, label, step, hint }) => (
            <label
              className={justCaptured ? "field field-number field-captured" : "field field-number"}
              key={key}
            >
              <span className="field-label">{label}</span>
              <input
                type="number"
                step={step}
                value={drafts[key] ?? String(chapter.view[key])}
                onChange={(e) => handleNumber(key, e.target.value)}
                onBlur={() => setDrafts((d) => ({ ...d, [key]: undefined }))}
              />
              <span className="field-hint">{hint}</span>
            </label>
          ))}
        </div>

        <p className={chapter.viewCaptured ? "capture-note is-set" : "capture-note"}>
          {chapter.viewCaptured
            ? "View captured from the map."
            : "No view captured yet — these are seed numbers nobody has looked at."}
        </p>
      </section>

      <section className="layers-block">
        <h3 className="view-title">Layers</h3>
        <p className="view-explainer">
          What this chapter shows on top of the base map.
        </p>
        <ul className="layer-list">
          {LAYER_DEFINITIONS.map((layer) => (
            <li key={layer.id}>
              {/* The whole row is one label, hint text included, so the tap
                  target is the full row width rather than just the checkbox
                  and its short caption next to it. */}
              <label className="layer-row">
                <span className="layer-toggle">
                  <input
                    type="checkbox"
                    checked={chapter.layers.includes(layer.id)}
                    onChange={(e) => onLayerToggle(layer.id, e.target.checked)}
                  />
                  <span className="layer-label">{layer.label}</span>
                </span>
                <span className="field-hint">{layer.hint}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
