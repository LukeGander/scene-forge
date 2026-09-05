import { describe, it, expect } from "vitest";
import { createTestUser, apiFetch } from "@/lib/test-support/auth-fixture";
import { createProject, createScene } from "@/lib/test-support/scene-fixtures";

// Syntactically valid but non-existent scene id — the route checks auth
// before touching this param, so no real fixture is needed for this case.
const NONEXISTENT_SCENE_ID = "00000000-0000-0000-0000-000000000000";

describe("DELETE /api/scenes/[id]", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await apiFetch(null, `/api/scenes/${NONEXISTENT_SCENE_ID}`, { method: "DELETE" });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Not authenticated" });
  });

  it("returns 404 when the scene belongs to another user, and does not delete it", async () => {
    const owner = await createTestUser("delete-owner");
    const intruder = await createTestUser("delete-intruder");
    const projectId = await createProject(owner.cookie, "Delete Project");
    const sceneId = await createScene(owner.cookie, projectId, "Original note.");

    const response = await apiFetch(intruder.cookie, `/api/scenes/${sceneId}`, { method: "DELETE" });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });

    // The scene must still exist — proven by the owner successfully patching its note.
    const stillExists = await apiFetch(owner.cookie, `/api/scenes/${sceneId}/note`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Still here." }),
    });
    expect(stillExists.status).toBe(200);
  });

  it("deletes the scene and its cascaded scene card for the owner", async () => {
    const owner = await createTestUser("delete-self");
    const projectId = await createProject(owner.cookie, "Delete Project");
    const sceneId = await createScene(owner.cookie, projectId, "Original note.");

    const forgeResponse = await apiFetch(owner.cookie, `/api/scenes/${sceneId}/forge`, { method: "POST" });
    expect(forgeResponse.status).toBe(200);

    const response = await apiFetch(owner.cookie, `/api/scenes/${sceneId}`, { method: "DELETE" });
    expect(response.status).toBe(204);

    // Both the scene and its cascaded scene_card row are gone — proven by the
    // owner's own note PATCH now 404ing against the (no longer existing) scene.
    const goneNow = await apiFetch(owner.cookie, `/api/scenes/${sceneId}/note`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Should not land." }),
    });
    expect(goneNow.status).toBe(404);
  }, 15000);
});
