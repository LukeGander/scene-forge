import { describe, it, expect } from "vitest";
import { isCardStale } from "@/lib/forge-scene/staleness";

describe("isCardStale", () => {
  it("is not stale when the card was generated after the scene was last updated", () => {
    expect(isCardStale("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:01.000Z")).toBe(false);
  });

  it("is stale when the scene note was updated after the card was generated", () => {
    expect(isCardStale("2026-01-01T00:00:01.000Z", "2026-01-01T00:00:00.000Z")).toBe(true);
  });

  it("is not stale when the timestamps are equal", () => {
    expect(isCardStale("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toBe(false);
  });
});
