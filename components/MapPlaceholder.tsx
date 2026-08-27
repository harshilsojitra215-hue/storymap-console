/**
 * What sits where the map will be, before the map exists.
 *
 * There are three separate waits to cover, and a blank rectangle during any one
 * of them makes the whole page look broken on open:
 *   1. the map library is a large download, fetched separately so it never blocks
 *      the first paint of the editor
 *   2. once it arrives, the map still has to fetch and parse its style
 *   3. and then its first tiles have to arrive and render
 *
 * So this is deliberate rather than apologetic: the ground colour the map will
 * settle into, a faint graticule to say "a map belongs here", and a quiet label.
 *
 * It is also where a permanent failure surfaces. If neither the primary nor the
 * fallback style can put anything on screen, this says so plainly instead of
 * animating a loading message forever.
 */
export default function MapPlaceholder({ failed = false }: { failed?: boolean }) {
  return (
    // aria-hidden because MapPreview keeps a live region of its own that survives
    // the transition; announcing from both would say everything twice.
    <div className={failed ? "map-placeholder is-failed" : "map-placeholder"} aria-hidden="true">
      <svg className="map-placeholder-grid" focusable="false">
        <defs>
          <pattern id="graticule" width="72" height="72" patternUnits="userSpaceOnUse">
            <path d="M72 0H0V72" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#graticule)" />
      </svg>

      <p className="map-placeholder-label">
        {failed ? (
          <>
            <span className="map-placeholder-headline">Map preview unavailable</span>
            <span className="map-placeholder-detail">
              Neither map source could be reached. Everything else on this page still works.
            </span>
          </>
        ) : (
          <span className="map-placeholder-headline is-waiting">Preparing map preview</span>
        )}
      </p>
    </div>
  );
}
