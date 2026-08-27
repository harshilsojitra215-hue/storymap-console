import { createSchema } from "graphql-yoga";
import { readChaptersFromDisk } from "../chapters-store.server";
import type { Chapter } from "../types";

/**
 * The schema is deliberately a read-only mirror of the JSON file's shape.
 * Editing in this prototype happens entirely in the browser's own React state
 * — see app/page.tsx — so there is no mutation here to write changes back to
 * disk. Adding one later is exactly the "bind to a real CMS" step in NOTES.md.
 */
const typeDefs = /* GraphQL */ `
  type MapView {
    lat: Float!
    lon: Float!
    zoom: Float!
    pitch: Float!
    bearing: Float!
  }

  type Chapter {
    id: ID!
    title: String!
    bodyDe: String!
    bodyEn: String!
    imageUrl: String!
    imageAlt: String!
    view: MapView!
    viewCaptured: Boolean!
    "Ids of the layers this chapter shows. May include an id not in the app's current layer registry — that is a real, checkable state, not an error, so it round-trips as plain strings rather than an enum."
    layers: [String!]!
  }

  type Query {
    "All chapters, in the order they are told in."
    chapters: [Chapter!]!
    "A single chapter by id, or null if no chapter has that id."
    chapter(id: ID!): Chapter
  }
`;

const resolvers = {
  Query: {
    chapters: (): Promise<Chapter[]> => readChaptersFromDisk(),
    chapter: async (_parent: unknown, args: { id: string }): Promise<Chapter | null> => {
      const chapters = await readChaptersFromDisk();
      return chapters.find((c) => c.id === args.id) ?? null;
    },
  },
};

export const schema = createSchema({ typeDefs, resolvers });
