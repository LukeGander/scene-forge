import { describe, it, expect } from "vitest";
import { createTestUser, apiFetch } from "@/lib/test-support/auth-fixture";
import { createProject, createScene } from "@/lib/test-support/scene-fixtures";

// Syntactically valid but non-existent scene id — the route checks auth
// before touching this param, so no real fixture is needed for this case.
const NONEXISTENT_SCENE_ID = "00000000-0000-0000-0000-000000000000";

describe("PATCH /api/scenes/[id]/note", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await apiFetch(null, `/api/scenes/${NONEXISTENT_SCENE_ID}/note`, {
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
