"use client";

import { useEffect, useRef, useState } from "react";
import type * as MapLibre from "maplibre-gl";
import type { MapView } from "@/lib/types";
import MapPlaceholder from "./MapPlaceholder";
import routeGeoJson from "@/data/route-geojson.json";
import "maplibre-gl/dist/maplibre-gl.css";

const ROUTE_SOURCE_ID = "illustrative-route-source";
const ROUTE_LINE_LAYER_ID = "illustrative-route-line";
const STATIONS_LAYER_ID = "illustrative-stations";

/** Free, no API key, and it ships 3D building extrusions in the style itself. */
const STYLE_PRIMARY = "https://tiles.openfreemap.org/styles/liberty";
/** Documented fallback if OpenFreeMap is unreachable. No 3D buildings on this one. */
const STYLE_FALLBACK = "https://demotiles.maplibre.org/style.json";

/**
 * How long to wait for a style to actually put something on screen before giving
 * up on it. Generous on the first attempt, because "slow" and "broken" look
 * identical for the first few seconds and downgrading a working map is worse
 * than waiting a moment longer.
 */
const FIRST_PAINT_DEADLINE = { primary: 12000, fallback: 8000 };
/** Once something has errored, stop waiting out the full deadline. */
const DEADLINE_AFTER_ERROR = 2500;

/**
 * Keeps the map from ever needing tiles for the whole planet: nothing to fetch
 * past this zoom, and nowhere to pan past this box.
 *
 * The box is deliberately much larger than the project area around Frankfurt.
 * The "Tunnel West portal" chapter ships with its latitude and longitude
 * swapped on purpose, which puts its camera in the Atlantic off West Africa —
 * that empty-ocean view is the whole point of the demo, the thing that makes
 * the checker's "coordinates appear to be the wrong way round" finding land.
 * A box drawn tightly around Frankfurt would clamp that flight and quietly
 * defeat its own demonstration, so this one is wide enough to hold both the
 * real project and its own deliberately broken coordinate.
 */
const MAX_ZOOM = 19;
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [-20, -20],
  [60, 60],
];

type Status = "loading" | "ready" | "failed";

type Props = {
  view: MapView;
  chapterId: string;
  /** Ids of the layers the current chapter shows. Unknown ids are simply ignored here — the checker is what flags those, not the map. */
  layers: string[];
  /** The instance exists. From here on, no edit can cost a page reload. */
  onMapCreated: () => void;
  /** The map has actually drawn something, so its camera is worth capturing. */
  onMapReady: (map: MapLibre.Map) => void;
};

/**
 * Adds this prototype's own route line and station markers to whichever style
 * is currently active, both hidden by default.
 *
 * Called every time a style finishes loading, not just once: `setStyle()`
 * replaces the entire style document, including any source or layer added on
 * top of the previous one, so switching to the fallback style would silently
 * lose these unless they are re-added afterwards too. Checking for the source
 * first makes this safe to call repeatedly on the same style without error.
 */
function ensureIllustrativeLayers(map: MapLibre.Map) {
  if (map.getSource(ROUTE_SOURCE_ID)) return;

  map.addSource(ROUTE_SOURCE_ID, {
    type: "geojson",
    data: routeGeoJson as GeoJSON.FeatureCollection,
  });

  map.addLayer({
    id: ROUTE_LINE_LAYER_ID,
    type: "line",
    source: ROUTE_SOURCE_ID,
    filter: ["==", ["geometry-type"], "LineString"],
    layout: { visibility: "none", "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#c9622b", "line-width": 3, "line-dasharray": [2, 1.5] },
  });

  map.addLayer({
    id: STATIONS_LAYER_ID,
    type: "circle",
    source: ROUTE_SOURCE_ID,
    filter: ["==", ["geometry-type"], "Point"],
    layout: { visibility: "none" },
    paint: {
      "circle-radius": 6,
      "circle-color": "#ffffff",
      "circle-stroke-width": 2.5,
      "circle-stroke-color": "#c9622b",
    },
  });
}

/**
 * The base style may or may not ship its own 3D building layer — Liberty does
 * (a `fill-extrusion` layer named `building-3d`), the MapLibre demo fallback
 * style does not. Finding it by type rather than hardcoding its id is what
 * lets the "3D buildings" toggle keep working if the style's own layer names
 * ever change, and correctly do nothing on a style that has none.
 */
