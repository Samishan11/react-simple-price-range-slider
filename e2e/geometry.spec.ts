import { test, expect } from "@playwright/test";
import { open, controlBox, thumbSize, thumbX, measureThumbs, expectNear, PX, THUMB_PX } from "./helpers";

/*
 * Pixel contract: thumbs sit exactly where the value says and have the requested size,
 * the fill starts/ends at the thumb centres, and the track spans the thumbs' travel.
 */
const scenarios = [
  { lo: 0, hi: 100, thumb: 24 },
  { lo: 20, hi: 80, thumb: 24 },
  { lo: 33, hi: 67, thumb: 24 },
  { lo: 49, hi: 51, thumb: 24 },
  { lo: 10, hi: 90, thumb: 32 },
];

test.describe("geometry contract", () => {
  for (const { lo, hi, thumb } of scenarios) {
    test(`thumbs, fill and track line up at ${lo}–${hi} with ${thumb}px thumbs`, async ({ page }) => {
      await open(page, "basic", `&value=${lo},${hi}&thumb=${thumb}`);
      const box = await controlBox(page);
      const size = await thumbSize(page);
      expect(size).toBe(thumb);

      const [lower, upper] = await measureThumbs(page);
      expectNear(lower.width, size, THUMB_PX, "lower thumb width");
      expectNear(upper.width, size, THUMB_PX, "upper thumb width");
      expectNear(lower.center, thumbX(box, size, 0, 100, lo), THUMB_PX, "lower thumb centre");
      expectNear(upper.center, thumbX(box, size, 0, 100, hi), THUMB_PX, "upper thumb centre");

      const fill = (await page.locator(".rs-range").boundingBox())!;
      expectNear(fill.x, thumbX(box, size, 0, 100, lo), PX, "fill start");
      expectNear(fill.x + fill.width, thumbX(box, size, 0, 100, hi), PX, "fill end");
      expectNear(fill.x, lower.center, THUMB_PX, "fill start vs lower thumb");
      expectNear(fill.x + fill.width, upper.center, THUMB_PX, "fill end vs upper thumb");

      const track = (await page.locator(".rs-track").boundingBox())!;
      expectNear(track.x, box.x + size / 2, PX, "track start");
      expectNear(track.x + track.width, box.x + box.width - size / 2, PX, "track end");
    });
  }
});
