import { test, expect } from "@playwright/test";
import { open, values, measureThumbs, expectNear, THUMB_PX } from "./helpers";

/*
 * Each test states the CORRECT behaviour. They are marked test.fail() because 2.x gets it wrong
 * (the thumbs are still native input thumbs). The v3 engine must make them pass; then delete
 * the test.fail() line and move the test to interaction.spec.ts. If one starts passing on its
 * own, Playwright reports it as a failure so it can't go unnoticed.
 */
test.describe("known 2.x bugs (fixed by the v3 engine)", () => {
  test("max stays reachable and the fill ends at the thumb when max is off the step grid", async ({ page }) => {
    test.fail(true, "2.x: the browser snaps the thumb to 90 while the fill and label say 100");
    await open(page, "off-grid-max");
    expect(await values(page)).toEqual([0, 100]);
    const [, upper] = await measureThumbs(page);
    const fill = (await page.locator(".rs-range").boundingBox())!;
    expectNear(fill.x + fill.width, upper.center, THUMB_PX, "fill end vs upper thumb");
  });

  test("always-on tooltips never cover each other", async ({ page }) => {
    test.fail(true, "2.x: close thumbs draw their tooltips on top of each other");
    await open(page, "tooltips-close");
    const tips = await page
      .locator(".rs-tooltip")
      .evaluateAll((els) =>
        els
          .filter((el) => getComputedStyle(el).opacity !== "0")
          .map((el) => el.getBoundingClientRect())
          .map((r) => ({ left: r.left, right: r.right }))
          .sort((a, b) => a.left - b.left)
      );
    for (let i = 1; i < tips.length; i++) expect(tips[i].left).toBeGreaterThanOrEqual(tips[i - 1].right);
  });

  test("always-on tooltips stay inside the slider's box", async ({ page }) => {
    test.fail(true, "2.x: tooltips overflow the ends and the area above the slider");
    await open(page, "tooltips-edges");
    const root = (await page.locator(".rs-root").boundingBox())!;
    for (const tip of await page.locator(".rs-tooltip").all()) {
      const b = (await tip.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(root.x - 0.5);
      expect(b.x + b.width).toBeLessThanOrEqual(root.x + root.width + 0.5);
      expect(b.y).toBeGreaterThanOrEqual(root.y - 0.5);
    }
  });
});
