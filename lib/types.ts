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
};

export type Severity = "blocker" | "warning" | "suggestion";

export type Finding = {
  ruleId: string;
  severity: Severity;
  message: string;
  why: string;
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

export const EMPTY_METRICS: Metrics = {
  perChapter: {},
  totalEdits: 0,
  editsSinceMapCreated: 0,
};
