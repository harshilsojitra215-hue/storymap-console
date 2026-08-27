"use client";

import { useEffect, useRef, useState } from "react";
import type * as MapLibre from "maplibre-gl";
import type { MapView } from "@/lib/types";
import "maplibre-gl/dist/maplibre-gl.css";

/** Free, no API key, includes 3D building data. */
const STYLE_PRIMARY = "https://tiles.openfreemap.org/styles/liberty";
/** Documented fallback if OpenFreeMap is unreachable. */
const STYLE_FALLBACK = "https://demotiles.maplibre.org/style.json";

type Props = {
  view: MapView;
  chapterId: string;
  onMapReady: (map: MapLibre.Map) => void;
  onStyleFallback: () => void;
};

/**
 * How close the map has to already be to the incoming numbers before we decide
 * the numbers came FROM the map and not from someone typing.
 *
 * This one comparison is what removes the feedback loop. "Use this view" writes
 * the map's own camera into state; that state change comes straight back down
 * here as a new `view`, and without this check we would command the map to go
 * where it already is, on every frame the user drags.
 */
const CLOSE_ENOUGH = { deg: 1e-4, other: 0.05 };

function cameraAlreadyThere(map: MapLibre.Map, view: MapView) {
  const c = map.getCenter();
  return (
    Math.abs(c.lat - view.lat) < CLOSE_ENOUGH.deg &&
    Math.abs(c.lng - view.lon) < CLOSE_ENOUGH.deg &&
    Math.abs(map.getZoom() - view.zoom) < CLOSE_ENOUGH.other &&
    Math.abs(map.getPitch() - view.pitch) < CLOSE_ENOUGH.other &&
    Math.abs(map.getBearing() - view.bearing) < CLOSE_ENOUGH.other
  );
}

/** Liberty ships 3D buildings; bare-bones styles do not. Add them if they are missing. */
function ensureBuildingExtrusion(map: MapLibre.Map) {
  try {
    const style = map.getStyle();
    if (!style?.layers) return;
    if (style.layers.some((l) => l.type === "fill-extrusion")) return;
    if (!style.sources || !("openmaptiles" in style.sources)) return;
    map.addLayer({
      id: "buildings-3d",
      type: "fill-extrusion",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": "#c8ccd4",
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.75,
      },
    });
  } catch {
    // Cosmetic only. A style without building data is not a reason to fail.
  }
}

export default function MapPreview({ view, chapterId, onMapReady, onStyleFallback }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre.Map | null>(null);
  const startedRef = useRef(false);
  const lastChapterRef = useRef<string>(chapterId);
  const [ready, setReady] = useState(false);

  // The map is built once and never destroyed. There is deliberately no cleanup
  // function and nothing that aborts the build half way: tearing the map down and
  // rebuilding it is exactly the reload this whole prototype exists to remove.
  //
  // That also makes this effect safe under React's development StrictMode, which
  // runs every effect twice. The ref below lets the second run fall straight out
  // instead of racing the first.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (!containerRef.current) return;

      // Point MapLibre at a worker we serve ourselves. Left to its own devices it
      // derives the worker URL from `import.meta.url` inside its bundled chunk,
      // which does not resolve under Next's bundler: the worker fails to load, the
      // style never finishes, and the map silently stays blank. See
      // scripts/copy-map-worker.mjs, which puts the file in public/ at build time.
      maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

      let style = STYLE_PRIMARY;
      try {
        // The timeout matters: without it, a blocked or blackholed tile host does
        // not fail, it simply never answers, and the map never appears at all.
        const probe = await fetch(STYLE_PRIMARY, { signal: AbortSignal.timeout(5000) });
        if (!probe.ok) throw new Error(String(probe.status));
      } catch {
        style = STYLE_FALLBACK;
        onStyleFallback();
      }

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [view.lon, view.lat],
        zoom: view.zoom,
        pitch: view.pitch,
        bearing: view.bearing,
        maxPitch: 85,
        attributionControl: { compact: true },
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
      map.touchZoomRotate.enableRotation();

      // The Liberty style references a handful of POI icons its sprite sheet does
      // not actually ship. Unhandled, each one logs a warning on every load and
      // buries anything worth reading. They are decorative, so resolve them to
      // nothing on purpose.
      map.setMissingStyleImageResolver(() => undefined);

      map.on("load", () => {
        ensureBuildingExtrusion(map);
        setReady(true);
      });

      mapRef.current = map;
      onMapReady(map);

      // Development-only handle, so the live camera can be read from the browser
      // console while checking that the preview genuinely never reloads.
      // Stripped from the production bundle.
      if (process.env.NODE_ENV === "development") {
        (window as unknown as { __storymapMap?: unknown }).__storymapMap = map;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Everything that moves the camera afterwards goes through here.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const target = {
      center: [view.lon, view.lat] as [number, number],
      zoom: view.zoom,
      pitch: view.pitch,
      bearing: view.bearing,
    };

    // A different chapter: fly, so the reader sees the relationship between the
    // two places rather than being teleported.
    if (lastChapterRef.current !== chapterId) {
      lastChapterRef.current = chapterId;
      map.flyTo({ ...target, duration: 1400, essential: true });
      return;
    }

    // Same chapter, and the map is already where the numbers say: the numbers
    // came from the map. Do nothing, or we fight the user's own dragging.
    if (cameraAlreadyThere(map, view)) return;

    // Same chapter, numbers genuinely changed: someone typed. Follow immediately,
    // so the preview answers on the keystroke.
    map.jumpTo(target);
  }, [chapterId, view.lat, view.lon, view.zoom, view.pitch, view.bearing, ready, view]);

  return <div ref={containerRef} className="map-canvas" aria-label="Live map preview" />;
}
