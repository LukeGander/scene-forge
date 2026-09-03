import { describe, it, expect } from "vitest";
import { createTestUser, apiFetch } from "@/lib/test-support/auth-fixture";

async function createProject(cookie: string, title: string): Promise<string> {
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

async function createScene(cookie: string, projectId: string, note: string): Promise<string> {
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

describe("PATCH /api/scenes/[id]/note", () => {
  it("rejects unauthenticated requests", async () => {
    const owner = await createTestUser("note-unauth");
    const projectId = await createProject(owner.cookie, "Note Project");
    const sceneId = await createScene(owner.cookie, projectId, "Original note.");

    const response = await apiFetch(null, `/api/scenes/${sceneId}/note`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Attempted update." }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Not authenticated" });
  });

  it("returns 404 when the scene belongs to another user", async () => {
    const owner = await createTestUser("note-owner");
    const intruder = await createTestUser("note-intruder");
    const projectId = await createProject(owner.cookie, "Note Project");
    const sceneId = await createScene(owner.cookie, projectId, "Original note.");

    const response = await apiFetch(intruder.cookie, `/api/scenes/${sceneId}/note`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Intruder update." }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("updates the note for the scene owner", async () => {
    const owner = await createTestUser("note-self");
    const projectId = await createProject(owner.cookie, "Note Project");
    const sceneId = await createScene(owner.cookie, projectId, "Original note.");

    const response = await apiFetch(owner.cookie, `/api/scenes/${sceneId}/note`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Updated note text." }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { note: string; updatedAt: string };
    expect(body.note).toBe("Updated note text.");
  });
});
