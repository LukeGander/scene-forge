import Anthropic from "@anthropic-ai/sdk";
import type { ForgeSceneInput, SceneCardFields } from "@/lib/forge-scene/types";

// Not pinned anywhere upstream (infrastructure.md / tech-stack.md); confirm against
// current Anthropic docs before relying on this in production.
const MODEL = "claude-sonnet-5";

const TOOL_NAME = "emit_scene_card";

const SYSTEM_PROMPT = `You are Forge Scene, part of a tool that evaluates point-and-click adventure game scenes for production readiness.

A point-and-click scene has a required anatomy:
- player goal
- obstacle
- characters present in the scene and their function (if any are given in context)
- an interactive element or puzzle
- required assets
- design risks or missing elements (logic gaps that would block production)

Evaluate the scene note against this anatomy using the project and scene context provided. Call the ${TOOL_NAME} tool with your evaluation.

For any field the note does not give you enough information to determine, set it to the literal string "not enough context" (or an empty array for list fields) — never guess, invent, or omit a field. Every field must always be present.`;

const SCENE_CARD_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description: "Emit a structured scene card evaluating a scene note against the required scene anatomy.",
  input_schema: {
    type: "object",
    properties: {
      playerGoal: { type: "string" },
      obstacle: { type: "string" },
      characters: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            function: { type: "string" },
          },
          required: ["name", "function"],
        },
      },
      interactiveElement: { type: "string" },
      requiredAssets: { type: "array", items: { type: "string" } },
      designRisks: { type: "array", items: { type: "string" } },
    },
    required: ["playerGoal", "obstacle", "characters", "interactiveElement", "requiredAssets", "designRisks"],
  },
};

export class ForgeSceneGenerationError extends Error {}

function buildUserMessage(input: ForgeSceneInput): string {
  return `Project: ${input.projectTitle}
Premise: ${input.projectPremise}
Tone: ${input.projectTone}

Scene: ${input.sceneTitle}
Note: ${input.sceneNote}`;
}

interface RawSceneCardFields extends Omit<SceneCardFields, "designRisks"> {
  designRisks: string[];
}

function isRawSceneCardFields(value: unknown): value is RawSceneCardFields {
  if (!value || typeof value !== "object") return false;
  const card = value as Record<string, unknown>;
  return (
    typeof card.playerGoal === "string" &&
    typeof card.obstacle === "string" &&
    Array.isArray(card.characters) &&
    typeof card.interactiveElement === "string" &&
    Array.isArray(card.requiredAssets) &&
    Array.isArray(card.designRisks)
  );
}

export async function generateSceneCardWithAnthropic(input: ForgeSceneInput, apiKey: string): Promise<SceneCardFields> {
  const client = new Anthropic({ apiKey });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(input) }],
      tools: [SCENE_CARD_TOOL],
      tool_choice: { type: "tool", name: TOOL_NAME },
    });
  } catch (error) {
    throw new ForgeSceneGenerationError(
      `Anthropic request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || !isRawSceneCardFields(toolUse.input)) {
    throw new ForgeSceneGenerationError("Anthropic response did not contain a valid scene card");
  }

  const raw = toolUse.input;
  return {
    ...raw,
    designRisks: raw.designRisks.map((risk) => ({ risk, acknowledged: false })),
  };
}
