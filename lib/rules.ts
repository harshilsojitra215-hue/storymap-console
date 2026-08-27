import type { Chapter, Finding, Severity } from "./types";

/**
 * The error taxonomy.
 *
 * This is a plain list on purpose: one row per known way a storymap chapter goes
 * wrong, readable top to bottom without following any code. Every rule is a pure
 * function of a single chapter, so the whole checker runs on every keystroke for
 * free, and every rule can be tested on its own.
 *
 * `test` returns true when the rule FIRES, i.e. when something is wrong.
 *
 * There is no language model here, and that is deliberate — see README. An LLM
 * layer would sit on top of this list, not replace it: the list is what tells it
 * what "wrong" means.
 */

/** Rough bounding box of Germany. */
const GERMANY = { minLat: 47, maxLat: 55, minLon: 5.5, maxLon: 15.5 };

const inGermanyLatRange = (n: number) => n >= GERMANY.minLat && n <= GERMANY.maxLat;
const inGermanyLonRange = (n: number) => n >= GERMANY.minLon && n <= GERMANY.maxLon;

/**
 * The single most common coordinate mistake: latitude and longitude entered the
 * wrong way round. It is detectable because Germany's latitude band and longitude
 * band do not overlap — a "latitude" of 8.6 can only be a longitude.
 */
const looksSwapped = (c: Chapter) =>
  inGermanyLonRange(c.view.lat) && inGermanyLatRange(c.view.lon);

const outsideGermany = (c: Chapter) =>
  !inGermanyLatRange(c.view.lat) || !inGermanyLonRange(c.view.lon);

const blank = (s: string) => s.trim().length === 0;

export type Rule = {
  id: string;
  severity: Severity;
  message: string;
  why: string;
  test: (c: Chapter) => boolean;
};

export const RULES: Rule[] = [
  {
    id: "coords-outside-germany",
    severity: "blocker",
    message: "Coordinates fall outside Germany",
    why: "The camera will open somewhere unrelated to the project, so the chapter shows the wrong place entirely.",
    // Stays quiet when the swap rule fires: a swapped pair is always also out of
    // bounds, and one precise diagnosis beats two overlapping ones.
    test: (c) => outsideGermany(c) && !looksSwapped(c),
  },
  {
    id: "coords-swapped",
    severity: "blocker",
    message: "Latitude and longitude appear to be the wrong way round",
    why: "Swapping them puts the camera in the Indian Ocean or Somalia. It is the most common coordinate error and the easiest to miss in a form.",
    test: looksSwapped,
  },
  {
    id: "zoom-too-close",
    severity: "warning",
    message: "Zoomed in past useful detail",
    why: "Above zoom 18 the reader sees individual rooftops and loses all sense of where the project runs.",
    test: (c) => c.view.zoom > 18,
  },
  {
    id: "zoom-too-far",
    severity: "warning",
    message: "Zoomed out so far the project is not visible",
    why: "Below zoom 6 the whole country is in frame and the route is a few pixels wide.",
    test: (c) => c.view.zoom < 6,
  },
  {
    id: "pitch-too-steep",
    severity: "suggestion",
    message: "Steep camera angle, buildings may occlude the route",
    why: "Past 60 degrees the 3D buildings in the foreground start hiding what the chapter is pointing at.",
    test: (c) => c.view.pitch > 60,
  },
  {
    id: "image-without-alt",
    severity: "blocker",
    message: "Image has no alt text",
    why: "Required under BFSG and WCAG. Public-sector infrastructure communication has to be accessible, so this one is a legal problem, not a style problem.",
    test: (c) => !blank(c.imageUrl) && blank(c.imageAlt),
  },
  {
    id: "missing-english",
    severity: "warning",
    message: "English version will show a gap",
    why: "The German text is written but the English is empty, so English readers get a chapter with a heading and nothing under it.",
    test: (c) => !blank(c.bodyDe) && blank(c.bodyEn),
  },
  {
    id: "no-body-text",
    severity: "warning",
    message: "Chapter has no content",
    why: "The story card will render as an empty box next to the map.",
    test: (c) => blank(c.bodyDe) && blank(c.bodyEn),
  },
  {
    id: "no-title",
    severity: "blocker",
    message: "Chapter has no title",
    why: "The chapter is unnavigable — it has no label in the story, and no heading on the card.",
    test: (c) => blank(c.title),
  },
  {
    id: "view-never-captured",
    severity: "warning",
    message: "Chapter has no map view set",
    why: "The camera numbers are still whatever they were seeded with, so nobody has confirmed this chapter actually frames its subject.",
    test: (c) => !c.viewCaptured,
  },
];

/** Runs the whole taxonomy over one chapter. Cheap enough to call on every keystroke. */
export function evaluate(chapter: Chapter): Finding[] {
  return RULES.filter((rule) => rule.test(chapter)).map(({ id, severity, message, why }) => ({
    ruleId: id,
    severity,
    message,
    why,
  }));
}

const SEVERITY_ORDER: Severity[] = ["blocker", "warning", "suggestion"];

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  return {
    blocker: findings.filter((f) => f.severity === "blocker").length,
    warning: findings.filter((f) => f.severity === "warning").length,
    suggestion: findings.filter((f) => f.severity === "suggestion").length,
  };
}

/** "2 blockers, 1 warning" */
export function summarise(findings: Finding[]): string {
  if (findings.length === 0) return "Nothing to fix";
  const counts = countBySeverity(findings);
  return SEVERITY_ORDER.filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${counts[s] === 1 ? s : `${s}s`}`)
    .join(", ");
}