function findBuildingExtrusionLayerId(map: MapLibre.Map): string | null {
  const layer = map.getStyle()?.layers?.find((l) => l.type === "fill-extrusion");
  return layer?.id ?? null;
}

function setLayerVisible(map: MapLibre.Map, layerId: string | null, visible: boolean) {
  if (!layerId || !map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
}

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

export default function MapPreview({ view, chapterId, layers, onMapCreated, onMapReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre.Map | null>(null);
  const startedRef = useRef(false);
  const lastChapterRef = useRef<string>(chapterId);
  const [status, setStatus] = useState<Status>("loading");
  const [downgraded, setDowngraded] = useState(false);
  /** Re-discovered on every style.load — the fallback style has no such layer. */
  const buildingLayerIdRef = useRef<string | null>(null);
  /**
   * The mount effect below runs exactly once and its closures capture whatever
   * `layers` was at that moment. This ref is what lets its style.load handler
   * see the CURRENT chapter's layer choices when a style swap happens well
   * after mount, rather than replaying the very first chapter's.
   */
  const layersRef = useRef<string[]>(layers);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  const ready = status === "ready";

  // The map is built once and never destroyed. There is deliberately no cleanup
  // function and nothing that aborts the build half way: tearing the map down and
  // rebuilding it is exactly the reload this whole prototype exists to remove.
  //
  // That also makes this effect safe under React's development StrictMode, which
  // runs every effect twice. The ref below lets the second run fall straight out
  // instead of racing the first. Note this is also why there is no cleanup that
  // clears the watchdog timer: StrictMode runs cleanup immediately after the
  // first mount, which would cancel the watchdog belonging to the live map and
  // leave a stalled style with nothing to rescue it.
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

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_PRIMARY,
        center: [view.lon, view.lat],
        zoom: view.zoom,
        pitch: view.pitch,
        bearing: view.bearing,
        maxPitch: 85,
        maxZoom: MAX_ZOOM,
        maxBounds: MAX_BOUNDS,
        attributionControl: { compact: true },
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
      map.touchZoomRotate.enableRotation();

      // The Liberty style asks for a handful of POI icons its own sprite sheet does
      // not ship. Every one of them logs a warning on every load unless something
      // answers for them, so answer with a transparent pixel. Returning nothing
      // counts as "still unresolved" and does not silence anything.
      map.setMissingStyleImageResolver((id) => {
        if (!map.hasImage(id)) {
          map.addImage(id, { width: 1, height: 1, data: new Uint8Array(4) });
        }
      });

      // --- Deciding whether this map actually works ------------------------
      //
      // The honest test is not "did the style JSON parse" but "did anything appear
      // on screen". A style can parse perfectly and still be useless because its
      // tile endpoint is dead, which looks exactly like a finished, empty map.
      // So the map is only considered ready once it has rendered and gone idle.

      let painted = false;
      let usingFallback = false;
      let shortenedAfterError = false;
      let watchdog: ReturnType<typeof setTimeout>;

      const waitFor = (ms: number) => {
        clearTimeout(watchdog);
        watchdog = setTimeout(onStalled, ms);
      };

      const markPainted = () => {
        if (painted) return;
        painted = true;
        clearTimeout(watchdog);
        setStatus("ready");
        // Only hand the map upwards once it is genuinely usable, so "Use this
        // view" cannot capture a camera nobody has been able to look at.
        onMapReady(map);
      };

      /**
       * Is there actually anything on screen?
       *
       * `idle` on its own is not evidence: a map whose tile endpoint is dead has
       * nothing left to fetch, so it goes idle almost immediately and looks
       * exactly like a finished map that happens to be empty. Asking the map what
       * it has drawn tells those two apart, and unlike the source-loaded events it
       * works the same way for both styles.
       */
      const somethingIsDrawn = () => {
        try {
          return map.queryRenderedFeatures().length > 0;
        } catch {
          return false;
        }
      };

      function onStalled() {
        if (painted) return;
        if (!usingFallback) {
          usingFallback = true;
          shortenedAfterError = false;
          setDowngraded(true);
          map.setStyle(STYLE_FALLBACK);
          waitFor(FIRST_PAINT_DEADLINE.fallback);
          return;
        }

        // The fallback has had its turn too. If a style did load and there is
        // simply nothing to draw — a camera parked over open ocean would do it —
        // then the map is working and the emptiness is the truth. Show it.
        if (map.isStyleLoaded()) {
          markPainted();
          return;
        }

        // No style at all. Say so, rather than animating a loading label forever.
        setStatus("failed");
      }

      // `idle` fires when the map has finished rendering everything it currently
      // can — so paired with the check above, it is the moment there is genuinely
      // something to look at.
      map.on("idle", () => {
        if (somethingIsDrawn()) markPainted();
      });

      // The deadline measures how long we wait for data AFTER a style arrives, not
      // how long the whole thing has taken. Otherwise a slow connection and a dead
      // tile endpoint are indistinguishable, and slow connections lose their map.
      map.on("style.load", () => {
        if (!painted) waitFor(usingFallback ? FIRST_PAINT_DEADLINE.fallback : FIRST_PAINT_DEADLINE.primary);
        ensureIllustrativeLayers(map);
        buildingLayerIdRef.current = findBuildingExtrusionLayerId(map);
        // A style swap wipes visibility state along with everything else custom
        // on the old style, so the current chapter's layer choices are re-applied
        // immediately rather than waiting for the next unrelated re-render.
        setLayerVisible(map, ROUTE_LINE_LAYER_ID, layersRef.current.includes("route"));
        setLayerVisible(map, STATIONS_LAYER_ID, layersRef.current.includes("stations"));
        setLayerVisible(map, buildingLayerIdRef.current, layersRef.current.includes("buildings3d"));
      });

      map.on("error", () => {
        // After the first paint, errors are individual tiles at the edge of the
        // viewport failing, which the map recovers from by itself.
        if (painted || shortenedAfterError) return;
        // Before the first paint, an error is evidence rather than a verdict: a
        // single flaky request should not cost the good style. It only shortens
        // how long we are willing to wait.
        shortenedAfterError = true;
        waitFor(DEADLINE_AFTER_ERROR);
      });

      waitFor(FIRST_PAINT_DEADLINE.primary);

      mapRef.current = map;
      // The instance exists from this moment. It is never rebuilt, so from here
      // on nothing the editor does can cost a page reload — which is the claim
      // the measurement panel counts. That is separate from whether the map has
      // finished drawing, which is what gates "Use this view" below.
      onMapCreated();

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
  }, [chapterId, view.lat, view.lon, view.zoom, view.pitch, view.bearing, ready]);

  // Layer visibility follows the current chapter immediately — switching
  // chapters or flipping a toggle both apply on the next render, same as the
  // checker. Only the story card's text is debounced; this is not.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    setLayerVisible(map, ROUTE_LINE_LAYER_ID, layers.includes("route"));
    setLayerVisible(map, STATIONS_LAYER_ID, layers.includes("stations"));
    setLayerVisible(map, buildingLayerIdRef.current, layers.includes("buildings3d"));
  }, [layers, ready]);

  return (
    <>
      <div ref={containerRef} className="map-canvas" aria-label="Live map preview" />

      {/* Covers the whole gap: this component mounting, the map building itself,
          and the first tiles arriving. Without it the pane is a blank rectangle
          for those seconds. */}
      {!ready && <MapPlaceholder failed={status === "failed"} />}

      {/* Only once there is a map to look at. While the placeholder is up it
          speaks for itself, and two messages in the same corner is one too many. */}
      {ready && downgraded && (
        <p className="style-note">
          OpenFreeMap was unreachable — showing the MapLibre demo style instead. 3D
          buildings are unavailable on that style.
        </p>
      )}

      {/* Kept mounted in every state, so screen readers hear the transition
          rather than a message that was already there when the region appeared. */}
      <p className="sr-only" role="status" aria-live="polite">
        {status === "ready"
          ? "Map preview ready."
          : status === "failed"
            ? "The map preview could not be loaded. The rest of the editor still works."
            : "Preparing map preview."}
      </p>
    </>
  );
}
