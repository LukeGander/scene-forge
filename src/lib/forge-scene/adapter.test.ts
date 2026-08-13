import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateMockSceneCard, NOT_ENOUGH_CONTEXT } from "@/lib/forge-scene/mock";
import type { ForgeSceneInput } from "@/lib/forge-scene/types";

vi.mock("@/lib/forge-scene/anthropic", () => ({
  generateSceneCardWithAnthropic: vi.fn(),
}));

import { generateSceneCardWithAnthropic } from "@/lib/forge-scene/anthropic";
import { generateSceneCard } from "@/lib/forge-scene/adapter";

const baseInput: ForgeSceneInput = {
  projectTitle: "Test Project",
  projectPremise: "A test premise.",
  projectTone: "whimsical",
  sceneTitle: "Test Scene",
  sceneNote: "The hero must find the key. A locked door blocks the exit.",
};

describe("generateMockSceneCard", () => {
  it("is deterministic for the same input", () => {
    const first = generateMockSceneCard(baseInput);
    const second = generateMockSceneCard(baseInput);
    expect(first).toEqual(second);
  });

  it("derives playerGoal/obstacle from the first two sentences of the note", () => {
    const card = generateMockSceneCard(baseInput);
    expect(card.playerGoal).toBe("The hero must find the key.");
    expect(card.obstacle).toBe("A locked door blocks the exit.");
  });

  it("falls back to 'not enough context' for fields it can't derive", () => {
    const card = generateMockSceneCard(baseInput);
    expect(card.interactiveElement).toBe(NOT_ENOUGH_CONTEXT);
    expect(card.requiredAssets).toEqual([]);
    expect(card.designRisks).toEqual([]);
    expect(card.characters).toEqual([]);
  });

  it("falls back to 'not enough context' for playerGoal/obstacle on an empty note", () => {
    const card = generateMockSceneCard({ ...baseInput, sceneNote: "" });
    expect(card.playerGoal).toBe(NOT_ENOUGH_CONTEXT);
    expect(card.obstacle).toBe(NOT_ENOUGH_CONTEXT);
  });
});

describe("generateSceneCard (adapter)", () => {
  beforeEach(() => {
    vi.mocked(generateSceneCardWithAnthropic).mockReset();
  });

  it("uses the mock path when no API key is provided", async () => {
    const result = await generateSceneCard(baseInput, undefined);

    expect(result.source).toBe("mock");
    expect(generateSceneCardWithAnthropic).not.toHaveBeenCalled();
  });

  it("uses the Anthropic path when an API key is provided", async () => {
    const fakeCard = { ...generateMockSceneCard(baseInput), playerGoal: "real goal" };
    vi.mocked(generateSceneCardWithAnthropic).mockResolvedValue(fakeCard);

    const result = await generateSceneCard(baseInput, "sk-test-key");

    expect(result.source).toBe("anthropic");
    expect(result.card).toEqual(fakeCard);
    expect(generateSceneCardWithAnthropic).toHaveBeenCalledWith(baseInput, "sk-test-key");
  });

  it("propagates an Anthropic failure as an error rather than a partial card", async () => {
    vi.mocked(generateSceneCardWithAnthropic).mockRejectedValue(new Error("upstream failure"));

    await expect(generateSceneCard(baseInput, "sk-test-key")).rejects.toThrow("upstream failure");
  });
});
