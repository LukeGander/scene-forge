import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { isReadyEligible } from "@/lib/forge-scene/readiness";
import type { DesignRisk, SceneCardFields, SceneCardRecord, SceneStatus } from "@/lib/forge-scene/types";

interface SceneCardRow {
  player_goal: string;
  obstacle: string;
  characters: SceneCardFields["characters"];
  interactive_element: string;
  required_assets: string[];
  status: SceneStatus;
  creator_notes: string;
}

const VALID_STATUSES: SceneStatus[] = ["draft", "needs_work", "ready"];

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function isDesignRisk(value: unknown): value is DesignRisk {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.risk === "string" && typeof candidate.acknowledged === "boolean";
}

interface CardUpdateBody {
  status: SceneStatus;
  notes: string;
  designRisks: DesignRisk[];
}

function isCardUpdateBody(value: unknown): value is CardUpdateBody {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.status === "string" &&
    VALID_STATUSES.includes(candidate.status as SceneStatus) &&
    typeof candidate.notes === "string" &&
    Array.isArray(candidate.designRisks) &&
    candidate.designRisks.every(isDesignRisk)
  );
}

export const PATCH: APIRoute = async (context) => {
  const { id } = context.params;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonResponse({ error: "Supabase is not configured" }, 500);
  }

  const user = context.locals.user;
  if (!user) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  if (!id) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  if (!isCardUpdateBody(body)) {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  const { data: card, error: cardError } = await supabase
    .from("scene_cards")
    .select("player_goal, obstacle, characters, interactive_element, required_assets, status, creator_notes")
    .eq("scene_id", id)
    .eq("user_id", user.id)
    .single<SceneCardRow>();

  // no-unnecessary-condition misreads Supabase's conditional response-union type here;
  // `card`/`error` are genuinely nullable at runtime (verified via `astro check`).
  /* eslint-disable @typescript-eslint/no-unnecessary-condition */
  if (cardError || !card) {
    return jsonResponse({ error: "Not found" }, 404);
  }
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */

  if (body.status === "ready") {
    const { eligible, missingReasons } = isReadyEligible({
      playerGoal: card.player_goal,
      obstacle: card.obstacle,
      characters: card.characters,
      interactiveElement: card.interactive_element,
      requiredAssets: card.required_assets,
      designRisks: body.designRisks,
    });

    if (!eligible) {
      return jsonResponse({ error: "Scene is not ready", missing: missingReasons }, 400);
    }
  }

  const { error: updateError } = await supabase
    .from("scene_cards")
    .update({
      status: body.status,
      creator_notes: body.notes,
      design_risks: body.designRisks,
      updated_at: new Date().toISOString(),
    })
    .eq("scene_id", id)
    .eq("user_id", user.id);

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500);
  }

  const record: SceneCardRecord = {
    playerGoal: card.player_goal,
    obstacle: card.obstacle,
    characters: card.characters,
    interactiveElement: card.interactive_element,
    requiredAssets: card.required_assets,
    status: body.status,
    notes: body.notes,
    designRisks: body.designRisks,
  };

  return jsonResponse(record, 200);
};
