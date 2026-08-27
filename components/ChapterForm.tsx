"use client";

import { useEffect, useState } from "react";
import type { Chapter, MapView } from "@/lib/types";

type TextField = "title" | "bodyDe" | "bodyEn" | "imageUrl" | "imageAlt";

type Props = {
  chapter: Chapter;
  onTextChange: (field: TextField, value: string) => void;
  onViewChange: (field: keyof MapView, value: number) => void;
  onUseThisView: () => void;
  mapReady: boolean;
  /** Changes whenever the fields are replaced from outside, e.g. by "Use this view". */
  resetKey: string;
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
  onUseThisView,
  mapReady,
  resetKey,
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
            className="primary-btn"
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
            <label className="field field-number" key={key}>
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
    </div>
  );
}
