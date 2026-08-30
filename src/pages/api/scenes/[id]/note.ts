import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

interface NoteUpdateBody {
  note: string;
}

function isNoteUpdateBody(value: unknown): value is NoteUpdateBody {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.note === "string" && candidate.note.trim().length > 0;
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

  if (!isNoteUpdateBody(body)) {
    return jsonResponse({ error: "Scene note is required" }, 400);
  }

  const updatedAt = new Date().toISOString();

  const { data: scene, error: updateError } = await supabase
    .from("scenes")
    .update({ note: body.note, updated_at: updatedAt })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("note, updated_at")
    .single<{ note: string; updated_at: string }>();

  // no-unnecessary-condition misreads Supabase's conditional response-union type here;
  // `scene`/`updateError` are genuinely nullable at runtime (verified via `astro check`).
  /* eslint-disable @typescript-eslint/no-unnecessary-condition */
  if (updateError || !scene) {
    return jsonResponse({ error: "Not found" }, 404);
  }
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */

  return jsonResponse({ note: scene.note, updatedAt: scene.updated_at }, 200);
};
