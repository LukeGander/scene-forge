import type { SceneCardRecord, DesignRisk } from "@/lib/forge-scene/types";

export interface SceneCardRow {
  player_goal: string;
  obstacle: string;
  characters: SceneCardRecord["characters"];
  interactive_element: string;
  required_assets: string[];
  design_risks: DesignRisk[];
  status: SceneCardRecord["status"];
  creator_notes: string;
  generation_source: "mock" | "anthropic";
  generated_at: string;
}

export interface SceneCardQueryError {
  message: string;
}

/**
 * Resolves a scene_cards lookup (`data`/`error` from Supabase's
 * `.maybeSingle()`) into the row to use, or null when no card exists yet.
 *
 * A genuine query error must not be treated as "no card exists yet" — that
 * silently hides a DB failure behind a legitimate, common state. See
 * card-lookup.test.ts.
 */
export function resolveSceneCardLookup(
  data: SceneCardRow | null,
  error: SceneCardQueryError | null,
): SceneCardRow | null {
  if (error) {
    throw new Error(`Failed to load scene card: ${error.message}`);
  }
  return data;
}
