"use client";

import Image from "next/image";
import type { Chapter } from "@/lib/types";

/** Matches the placeholder SVGs generated for this repo (public/placeholders/*.svg). */
const PLACEHOLDER_WIDTH = 640;
const PLACEHOLDER_HEIGHT = 360;

type Props = {
  chapter: Chapter;
  language: "de" | "en";
  onLanguageChange: (lang: "de" | "en") => void;
};

/**
 * The floating story panel, laid out the way the real product does it: map behind,
 * story over it. Everything here is driven straight from React state, which is why
 * it repaints on the keystroke instead of on a save.
 */
export default function StoryCard({ chapter, language, onLanguageChange }: Props) {
  const body = language === "de" ? chapter.bodyDe : chapter.bodyEn;

  return (
    <article className="story-card">
      <div className="story-card-head">
        <span className="story-card-eyebrow">Preview</span>
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

      <h2 className="story-card-title">
        {chapter.title.trim() || <span className="placeholder-text">Untitled chapter</span>}
      </h2>

      {chapter.imageUrl.trim() ? (
        <Image
          className="story-card-image"
          src={chapter.imageUrl}
          alt={chapter.imageAlt}
          width={PLACEHOLDER_WIDTH}
          height={PLACEHOLDER_HEIGHT}
          sizes="(max-width: 900px) 90vw, 370px"
          // The Image URL field is free text an editor can point anywhere, so the
          // fixed domain allowlist next/image normally enforces can't apply here.
          // Explicit width/height is what actually prevents layout shift; that
          // guarantee holds with or without the optimizer running.
          unoptimized
        />
      ) : null}

      {body.trim() ? (
        <p className="story-card-body">{body}</p>
      ) : (
        <p className="story-card-body placeholder-text">
          {language === "de"
            ? "Kein deutscher Text für dieses Kapitel."
            : "No English text for this chapter."}
        </p>
      )}
    </article>
  );
}
