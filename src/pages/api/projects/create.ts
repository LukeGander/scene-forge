import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const title = (form.get("title") as string | null)?.trim() ?? "";
  const premise = (form.get("premise") as string | null)?.trim() ?? "";
  const tone = (form.get("tone") as string | null)?.trim() ?? "";

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/projects/new?error=${encodeURIComponent("Supabase is not configured")}`);
  }

  const user = context.locals.user;
  if (!user) {
    return context.redirect("/auth/signin");
  }

  if (!title || !premise || !tone) {
    return context.redirect(`/projects/new?error=${encodeURIComponent("Title, premise, and tone are all required")}`);
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, title, premise, tone })
    .select("id")
    .single<{ id: string }>();

  // no-unnecessary-condition misreads Supabase's conditional response-union type here;
  // `data`/`error` are genuinely nullable at runtime (verified via `astro check`).
  /* eslint-disable @typescript-eslint/no-unnecessary-condition */
  if (error || !data) {
    return context.redirect(`/projects/new?error=${encodeURIComponent(error?.message ?? "Could not create project")}`);
  }
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */

  return context.redirect(`/projects/${data.id}/scenes/new`);
};
