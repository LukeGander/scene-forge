// risk: test-plan.md #5 — after a Save round-trip, the rendered UI state
// (status, notes) must match exactly what was persisted, not just what the
// client optimistically assumed ("a 200 response means the UI reflects it
// correctly" is the failure mode this protects against).
// seed: tests/e2e/seed.spec.ts
import { test, expect } from "@playwright/test";

test("Risk #5: card status and notes match persisted state after Save and reload", async ({ page, baseURL }) => {
  if (!baseURL) {
    throw new Error("baseURL is not configured in playwright.config.ts");
  }
  const origin = new URL(baseURL).origin;

  const uniqueId = Date.now();
  const projectTitle = `E2E Round-Trip Project ${uniqueId}`;
  const sceneTitle = `E2E Round-Trip Scene ${uniqueId}`;
  const updatedNotes = `Persisted notes check ${uniqueId}`;

  // Setup step 1: create the project via the real route. Not yet inside
  // try/finally — nothing exists to clean up until this succeeds.
  const projectResponse = await page.request.post("/api/projects/create", {
    headers: { Origin: origin },
    form: { title: projectTitle, premise: "A premise for the round-trip scenario.", tone: "Tense" },
    maxRedirects: 0,
  });
  // no-unnecessary-condition misreads Playwright's headers() return type here;
  // an absent header is genuinely undefined at runtime (verified via astro check).
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const projectLocation = projectResponse.headers().location ?? "";
  const projectMatch = /^\/projects\/([^/]+)\/scenes\/new$/.exec(projectLocation);
  if (!projectMatch) {
    throw new Error(`Unexpected projects/create redirect: ${projectLocation}`);
  }
  const projectId = projectMatch[1];

  try {
    // Setup step 2: scene, then a generated card via the real forge route.
    const sceneResponse = await page.request.post("/api/scenes/create", {
      headers: { Origin: origin },
      form: { projectId, title: sceneTitle, note: "A scene note for the round-trip scenario." },
      maxRedirects: 0,
    });
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see note above
    const sceneLocation = sceneResponse.headers().location ?? "";
    const sceneMatch = /^\/scenes\/([^/]+)$/.exec(sceneLocation);
    if (!sceneMatch) {
      throw new Error(`Unexpected scenes/create redirect: ${sceneLocation}`);
    }
    const sceneId = sceneMatch[1];

    const forgeResponse = await page.request.post(`/api/scenes/${sceneId}/forge`, {
      headers: { Origin: origin },
    });
    expect(forgeResponse.ok()).toBe(true);
    const forgeBody = (await forgeResponse.json()) as { source?: string };
    expect(forgeBody.source).toBe("mock"); // proves no real Anthropic API call happened

    // Risk-protecting action, through the real rendered UI.
    await page.goto(`/scenes/${sceneId}`);
    await expect(page.getByRole("heading", { name: sceneTitle })).toBeVisible();

    // Retry the action as a unit, but ONLY until a real PATCH response is
    // observed — same pre-hydration inert-click issue as seed.spec.ts applies
    // to this `client:load` island too. The persisted-state assertions below
    // are separate and un-retried: if the round-trip silently drops state,
    // that must fail on its own, not be papered over by re-saving.
    await expect(async () => {
      const cardPatchResponsePromise = page.waitForResponse(
        (response) => response.url().endsWith(`/api/scenes/${sceneId}/card`) && response.request().method() === "PATCH",
        { timeout: 2000 },
      );
      await page.getByRole("button", { name: "Needs Work", exact: true }).click();
      await page.getByPlaceholder("Freeform notes or corrections...").fill(updatedNotes);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      const cardPatchResponse = await cardPatchResponsePromise;
      expect(cardPatchResponse.ok()).toBe(true);
    }).toPass();

    // Holds immediately after Save...
    await expect(page.getByRole("button", { name: "Needs Work", exact: true, pressed: true })).toBeVisible();
    await expect(page.getByPlaceholder("Freeform notes or corrections...")).toHaveValue(updatedNotes);

    // ...and after a full reload, proving the server actually persisted it
    // rather than the client merely rendering its own optimistic response.
    await page.reload();
    await expect(page.getByRole("button", { name: "Needs Work", exact: true, pressed: true })).toBeVisible();
    await expect(page.getByPlaceholder("Freeform notes or corrections...")).toHaveValue(updatedNotes);
  } finally {
    // Cleanup: best-effort so a cleanup failure never masks a real Risk #5
    // assertion failure above — but surfaced via a test annotation, not
    // silently swallowed (and never a console statement, which the project's
    // eslint config flags — an annotation shows up in the test report instead).
    const cleanupResponse = await page.request
      .post("/api/test/cleanup-project", {
        headers: { Origin: origin },
        data: { projectId },
      })
      .catch((err: unknown) => {
        test.info().annotations.push({
          type: "warning",
          description: `cleanup request failed for project ${projectId}: ${err instanceof Error ? err.message : String(err)}`,
        });
        return null;
      });

    if (cleanupResponse && !cleanupResponse.ok()) {
      test.info().annotations.push({
        type: "warning",
        description: `cleanup returned ${cleanupResponse.status()} for project ${projectId}: ${await cleanupResponse.text()}`,
      });
    }
  }
});
