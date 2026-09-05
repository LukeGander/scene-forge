import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

interface CleanupBody {
  projectId: string;
}

function isCleanupBody(value: unknown): value is CleanupBody {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.projectId === "string" && candidate.projectId.length > 0;
}

export const POST: APIRoute = async (context) => {
  // Test-support only: not reachable unless the server was started with
  // `--mode test` (see playwright.config.ts's webServer.command). Astro/Vite
  // sets import.meta.env.MODE from that flag — no new env var introduced.
  if (import.meta.env.MODE !== "test") {
    return new Response("Not found", { status: 404 });
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return jsonResponse({ error: "Supabase is not configured" }, 500);
  }

  const user = context.locals.user;
  if (!user) {
    return jsonResponse({ error: "Not authenticated" }, 401);
  }

  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  if (!isCleanupBody(body)) {
    return jsonResponse({ error: "projectId is required" }, 400);
  }

  // Same anon-key, RLS-scoped client every other route uses — no service-role
  // key. The .eq("user_id", user.id) is belt-and-braces alongside RLS itself;
  // ON DELETE CASCADE on scenes/scene_cards removes the rest.
  const { error } = await supabase.from("projects").delete().eq("id", body.projectId).eq("user_id", user.id);

  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  return new Response(null, { status: 204 });
};
