import { generateMockSceneCard } from "@/lib/forge-scene/mock";
import { generateSceneCardWithAnthropic } from "@/lib/forge-scene/anthropic";
import type { ForgeSceneInput, SceneCardFields } from "@/lib/forge-scene/types";

export type GenerationSource = "mock" | "anthropic";

export interface GenerateSceneCardResult {
  card: SceneCardFields;
  source: GenerationSource;
}

/**
 * Single entry point the forge API route calls. `apiKey` is passed in
 * (rather than read from `astro:env/server` here) so this module stays
 * a plain, dependency-free function importable from Vitest without the
 * Astro runtime — the Astro env module is only resolvable inside Astro
 * itself. The caller (Phase 3's forge route) reads `ANTHROPIC_API_KEY`
 * and forwards it here.
 */
export async function generateSceneCard(
  input: ForgeSceneInput,
  apiKey: string | null | undefined,
): Promise<GenerateSceneCardResult> {
  if (!apiKey) {
    console.log("[forge-scene] no ANTHROPIC_API_KEY configured, using mock generator");
    return { card: generateMockSceneCard(input), source: "mock" };
  }

  console.log("[forge-scene] generating scene card via Anthropic");
  try {
    const card = await generateSceneCardWithAnthropic(input, apiKey);
    console.log("[forge-scene] Anthropic generation succeeded");
    return { card, source: "anthropic" };
  } catch (error) {
    console.error("[forge-scene] Anthropic generation failed:", error instanceof Error ? error.message : error);
    throw error;
  }
}
