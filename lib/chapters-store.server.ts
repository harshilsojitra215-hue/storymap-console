import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Chapter } from "./types";

/**
 * The one place that touches the JSON file on disk.
 *
 * Storage is deliberately still a flat file — the brief this responds to asks
 * for a GraphQL layer, not a database, and swapping this one function for a
 * real content API later is exactly the "bind to a real CMS" step described in
 * NOTES.md. Everything above this function — the schema, the resolvers, the
 * route — would not need to change.
 *
 * Read from disk rather than a static import so the API route and the page
 * genuinely go through the same code path; a build-time import would make the
 * "backend layer" cosmetic.
 */
export async function readChaptersFromDisk(): Promise<Chapter[]> {
  const file = path.join(process.cwd(), "data", "chapters.json");
  const raw = await readFile(file, "utf-8");
  return JSON.parse(raw) as Chapter[];
}
