import { test, expect, type Page } from "@playwright/test";
import { open, controlBox, centerY, thumbSize, thumbX, drag, measureThumbs, expectNear, PX } from "./helpers";

interface LabelBox {
  text: string | null;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** The tooltip labels a user can actually see (not hidden by a merge, not faded out), left to right. */
const visibleLabels = (page: Page): Promise<LabelBox[]> =>
  page.locator(".rs-tooltip-label").evaluateAll((els) =>
    els
      .filter((el) => getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el.parentElement!).opacity !== "0")
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { text: el.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      })
      .sort((a, b) => a.left - b.left)
  );

const expectNoOverlap = (labels: LabelBox[]) => {
  for (let i = 1; i < labels.length; i++) expect(labels[i].left).toBeGreaterThanOrEqual(labels[i - 1].right);
};

const insideRoot = async (page: Page, labels: LabelBox[]) => {
  const root = (await page.locator(".rs-root").boundingBox())!;
  return labels.every(
    (l) => l.left >= root.x - PX && l.right <= root.x + root.width + PX && l.top >= root.y - PX
  );
};

test.describe("always-on tooltips", () => {
  test("close thumbs share one label instead of covering each other", async ({ page }) => {
    await open(page, "tooltips-close");
    const labels = await visibleLabels(page);
    expect(labels.map((l) => l.text)).toEqual(["$480 – $520"]);
  });

  test("dragging the thumbs apart splits the label again", async ({ page }) => {
    await open(page, "tooltips-close");
    const box = await controlBox(page);
    const size = await thumbSize(page);
    const at = (v: number) => thumbX(box, size, 0, 1000, v);
    // The thumbs overlap; dragging left from the overlap takes the lower one.
    await drag(page, { x: (at(480) + at(520)) / 2, y: centerY(box) }, at(150));
    const labels = await visibleLabels(page);
    expect(labels).toHaveLength(2);
    expect(labels[0].text).toMatch(/^\$\d+$/);
    expect(labels[1].text).toBe("$520");
    expectNoOverlap(labels);
  });

  test("two thumbs on the same value show it once", async ({ page }) => {
    await open(page, "tooltips-stacked");
    expect((await visibleLabels(page)).map((l) => l.text)).toEqual(["$50"]);
  });

  test("with three thumbs, only the close pair merges", async ({ page }) => {
    await open(page, "tooltips-three");
    const labels = await visibleLabels(page);
    expect(labels.map((l) => l.text)).toEqual(["$20 – $22", "$80"]);
    expectNoOverlap(labels);
  });

  for (const [name, label] of [["tooltips-edges", "LTR"], ["tooltips-edges-rtl", "RTL"]]) {
    test(`labels at the ends stay inside the slider (${label})`, async ({ page }) => {
      await open(page, name);
      const labels = await visibleLabels(page);
      expect(labels.map((l) => l.text).sort()).toEqual(["$0", "$1,000"]);
      expect(await insideRoot(page, labels)).toBe(true);
    });
  }

  test("a label pushed inward still points at its thumb", async ({ page }) => {
    await open(page, "tooltips-edges");
    const thumbs = await measureThumbs(page);
    // The arrow belongs to the zero-width anchor, whose left edge is the point it marks.
    const arrows = await page.locator(".rs-tooltip").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().left));
    expectNear(arrows[0], thumbs[0].center, PX, "lower arrow vs thumb centre");
    expectNear(arrows[1], thumbs[1].center, PX, "upper arrow vs thumb centre");
    // ...while the upper label itself really moved inward (its centre is left of the thumb).
    const [, upper] = await visibleLabels(page);
    expect((upper.left + upper.right) / 2).toBeLessThan(thumbs[1].center - 1);
  });

  test("labels re-fit when the slider is resized", async ({ page }) => {
    await open(page, "tooltips-edges");
    await page.locator(".rs-root").evaluate((el) => (el as HTMLElement).style.setProperty("--rs-width", "180px"));
    await expect.poll(async () => (await page.locator(".rs-root").boundingBox())!.width).toBeCloseTo(180, 0);
    await expect.poll(async () => insideRoot(page, await visibleLabels(page))).toBe(true);
  });

  test("vertical labels stay within the slider's height", async ({ page }) => {
    await open(page, "tooltips-vertical", "&thumb=12"); // small thumbs, so the labels overhang the ends
    const control = (await page.locator(".rs-control").boundingBox())!;
    const labels = await visibleLabels(page);
    expect(labels).toHaveLength(2);
    for (const l of labels) {
      expect(l.top).toBeGreaterThanOrEqual(control.y - PX);
      expect(l.bottom).toBeLessThanOrEqual(control.y + control.height + PX);
    }
  });
});

test.describe("hover tooltips", () => {
  // Hover tooltips pop up above the slider (only always-on ones reserve space), so only the sides count.
  test("a hovered thumb at the end shows its label within the slider's sides", async ({ page }) => {
    await open(page, "tooltips-hover", "&value=0,100");
    const box = await controlBox(page);
    const size = await thumbSize(page);
    await page.mouse.move(thumbX(box, size, 0, 100, 100), centerY(box));
    await expect(page.locator(".rs-tooltip").nth(1)).toHaveCSS("opacity", "1");
    const [label] = await visibleLabels(page);
    expect(label.text).toBe("$100");
    expect(label.right).toBeLessThanOrEqual(box.x + box.width + PX);
  });
});
