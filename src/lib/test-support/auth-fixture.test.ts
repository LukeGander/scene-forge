import { describe, it, expect } from "vitest";
import { createTestUser } from "@/lib/test-support/auth-fixture";

describe("createTestUser", () => {
  it("creates two distinct authenticated users", async () => {
    const userA = await createTestUser("a");
    const userB = await createTestUser("b");

    expect(userA.email).not.toBe(userB.email);
    expect(userA.cookie).not.toBe("");
    expect(userB.cookie).not.toBe("");
    expect(userA.cookie).not.toBe(userB.cookie);
  });
});
