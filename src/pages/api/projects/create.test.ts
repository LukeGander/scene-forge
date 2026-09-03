import { describe, it, expect } from "vitest";
import { createTestUser, apiFetch } from "@/lib/test-support/auth-fixture";

describe("POST /api/projects/create", () => {
  it("redirects unauthenticated requests to sign-in without creating a project", async () => {
    const response = await apiFetch(null, "/api/projects/create", {
      method: "POST",
      body: new URLSearchParams({ title: "T", premise: "P", tone: "Tone" }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/auth/signin");
  });

  it("creates a project scoped to the authenticated creator", async () => {
    const user = await createTestUser("projects-create-owner");

    const response = await apiFetch(user.cookie, "/api/projects/create", {
      method: "POST",
      body: new URLSearchParams({ title: "Heist", premise: "A vault job.", tone: "Tense" }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(/^\/projects\/[^/]+\/scenes\/new$/);
  });
});
