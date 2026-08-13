import type { ForgeSceneInput, SceneCardFields } from "@/lib/forge-scene/types";

export const NOT_ENOUGH_CONTEXT = "not enough context";

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * Deterministic, dependency-free scene card generator used whenever no
 * Anthropic key is configured. Characters always resolve to "none /
 * not applicable" for this slice since character entities don't exist yet.
 */
export function generateMockSceneCard(input: ForgeSceneInput): SceneCardFields {
  const sentences = splitSentences(input.sceneNote);

  return {
    playerGoal: sentences[0] ?? NOT_ENOUGH_CONTEXT,
    obstacle: sentences[1] ?? NOT_ENOUGH_CONTEXT,
    characters: [],
    interactiveElement: NOT_ENOUGH_CONTEXT,
    requiredAssets: [],
    designRisks: [],
  };
}
