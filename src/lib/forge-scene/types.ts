export interface CharacterMention {
  name: string;
  function: string;
}

export type SceneStatus = "draft" | "needs_work" | "ready";

export interface DesignRisk {
  risk: string;
  acknowledged: boolean;
}

export interface SceneCardFields {
  playerGoal: string;
  obstacle: string;
  characters: CharacterMention[]; // empty = "none / not applicable" for this slice
  interactiveElement: string;
  requiredAssets: string[]; // empty renders as "not enough context"
  designRisks: DesignRisk[];
}

export interface SceneCardRecord extends SceneCardFields {
  status: SceneStatus;
  notes: string;
}

export interface ForgeSceneInput {
  projectTitle: string;
  projectPremise: string;
  projectTone: string;
  sceneTitle: string;
  sceneNote: string;
}
