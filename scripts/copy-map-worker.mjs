/**
 * Copies MapLibre's worker module into public/ so the app can serve it itself.
 *
 * Why this exists: MapLibre starts a web worker whose URL it works out from
 * `import.meta.url` inside its own bundled chunk. Under Next's bundler that URL
 * does not resolve to a real file, the dev server answers with the HTML app
 * shell instead, and the worker dies on load with a MIME-type error. The map
 * then never finishes loading its style — no tiles, no "load" event, and a
 * camera that refuses to move.
 *
 * Serving the worker from a path we control and pointing MapLibre at it with
 * setWorkerUrl() removes the guesswork. Copying it at build time rather than
 * committing it keeps the file in step with whatever version of maplibre-gl is
 * installed.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "node_modules", "maplibre-gl", "dist");
const publicDir = join(root, "public");

// The worker imports the shared chunk as a sibling, so both files have to land
// next to each other or the worker dies on its first import.
const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

mkdirSync(publicDir, { recursive: true });
for (const file of files) {
  copyFileSync(join(dist, file), join(publicDir, file));
}

console.log(`copied ${files.join(", ")} -> public/`);
