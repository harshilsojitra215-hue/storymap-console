import type { Chapter, Finding, MapView, Severity } from "./types";
import { LAYER_DEFINITIONS, isKnownLayerId } from "./layers";
import routeGeoJson from "@/data/route-geojson.json";

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

/**
 * All coordinates the illustrative route touches, [lon, lat], pulled once from
 * the LineString and the point markers alike. There is exactly one geometry
 * file in this prototype, so nothing here needs to know which chapter is
 * asking — the same coordinates are checked against every camera.
 */
const ROUTE_COORDINATES: [number, number][] = routeGeoJson.features.flatMap((f) => {
  if (f.geometry.type === "LineString") return f.geometry.coordinates as [number, number][];
  if (f.geometry.type === "Point") return [f.geometry.coordinates as [number, number]];
  return [];
});

/**
 * Roughly how far a camera at this zoom can see, in degrees, along each axis.
 *
 * This is deliberately an approximation, not a query against a live map: the
 * checker has to run as a pure function of chapter data alone, before any map
 * instance exists, so it cannot ask MapLibre what is actually in the current
 * viewport. The formula is the standard Web Mercator meters-per-pixel figure,
 * applied to a representative viewport half-width (400px) rather than a real
 * one — close enough to tell "the route is nowhere near this camera" from
 * "the route is roughly where this camera is looking", which is the only
 * distinction this rule needs to make.
 */
function visibleHalfExtentDegrees(view: MapView): { lat: number; lon: number } {
  const metersPerPixel = (156543.03392 * Math.cos((view.lat * Math.PI) / 180)) / 2 ** view.zoom;
  const halfWidthMeters = metersPerPixel * 400;
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLon = 111_320 * Math.cos((view.lat * Math.PI) / 180) || 1;
  return {
    lat: Math.abs(halfWidthMeters / metersPerDegreeLat),
    lon: Math.abs(halfWidthMeters / metersPerDegreeLon),
  };
}

function routeNearCamera(view: MapView): boolean {
  const half = visibleHalfExtentDegrees(view);
  return ROUTE_COORDINATES.some(
    ([lon, lat]) => Math.abs(lat - view.lat) <= half.lat && Math.abs(lon - view.lon) <= half.lon,
  );
}

export type Rule = {
  id: string;
  severity: Severity;
  /**
   * Almost always a plain string, kept that way deliberately so the list below
   * reads top to bottom without following any code. A function is the one
   * escape hatch, used only where naming the specific offending value (not
   * just "something is wrong") is the difference between a finding someone can
   * act on and one that sends them to open the JSON file to find out what.
   */
  message: string | ((c: Chapter) => string);
  why: string;
  test: (c: Chapter) => boolean;
  /**
   * Set only on rules the checker groups under its own "Accessibility"
   * heading. The reference product sells BFSG/WCAG compliance as a headline
   * feature, so these earn their own labelled section rather than sitting
   * mixed in with everything else — grouping only, no new rules.
   */
  category?: "accessibility";
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
    category: "accessibility",
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
  {
    id: "layer-reference-unknown",
    severity: "warning",
    // Named explicitly rather than left as "a layer" — without the id, fixing
    // this means opening the JSON file to go find out which one it was.
    message: (c) => {
      const unknown = c.layers.filter((id) => !isKnownLayerId(id));
      return unknown.length === 1
        ? `References a layer that no longer exists: "${unknown[0]}"`
        : `References layers that no longer exist: ${unknown.map((id) => `"${id}"`).join(", ")}`;
    },
    why: "One of this chapter's enabled layers isn't in the current layer list — likely a leftover from a renamed or removed layer, and it does nothing now.",
    test: (c) => c.layers.some((id) => !isKnownLayerId(id)),
  },
  {
    id: "route-outside-camera",
    severity: "warning",
    message: "Route layer is on, but the route is nowhere near this camera",
    why: "The illustrative route only helps the reader if it is actually inside the shot. Enabling it without the camera framing it just adds a layer nobody sees.",
    test: (c) => c.layers.includes("route") && !routeNearCamera(c.view),
  },
];

/** Runs the whole taxonomy over one chapter. Cheap enough to call on every keystroke. */
export function evaluate(chapter: Chapter): Finding[] {
  return RULES.filter((rule) => rule.test(chapter)).map(
    ({ id, severity, message, why, category }) => ({
      ruleId: id,
      severity,
      message: typeof message === "function" ? message(chapter) : message,
      why,
      category,
    }),
  );
}

/**
 * Same as `evaluate`, cached per chapter object.
 *
 * Editing one chapter replaces only that chapter's object — the other three in
 * the list keep the exact reference they had before. A cache keyed on that
 * reference means summing findings across every chapter (the header count, the
 * per-chapter status dots) only ever re-evaluates the one chapter that changed,
 * not all of them, on every keystroke. A WeakMap rather than a plain Map so an
 * edited-out chapter's old findings aren't held onto forever.
 */
const findingsCache = new WeakMap<Chapter, Finding[]>();

export function evaluateCached(chapter: Chapter): Finding[] {
  const cached = findingsCache.get(chapter);
  if (cached) return cached;
  const findings = evaluate(chapter);
  findingsCache.set(chapter, findings);
  return findings;
}

/**
 * Findings that belong to the whole project, not to any one chapter — "a
 * chapter references a layer that doesn't exist" is checkable per chapter, but
 * "a layer no chapter ever shows" can only be answered by looking at all of
 * them at once. Same Finding shape as the per-chapter rules, so the checker UI
 * doesn't need a second kind of row to render.
 */
export function evaluateProject(chapters: Chapter[]): Finding[] {
  return LAYER_DEFINITIONS.filter(
    (layer) => !chapters.some((c) => c.layers.includes(layer.id)),
  ).map((layer) => ({
    ruleId: `layer-unused-${layer.id}`,
    severity: "suggestion" as Severity,
    message: `"${layer.label}" is never shown by any chapter`,
    why: "A layer nobody turns on is either dead weight in the project or a feature editors don't know exists — worth finding out which before removing or promoting it.",
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
