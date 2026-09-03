import { describe, it, expect } from "vitest";
import { createTestUser, apiFetch } from "@/lib/test-support/auth-fixture";
import { createProject, createScene } from "@/lib/test-support/scene-fixtures";

// Syntactically valid but non-existent scene id — the route checks auth
// before touching this param, so no real fixture is needed for this case.
const NONEXISTENT_SCENE_ID = "00000000-0000-0000-0000-000000000000";

describe("POST /api/scenes/[id]/forge", () => {
  it("rejects unauthenticated requests", async () => {
    const response = await apiFetch(null, `/api/scenes/${NONEXISTENT_SCENE_ID}/forge`, { method: "POST" });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Not authenticated" });
  });

  it("returns 404 when the scene belongs to another user", async () => {
    const owner = await createTestUser("forge-owner");
    const intruder = await createTestUser("forge-intruder");
    const projectId = await createProject(owner.cookie, "Forge Project");
    const sceneId = await createScene(owner.cookie, projectId, "A hero must escape. A guard blocks the door.");

    const response = await apiFetch(intruder.cookie, `/api/scenes/${sceneId}/forge`, { method: "POST" });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("generates a card for the scene owner", async () => {
    const owner = await createTestUser("forge-self");
    const projectId = await createProject(owner.cookie, "Forge Project");
    const sceneId = await createScene(owner.cookie, projectId, "A hero must escape. A guard blocks the door.");

    const response = await apiFetch(owner.cookie, `/api/scenes/${sceneId}/forge`, { method: "POST" });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { card: unknown; source: string };
    expect(body.card).toBeTruthy();
    // Requires the dev server to be started with the mock Anthropic path forced
    // (see test-plan.md §6.1's .env.test/--mode test precondition) — otherwise
    // this assertion fails after making a real, billed Anthropic call.
    expect(body.source).toBe("mock");
  });
});
