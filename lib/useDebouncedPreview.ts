import { useEffect, useRef, useState } from "react";
import type { Chapter } from "./types";

/**
 * Delays the story card's text by a beat, without delaying anything else.
 *
 * The checker, the edit counter and the map camera all read the live chapter
 * directly and are untouched by this — only what the story card renders goes
 * through here. The point is purely to avoid re-rendering the card's image and
 * layout on every keystroke of a fast typist; it is not meant to be felt.
 *
 * Switching chapters bypasses the delay entirely. Without that, clicking a
 * different chapter in the list would show the previous chapter's text for a
 * moment — which reads as a bug, not as smoothing.
 */
export function useDebouncedPreview(chapter: Chapter, delayMs: number): Chapter {
  const [debounced, setDebounced] = useState(chapter);
  const lastIdRef = useRef(chapter.id);

  useEffect(() => {
    if (chapter.id !== lastIdRef.current) {
      lastIdRef.current = chapter.id;
      setDebounced(chapter);
      return;
    }
    const timer = setTimeout(() => setDebounced(chapter), delayMs);
    return () => clearTimeout(timer);
  }, [chapter, delayMs]);

  return debounced;
}
