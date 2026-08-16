import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { generateSceneCard } from "@/lib/forge-scene/adapter";
import { ANTHROPIC_API_KEY } from "astro:env/server";
import type { SceneCardFields } from "@/lib/forge-scene/types";

interface SceneRow {
  id: string;
  title: string;
  note: string;
  project_id: string;
}

interface ProjectRow {
  title: string;
  premise: string;
  tone: string;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const POST: APIRoute = async (context) => {
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

  const { data: scene, error: sceneError } = await supabase
    .from("scenes")
    .select("id, title, note, project_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single<SceneRow>();

  // no-unnecessary-condition misreads Supabase's conditional response-union type here;
  // `scene`/`error` are genuinely nullable at runtime (verified via `astro check`).
  /* eslint-disable @typescript-eslint/no-unnecessary-condition */
  if (sceneError || !scene) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("title, premise, tone")
    .eq("id", scene.project_id)
    .eq("user_id", user.id)
    .single<ProjectRow>();

  if (projectError || !project) {
    return jsonResponse({ error: "Not found" }, 404);
  }
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */

  let card: SceneCardFields;
  let source: "mock" | "anthropic";
  try {
    const result = await generateSceneCard(
      {
        projectTitle: project.title,
        projectPremise: project.premise,
        projectTone: project.tone,
        sceneTitle: scene.title,
        sceneNote: scene.note,
      },
      ANTHROPIC_API_KEY,
    );
    card = result.card;
    source = result.source;
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Scene card generation failed" }, 502);
  }

  const { error: upsertError } = await supabase.from("scene_cards").upsert(
    {
      scene_id: scene.id,
      user_id: user.id,
      status: "draft",
      player_goal: card.playerGoal,
      obstacle: card.obstacle,
      characters: card.characters,
      interactive_element: card.interactiveElement,
      required_assets: card.requiredAssets,
      design_risks: card.designRisks,
      generation_source: source,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "scene_id" },
  );

  if (upsertError) {
    return jsonResponse({ error: upsertError.message }, 500);
  }

  return jsonResponse({ card, source }, 200);
};
