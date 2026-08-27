import { graphql } from "graphql";
import { schema } from "@/lib/graphql/schema";
import type { Chapter } from "@/lib/types";
import StorymapConsole from "@/components/StorymapConsole";

// Without this, Next treats an async Server Component with no per-request
// input as static and runs it once at build time — meaning the page would
// keep serving whatever data/chapters.json contained at the last build, while
// /api/graphql (a real Route Handler) reads the file fresh on every request.
// That split contradicts the point of putting chapters behind GraphQL at all:
// the API and the page it feeds would silently disagree. Forcing dynamic
// rendering makes both read the same live file on every request; the query
// still resolves server-side before HTML is sent, so first paint stays
// instant either way.
export const dynamic = "force-dynamic";

const CHAPTERS_QUERY = /* GraphQL */ `
  query AllChapters {
    chapters {
      id
      title
      bodyDe
      bodyEn
      imageUrl
      imageAlt
      viewCaptured
      layers
      view {
        lat
        lon
        zoom
        pitch
        bearing
      }
    }
  }
`;

/**
 * Runs the GraphQL query in-process rather than making an HTTP round trip to
 * this app's own /api/graphql route. The data still goes through the same
 * schema and the same resolvers — see lib/graphql/schema.ts — so this is
 * genuinely a GraphQL query, not a JSON import wearing a GraphQL costume. It
 * just skips the network hop a server asking itself a question over HTTP would
 * otherwise need, which would need its own origin URL and add nothing.
 *
 * A Server Component doing this keeps the page's first paint instant: the
 * chapters are already resolved by the time HTML is sent, so there is no
 * client-side loading state for the initial load — a loading spinner here
 * would be a regression, not a feature.
 */
export default async function Page() {
  const result = await graphql({ schema, source: CHAPTERS_QUERY });

  if (result.errors?.length) {
    // Logged for whoever is running this deployment, not shown to whoever is
    // looking at the page. The /api/graphql route masks its own errors the
    // same way by default (graphql-yoga's built-in behaviour) — this direct,
    // in-process call bypasses that layer entirely, so it needs its own guard
    // against leaking an internal exception message (e.g. a raw JSON.parse
    // error naming a byte offset) into the rendered banner.
    console.error("GraphQL query for chapters failed:", result.errors[0]?.message);
    return (
      <StorymapConsole
        initialChapters={[]}
        loadError="the chapters data could not be read"
      />
    );
  }

  // graphql-js builds its execution result with null-prototype objects (a
  // guard against prototype pollution in resolver output). React's Server ->
  // Client boundary refuses those outright ("null prototypes are not
  // supported"), so each chapter is rebuilt as a genuinely plain object before
  // it crosses that boundary into StorymapConsole.
  const raw = (result.data?.chapters as Chapter[] | undefined) ?? [];
  const chapters: Chapter[] = raw.map((c) => ({
    id: c.id,
    title: c.title,
    bodyDe: c.bodyDe,
    bodyEn: c.bodyEn,
    imageUrl: c.imageUrl,
    imageAlt: c.imageAlt,
    viewCaptured: c.viewCaptured,
    layers: [...c.layers],
    view: {
      lat: c.view.lat,
      lon: c.view.lon,
      zoom: c.view.zoom,
      pitch: c.view.pitch,
      bearing: c.view.bearing,
    },
  }));

  return <StorymapConsole initialChapters={chapters} />;
}
