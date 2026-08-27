import { describe, it, expect } from "vitest";
import { isReadyEligible } from "@/lib/forge-scene/readiness";
import { NOT_ENOUGH_CONTEXT } from "@/lib/forge-scene/mock";
import type { SceneCardFields } from "@/lib/forge-scene/types";

const completeCard: SceneCardFields = {
  playerGoal: "Find the key.",
  obstacle: "A locked door blocks the exit.",
  characters: [],
  interactiveElement: "A rusty lever opens the door.",
  requiredAssets: ["key sprite", "door sprite"],
  designRisks: [],
};

describe("isReadyEligible", () => {
  it("is eligible when every criterion is met", () => {
    expect(isReadyEligible(completeCard)).toEqual({ eligible: true, missingReasons: [] });
  });

  it("is not eligible when playerGoal is missing", () => {
    const result = isReadyEligible({ ...completeCard, playerGoal: NOT_ENOUGH_CONTEXT });
    expect(result.eligible).toBe(false);
    expect(result.missingReasons).toContain("Player goal is missing");
  });

  it("is not eligible when obstacle is missing", () => {
    const result = isReadyEligible({ ...completeCard, obstacle: "" });
    expect(result.eligible).toBe(false);
    expect(result.missingReasons).toContain("Obstacle is missing");
  });

  it("is not eligible when interactiveElement is missing", () => {
    const result = isReadyEligible({ ...completeCard, interactiveElement: NOT_ENOUGH_CONTEXT });
    expect(result.eligible).toBe(false);
    expect(result.missingReasons).toContain("Interactive element or puzzle is missing");
  });

  it("is not eligible when requiredAssets is empty", () => {
    const result = isReadyEligible({ ...completeCard, requiredAssets: [] });
    expect(result.eligible).toBe(false);
    expect(result.missingReasons).toContain("Required assets are missing");
  });

  it("is eligible when designRisks is empty", () => {
    const result = isReadyEligible({ ...completeCard, designRisks: [] });
    expect(result.eligible).toBe(true);
  });

  it("is eligible when all designRisks are acknowledged", () => {
    const result = isReadyEligible({
      ...completeCard,
      designRisks: [
        { risk: "Puzzle logic unclear", acknowledged: true },
        { risk: "Missing lighting cue", acknowledged: true },
      ],
    });
    expect(result.eligible).toBe(true);
  });

  it("is not eligible when one designRisk is unacknowledged", () => {
    const result = isReadyEligible({
      ...completeCard,
      designRisks: [
        { risk: "Puzzle logic unclear", acknowledged: true },
        { risk: "Missing lighting cue", acknowledged: false },
      ],
    });
    expect(result.eligible).toBe(false);
    expect(result.missingReasons).toContain("All design risks must be acknowledged");
  });

  it("treats an empty characters array as vacuously passing the function check", () => {
    const result = isReadyEligible({ ...completeCard, characters: [] });
    expect(result.eligible).toBe(true);
  });

  it("is not eligible when a character has an empty or sentinel function", () => {
    const result = isReadyEligible({
      ...completeCard,
      characters: [{ name: "Guard", function: NOT_ENOUGH_CONTEXT }],
    });
    expect(result.eligible).toBe(false);
    expect(result.missingReasons).toContain("Every character needs a function");
  });
});
