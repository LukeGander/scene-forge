// risk: test-plan.md #3 — a scene note edited after its card was generated
// must visibly mark the card stale to the creator (not just internally).
import { test, expect } from "@playwright/test";

test("Risk #3: card visibly flags as stale after its scene note is edited", async ({ page, baseURL }) => {
  if (!baseURL) {
    throw new Error("baseURL is not configured in playwright.config.ts");
  }
  const origin = new URL(baseURL).origin;

  const uniqueId = Date.now();
  const projectTitle = `E2E Stale Badge Project ${uniqueId}`;
  const sceneTitle = `E2E Stale Badge Scene ${uniqueId}`;

  // Setup step 1: create the project via the real route. Not yet inside
  // try/finally — nothing exists to clean up until this succeeds.
  const projectResponse = await page.request.post("/api/projects/create", {
    headers: { Origin: origin },
    form: { title: projectTitle, premise: "A premise for the stale-badge scenario.", tone: "Whimsical" },
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
      form: { projectId, title: sceneTitle, note: "Original scene note before any edit." },
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

    // Baseline: the freshly generated card is not stale yet.
    await expect(page.getByText(/This card may be out of date/)).not.toBeVisible();

    // Retry the fill+click as a unit, but ONLY until a real PATCH response is
    // observed — not until the stale badge appears. On a `client:load`
    // island, the DOM can be interactive before React finishes hydrating, so
    // a fill/click issued in that window is a silent no-op (Playwright sets
    // the raw DOM value, but no React handler is attached yet to submit it);
    // retrying handles exactly that inert-click case. The stale badge is a
    // SEPARATE island (ForgeSceneButton) reacting to a window event — if
    // retrying also covered the badge, a real cross-island race (NoteEditor
    // hydrated and saved, but ForgeSceneButton not yet listening when the
    // event fired) would be masked by re-doing the Save until it happened to
    // work, hiding the exact failure Risk #3 exists to catch.
    await expect(async () => {
      const notePatchResponsePromise = page.waitForResponse(
        (response) => response.url().endsWith(`/api/scenes/${sceneId}/note`) && response.request().method() === "PATCH",
        { timeout: 2000 },
      );
      await page
        .getByPlaceholder(/Describe what happens in this scene/)
        .fill("Updated scene note — the puzzle now requires a key.");
      await page.getByRole("button", { name: "Save note" }).click();
      const notePatchResponse = await notePatchResponsePromise;
      expect(notePatchResponse.ok()).toBe(true);
    }).toPass();

    // Separate, un-retried assertion: this is the actual Risk #3 protection.
    // If the note-updated event was lost (e.g. ForgeSceneButton not yet
    // hydrated), this must fail on its own, not be papered over by re-saving.
    await expect(page.getByText(/This card may be out of date/)).toBeVisible();
  } finally {
    // Cleanup: best-effort so a cleanup failure never masks a real Risk #3
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
