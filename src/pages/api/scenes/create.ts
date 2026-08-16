import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const projectId = (form.get("projectId") as string | null) ?? "";
  const title = (form.get("title") as string | null)?.trim() ?? "";
  const note = (form.get("note") as string | null)?.trim() ?? "";

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(
      `/projects/${projectId}/scenes/new?error=${encodeURIComponent("Supabase is not configured")}`,
    );
  }

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  if (!projectId || !title || !note) {
    return context.redirect(
      `/projects/${projectId}/scenes/new?error=${encodeURIComponent("Title and scene note are required")}`,
    );
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .single<{ id: string }>();

  // no-unnecessary-condition misreads Supabase's conditional response-union type here;
  // `data`/`error` are genuinely nullable at runtime (verified via `astro check`).
  /* eslint-disable @typescript-eslint/no-unnecessary-condition */
  if (projectError || !project) {
    return new Response("Not found", { status: 404 });
  }

  const { data: scene, error: sceneError } = await supabase
    .from("scenes")
    .insert({ project_id: project.id, user_id: user.id, title, note })
    .select("id")
    .single<{ id: string }>();

  if (sceneError || !scene) {
    return context.redirect(
      `/projects/${projectId}/scenes/new?error=${encodeURIComponent(sceneError?.message ?? "Could not save scene note")}`,
    );
  }
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */

  return context.redirect(`/scenes/${scene.id}`);
};
