import { describe, it, expect } from "vitest";
import { createTestUser, apiFetch } from "@/lib/test-support/auth-fixture";
import type { TestUser } from "@/lib/test-support/auth-fixture";
import { createProject, createScene } from "@/lib/test-support/scene-fixtures";

async function seedSceneWithCard(label: string): Promise<{ owner: TestUser; sceneId: string }> {
  const owner = await createTestUser(label);
  const projectId = await createProject(owner.cookie, "Card Test Project");
  const sceneId = await createScene(owner.cookie, projectId, "A hero must escape. A guard blocks the door.");

  const forgeResponse = await apiFetch(owner.cookie, `/api/scenes/${sceneId}/forge`, { method: "POST" });
  if (forgeResponse.status !== 200) {
    throw new Error(`Unexpected forge status while seeding card: ${forgeResponse.status}`);
  }

  return { owner, sceneId };
}

const VALID_UPDATE = { status: "draft", notes: "", designRisks: [] };

describe("PATCH /api/scenes/[id]/card", () => {
  it("rejects unauthenticated requests", async () => {
    const { sceneId } = await seedSceneWithCard("card-unauth");

    const response = await apiFetch(null, `/api/scenes/${sceneId}/card`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_UPDATE),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Not authenticated" });
  });

  it("returns 404 when the scene card belongs to another user", async () => {
    const { sceneId } = await seedSceneWithCard("card-owner");
    const intruder = await createTestUser("card-intruder");

    const response = await apiFetch(intruder.cookie, `/api/scenes/${sceneId}/card`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_UPDATE),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("updates the card when the owner submits a valid PATCH", async () => {
    const { owner, sceneId } = await seedSceneWithCard("card-self");

    const response = await apiFetch(owner.cookie, `/api/scenes/${sceneId}/card`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "needs_work", notes: "Add more tension.", designRisks: [] }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; notes: string };
    expect(body.status).toBe("needs_work");
    expect(body.notes).toBe("Add more tension.");
  });
});
