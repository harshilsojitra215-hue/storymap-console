"use client";

import { useState } from "react";
import type { Chapter, Metrics } from "@/lib/types";

type Props = {
  metrics: Metrics;
  chapter: Chapter;
};

const FIELD_LABELS: Record<string, string> = {
  title: "Chapter title",
  bodyDe: "Body text (German)",
  bodyEn: "Body text (English)",
  imageUrl: "Image URL",
  imageAlt: "Image alt text",
  lat: "Centre latitude",
  lon: "Centre longitude",
  zoom: "Zoom",
  pitch: "Pitch",
  bearing: "Bearing",
  useThisView: "Use this view",
};

/**
 * The field somebody edits over and over is the field causing them trouble.
 * Counting edits is how you find the real error list instead of guessing it —
 * and how you would later prove five hours actually became thirty minutes.
 */
export default function MetricsPanel({ metrics, chapter }: Props) {
  const [open, setOpen] = useState(false);
  const perField = metrics.perChapter[chapter.id] ?? {};
  const rows = Object.entries(perField).sort((a, b) => b[1] - a[1]);

  return (
    <section className="metrics">
      <div className="metrics-header">
        <span className="metrics-label">Measurement</span>
        {/* The most persuasive number in the project, shown by default rather
            than behind a click — the honest edit count and the fact that
            none of it cost a reload are the whole argument, not a detail. */}
        <dl className="metrics-figures">
          <div>
            <dt>Total edits this session</dt>
            <dd>{metrics.totalEdits}</dd>
          </div>
          <div>
            <dt>Edits made without reloading the preview</dt>
            <dd>{metrics.editsSinceMapCreated}</dd>
          </div>
        </dl>
      </div>

      <button
        type="button"
        className="metrics-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>Edits per field</span>
        <span className="chevron" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="metrics-body">
          <h3 className="metrics-subtitle">
            Edits per field — {chapter.title.trim() || "untitled chapter"}
          </h3>
          {rows.length === 0 ? (
            <p className="metrics-empty">Nothing edited in this chapter yet.</p>
          ) : (
            <ul className="metrics-rows">
              {rows.map(([field, count]) => (
                <li key={field}>
                  <span className="metrics-field">{FIELD_LABELS[field] ?? field}</span>
                  <span className="metrics-bar" aria-hidden="true">
                    <span
                      className="metrics-bar-fill"
                      style={{ width: `${Math.min(100, (count / rows[0][1]) * 100)}%` }}
                    />
                  </span>
                  <span className="metrics-count">{count}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="metrics-note">
            No time-saved figure is shown, because this prototype has not measured one. The
            honest number here is the edit count and the fact that none of them cost a reload.
          </p>
        </div>
      )}
    </section>
  );
}
