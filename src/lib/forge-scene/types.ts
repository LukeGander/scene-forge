export interface CharacterMention {
  name: string;
  function: string;
}

export interface SceneCardFields {
  playerGoal: string;
  obstacle: string;
  characters: CharacterMention[]; // empty = "none / not applicable" for this slice
  interactiveElement: string;
  requiredAssets: string[]; // empty renders as "not enough context"
  designRisks: string[]; // acknowledge/clear (FR-022) is out of scope — added by S-03
}

export interface ForgeSceneInput {
  projectTitle: string;
  projectPremise: string;
  projectTone: string;
  sceneTitle: string;
  sceneNote: string;
}
