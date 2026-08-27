"use client";

import type { Chapter } from "@/lib/types";

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
        // eslint-disable-next-line @next/next/no-img-element
        <img className="story-card-image" src={chapter.imageUrl} alt={chapter.imageAlt} />
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
