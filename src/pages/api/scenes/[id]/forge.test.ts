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

describe("POST /api/scenes/[id]/forge", () => {
  it("rejects unauthenticated requests", async () => {
    const owner = await createTestUser("forge-unauth");
    const projectId = await createProject(owner.cookie, "Forge Project");
    const sceneId = await createScene(owner.cookie, projectId, "A hero must escape. A guard blocks the door.");

    const response = await apiFetch(null, `/api/scenes/${sceneId}/forge`, { method: "POST" });

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
    expect(body.source).toBe("mock");
  });
});
