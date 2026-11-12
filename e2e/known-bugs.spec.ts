import { test, expect } from "@playwright/test";
import { open } from "./helpers";

/*
 * Each test states the CORRECT behaviour and is marked test.fail() until it is fixed; then delete
 * the test.fail() line and move the test to interaction.spec.ts. If one starts passing on its own,
 * Playwright reports it as a failure so it can't go unnoticed.
 */
const labelBoxes = (page: import("@playwright/test").Page) =>
  page.locator(".rs-tooltip-label").evaluateAll((els) =>
    els
      .filter((el) => getComputedStyle(el.parentElement!).opacity !== "0")
      .map((el) => el.getBoundingClientRect())
      .map((r) => ({ left: r.left, right: r.right, top: r.top }))
      .sort((a, b) => a.left - b.left)
  );

test.describe("known bugs (tooltip layout, next v3 step)", () => {
  test("always-on tooltips never cover each other", async ({ page }) => {
    test.fail(true, "close thumbs still draw their tooltips on top of each other");
    await open(page, "tooltips-close");
    const tips = await labelBoxes(page);
    for (let i = 1; i < tips.length; i++) expect(tips[i].left).toBeGreaterThanOrEqual(tips[i - 1].right);
  });

  test("always-on tooltips stay inside the slider's box", async ({ page }) => {
    test.fail(true, "tooltips at the ends still overflow the slider's sides");
    await open(page, "tooltips-edges");
    const root = (await page.locator(".rs-root").boundingBox())!;
    for (const b of await labelBoxes(page)) {
      expect(b.left).toBeGreaterThanOrEqual(root.x - 0.5);
      expect(b.right).toBeLessThanOrEqual(root.x + root.width + 0.5);
      expect(b.top).toBeGreaterThanOrEqual(root.y - 0.5);
    }
  });
});
