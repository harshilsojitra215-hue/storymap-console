"use client";

import type { Chapter } from "@/lib/types";
import { countBySeverity, evaluate } from "@/lib/rules";

type Props = {
  chapters: Chapter[];
  selectedId: string;
  onSelect: (id: string) => void;
};

/**
 * Every chapter carries its own status dot, so a broken chapter is visible before
 * anyone clicks into it. That is the difference between finding an error and
 * happening to open the page it is on.
 */
export default function ChapterList({ chapters, selectedId, onSelect }: Props) {
  return (
    <nav className="chapter-list" aria-label="Story chapters">
      {chapters.map((chapter, index) => {
        const counts = countBySeverity(evaluate(chapter));
        const status = counts.blocker > 0 ? "blocker" : counts.warning > 0 ? "warning" : "clean";
        const issues = counts.blocker + counts.warning + counts.suggestion;

        return (
          <button
            key={chapter.id}
            type="button"
            className={chapter.id === selectedId ? "chapter-item is-selected" : "chapter-item"}
            onClick={() => onSelect(chapter.id)}
            aria-current={chapter.id === selectedId}
          >
            <span className="chapter-index">{index + 1}</span>
            <span className="chapter-name">
              {chapter.title.trim() || <em className="placeholder-text">Untitled chapter</em>}
            </span>
            <span
              className={`status-dot status-${status}`}
              title={issues === 0 ? "No findings" : `${issues} finding${issues === 1 ? "" : "s"}`}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </nav>
  );
}
