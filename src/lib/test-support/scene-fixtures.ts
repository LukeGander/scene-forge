import { apiFetch } from "@/lib/test-support/auth-fixture";

/** Creates a project as the given user via the real route; returns its id. */
export async function createProject(cookie: string, title: string): Promise<string> {
  const response = await apiFetch(cookie, "/api/projects/create", {
    method: "POST",
    body: new URLSearchParams({ title, premise: "A premise.", tone: "Tone" }),
  });
  const location = response.headers.get("location") ?? "";
  const match = /^\/projects\/([^/]+)\/scenes\/new$/.exec(location);
  if (!match) {
    throw new Error(`Unexpected projects/create redirect: ${location}`);
  }
  return match[1];
}

/** Creates a scene under `projectId` as the given user via the real route; returns its id. */
export async function createScene(cookie: string, projectId: string, note: string): Promise<string> {
  const response = await apiFetch(cookie, "/api/scenes/create", {
    method: "POST",
    body: new URLSearchParams({ projectId, title: "Scene", note }),
  });
  const location = response.headers.get("location") ?? "";
  const match = /^\/scenes\/([^/]+)$/.exec(location);
  if (!match) {
    throw new Error(`Unexpected scenes/create redirect: ${location}`);
  }
  return match[1];
}
