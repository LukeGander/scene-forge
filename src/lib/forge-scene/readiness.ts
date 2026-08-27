import type { SceneCardFields } from "@/lib/forge-scene/types";
import { NOT_ENOUGH_CONTEXT } from "@/lib/forge-scene/mock";

function isMeaningful(value: string): boolean {
  return value.trim().length > 0 && value !== NOT_ENOUGH_CONTEXT;
}

export function isReadyEligible(card: SceneCardFields): { eligible: boolean; missingReasons: string[] } {
  const missingReasons: string[] = [];

  if (!isMeaningful(card.playerGoal)) {
    missingReasons.push("Player goal is missing");
  }
  if (!isMeaningful(card.obstacle)) {
    missingReasons.push("Obstacle is missing");
  }
  if (!isMeaningful(card.interactiveElement)) {
    missingReasons.push("Interactive element or puzzle is missing");
  }
  if (card.requiredAssets.length === 0) {
    missingReasons.push("Required assets are missing");
  }

  const charactersMissingFunction = card.characters.some((character) => !isMeaningful(character.function));
  if (charactersMissingFunction) {
    missingReasons.push("Every character needs a function");
  }

  const hasUnacknowledgedRisk = card.designRisks.some((risk) => !risk.acknowledged);
  if (hasUnacknowledgedRisk) {
    missingReasons.push("All design risks must be acknowledged");
  }

  return { eligible: missingReasons.length === 0, missingReasons };
}
