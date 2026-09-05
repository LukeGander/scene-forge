import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const DELETE: APIRoute = async (context) => {
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

  // A bare .delete() does not error on a zero-row match (RLS silently blocks a
  // cross-user row rather than raising an error), so chaining .select().single()
  // forces a real Postgrest error when the target row didn't match this user —
  // the same idiom every existing ownership-scoped SELECT in this codebase uses.
  const { error } = await supabase.from("scenes").delete().eq("id", id).eq("user_id", user.id).select("id").single();

  if (error) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  return new Response(null, { status: 204 });
};
