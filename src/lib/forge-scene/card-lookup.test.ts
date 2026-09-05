import { describe, it, expect } from "vitest";
import { resolveSceneCardLookup } from "@/lib/forge-scene/card-lookup";

describe("resolveSceneCardLookup", () => {
  it("does not treat a scene-card query error as 'no card exists'", () => {
    const queryError = { message: "connection terminated unexpectedly" };

    expect(() => resolveSceneCardLookup(null, queryError)).toThrow();
  });
});
