/**
 * The full list of map layers a chapter can show. This is the whole registry —
 * a project rule can tell "a layer nobody uses" from "a layer that doesn't
 * exist" only because this list, and only this list, defines what exists.
 */
export type LayerId = "route" | "stations" | "buildings3d";

export type LayerDefinition = {
  id: LayerId;
  label: string;
  /** Shown next to its toggle in the editor. */
  hint: string;
};

export const LAYER_DEFINITIONS: LayerDefinition[] = [
  {
    id: "route",
    label: "Route line",
    hint: "Illustrative only — not real project geometry",
  },
  {
    id: "stations",
    label: "Station markers",
    hint: "Point markers for named stations",
  },
  {
    id: "buildings3d",
    label: "3D buildings",
    hint: "The base map's own building extrusion",
  },
];

export const KNOWN_LAYER_IDS: string[] = LAYER_DEFINITIONS.map((d) => d.id);

export function isKnownLayerId(id: string): id is LayerId {
  return (KNOWN_LAYER_IDS as string[]).includes(id);
}
