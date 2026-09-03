import { describe, it, expect } from "vitest";
import { createTestUser, apiFetch } from "@/lib/test-support/auth-fixture";
import { createProject } from "@/lib/test-support/scene-fixtures";

describe("POST /api/scenes/create", () => {
  it("redirects unauthenticated requests to sign-in without creating a scene", async () => {
    const response = await apiFetch(null, "/api/scenes/create", {
      method: "POST",
      body: new URLSearchParams({ projectId: "irrelevant", title: "S", note: "N" }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/auth/signin");
  });

  it("returns 404 when the projectId belongs to another user", async () => {
    const owner = await createTestUser("scenes-create-owner");
    const intruder = await createTestUser("scenes-create-intruder");
    const projectId = await createProject(owner.cookie, "Owner Project");

    const response = await apiFetch(intruder.cookie, "/api/scenes/create", {
      method: "POST",
      body: new URLSearchParams({ projectId, title: "Intruder Scene", note: "N" }),
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });

  it("creates a scene scoped to the authenticated creator when they own the project", async () => {
    const owner = await createTestUser("scenes-create-self");
    const projectId = await createProject(owner.cookie, "Self Project");

    const response = await apiFetch(owner.cookie, "/api/scenes/create", {
      method: "POST",
      body: new URLSearchParams({
        projectId,
        title: "My Scene",
        note: "A hero must escape. A guard blocks the door.",
      }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(/^\/scenes\/[^/]+$/);
  });
});
