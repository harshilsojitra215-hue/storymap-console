"use client";

import { useEffect, useState } from "react";
import type * as MapLibre from "maplibre-gl";

type Props = {
  map: MapLibre.Map | null;
  /** Bottom-left round button — brings the story panel back after it's been closed. */
  onOpenChapterList: () => void;
};

const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const MinusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 8h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const TiltIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M2 11 8 5l6 6"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const CompassIcon = () => (
  <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.1" opacity="0.35" />
    <path d="M8 2.6 9.6 8 8 13.4 6.4 8Z" fill="currentColor" />
  </svg>
);
const ListIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.5" />
    <path d="m12.5 12.5-2.6-2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/**
 * The map's own chrome, styled to match the reference product rather than
 * MapLibre's default control skin — small, white, soft-shadowed, understated.
 * Reads the map's live pitch and bearing (via its own `pitch`/`rotate`
 * events) so the 2D/3D state and the compass needle stay correct when a drag,
 * not a button, is what actually moved the camera.
 */
export default function MapControls({ map, onOpenChapterList }: Props) {
  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(0);

  useEffect(() => {
    if (!map) return;
    const sync = () => {
      setBearing(map.getBearing());
      setPitch(map.getPitch());
    };
    sync();
    map.on("rotate", sync);
    map.on("pitch", sync);
    return () => {
      map.off("rotate", sync);
      map.off("pitch", sync);
    };
  }, [map]);

  if (!map) return null;

  const is3d = pitch > 10;

  return (
    <>
      <div className="map-furniture-stack" role="group" aria-label="Map view controls">
        <button
          type="button"
          className="furniture-btn"
          onClick={() => map.zoomIn({ duration: 300 })}
          aria-label="Zoom in"
        >
          <PlusIcon />
        </button>
        <button
          type="button"
          className="furniture-btn"
          onClick={() => map.zoomOut({ duration: 300 })}
          aria-label="Zoom out"
        >
          <MinusIcon />
        </button>
        <button
          type="button"
          className="furniture-btn furniture-btn-text"
          onClick={() => map.easeTo({ pitch: is3d ? 0 : 60, duration: 600 })}
          aria-pressed={is3d}
          aria-label={is3d ? "Switch to 2D" : "Switch to 3D"}
        >
          {is3d ? "2D" : "3D"}
        </button>
        <button
          type="button"
          className="furniture-btn"
          onClick={() => map.easeTo({ pitch: Math.min(85, pitch + 15), duration: 250 })}
          aria-label="Tilt the camera up"
        >
          <TiltIcon />
        </button>
      </div>

      <button
        type="button"
        className="furniture-btn furniture-compass"
        onClick={() => map.easeTo({ bearing: 0, duration: 400 })}
        aria-label={`Reset north (bearing currently ${Math.round(bearing)} degrees)`}
        style={{ "--bearing": `${-bearing}deg` } as React.CSSProperties}
      >
        <CompassIcon />
      </button>

      <button
        type="button"
        className="furniture-btn furniture-chapters"
        onClick={onOpenChapterList}
        aria-label="Open chapter list"
      >
        <ListIcon />
      </button>

      <button
        type="button"
        className="furniture-pill furniture-search"
        disabled
        aria-label="Search"
        title="Search is chrome only in this prototype — not a working feature"
      >
        <SearchIcon />
      </button>
    </>
  );
}
