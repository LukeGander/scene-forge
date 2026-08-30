export function isCardStale(sceneUpdatedAt: string, cardGeneratedAt: string): boolean {
  return new Date(sceneUpdatedAt).getTime() > new Date(cardGeneratedAt).getTime();
}
