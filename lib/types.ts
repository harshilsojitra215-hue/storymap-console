/** The camera. Five numbers nobody can evaluate without seeing them rendered. */
export type MapView = {
  lat: number;
  lon: number;
  zoom: number;
  pitch: number;
  bearing: number;
};

export type Chapter = {
  id: string;
  title: string;
  bodyDe: string;
  bodyEn: string;
  imageUrl: string;
  imageAlt: string;
  view: MapView;
  /** False until someone has actually looked at the map and captured this view. */
  viewCaptured: boolean;
  /**
   * Ids of the layers this chapter currently shows — presence means visible,
   * absence means hidden. A plain string array rather than a boolean map on
   * purpose: an id that isn't in the current layer registry (see lib/layers.ts)
   * stays in this array untouched rather than being silently dropped, which is
   * exactly what lets the checker notice a chapter still pointing at a layer
   * that no longer exists.
   */
  layers: string[];
};

export type Severity = "blocker" | "warning" | "suggestion";

export type Finding = {
  ruleId: string;
  severity: Severity;
  message: string;
  why: string;
  /** Set only for findings the checker groups under its own "Accessibility" heading. */
  category?: "accessibility";
};

/**
 * Which field a person edits over and over is which field is causing them trouble.
 * That is the whole point of counting.
 */
export type Metrics = {
  /** chapter id -> field name -> number of edits */
  perChapter: Record<string, Record<string, number>>;
  totalEdits: number;
  /** Edits made since the map instance was created. It is never re-created. */
  editsSinceMapCreated: number;
};

/**
 * A valid, inert Chapter used only when there is genuinely nothing to show —
 * e.g. an empty data/chapters.json — so hooks that must run unconditionally
 * (React's rules of hooks) always have something real to hold, even though
 * nothing that reads it is ever rendered in that state.
 */
export const EMPTY_CHAPTER: Chapter = {
  id: "",
  title: "",
  bodyDe: "",
  bodyEn: "",
  imageUrl: "",
  imageAlt: "",
  view: { lat: 0, lon: 0, zoom: 0, pitch: 0, bearing: 0 },
  viewCaptured: false,
  layers: [],
};

export const EMPTY_METRICS: Metrics = {
  perChapter: {},
  totalEdits: 0,
  editsSinceMapCreated: 0,
};
