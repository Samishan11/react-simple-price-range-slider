import { test, expect, type Page } from "@playwright/test";
import { open, controlBox, centerY, thumbSize, thumbX, drag, values, events, expectNear, PX } from "./helpers";

/** Pointer geometry for a slider with the given range: `at(v)` is the x of a thumb at value v. */
async function geometry(page: Page, min: number, max: number) {
  const box = await controlBox(page);
  const size = await thumbSize(page);
  return { box, y: centerY(box), at: (v: number) => thumbX(box, size, min, max, v) };
}

const dragEvents = async (page: Page) =>
  (await events(page)).filter((e) => e.type === "dragstart" || e.type === "dragend").map((e) => `${e.type}:${e.value}`);

// Firefox fires `blur` on a focused thumb while Playwright tears the page down, which React's
// dev-only error tracking logs as an unknown error; blurring first keeps the log clean.
test.afterEach(async ({ page }) => {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
});

test.describe("draggableRange", () => {
  test("dragging the fill moves every thumb together, keeping the distance", async ({ page }) => {
    await open(page, "draggable");
    const { y, at } = await geometry(page, 0, 100);
    await drag(page, { x: at(45), y }, at(65));
    expect(await values(page)).toEqual([50, 80]);
    expect(await dragEvents(page)).toEqual(["dragstart:-1", "dragend:-1"]);
  });

  test("the range stops at an end without squeezing", async ({ page }) => {
    await open(page, "draggable");
    const { box, y, at } = await geometry(page, 0, 100);
    await drag(page, { x: at(45), y }, box.x + box.width + 60);
    expect(await values(page)).toEqual([70, 100]);
  });

  test("a click inside the range moves nothing; outside it, the nearest thumb jumps", async ({ page }) => {
    await open(page, "draggable");
    const { y, at } = await geometry(page, 0, 100);
    await page.mouse.click(at(45), y);
    expect(await values(page)).toEqual([30, 60]);
    await page.mouse.click(at(10), y);
    expect(await values(page)).toEqual([10, 60]);
  });

  test("the fill shows a grab cursor", async ({ page }) => {
    await open(page, "draggable");
    await expect(page.locator(".rs-range")).toHaveCSS("cursor", "grab");
  });
});

test.describe("collision", () => {
  test("push: a dragged thumb pushes its neighbours along", async ({ page }) => {
    await open(page, "push");
    const { y, at } = await geometry(page, 0, 100);
    await drag(page, { x: at(20), y }, at(90));
    expect(await values(page)).toEqual([90, 90, 90]);
  });

  test("maxGap: a dragged thumb stops at the maximum distance from its neighbour", async ({ page }) => {
    await open(page, "max-gap");
    const { box, y, at } = await geometry(page, 0, 100);
    await drag(page, { x: at(40), y }, box.x + box.width + 40);
    expect(await values(page)).toEqual([20, 50]);
  });

  test("swap: a dragged thumb passes its neighbour and stays under the pointer", async ({ page }) => {
    await open(page, "swap");
    const { y, at } = await geometry(page, 0, 100);
    await page.mouse.move(at(20), y);
    await page.mouse.down();
    await page.mouse.move(at(70), y, { steps: 15 });
    expect(await values(page)).toEqual([50, 70]);
    await page.mouse.move(at(90), y, { steps: 5 }); // same drag, now as the upper thumb
    await page.mouse.up();
    expect(await values(page)).toEqual([50, 90]);
    await expect(page.locator(".rs-input").nth(1)).toBeFocused();
  });
});

test.describe("disabled thumbs and read-only", () => {
  test("a disabled thumb ignores presses, and the free thumb stops at it", async ({ page }) => {
    await open(page, "disabled-thumb");
    const { y, at } = await geometry(page, 0, 100);
    await drag(page, { x: at(20), y }, at(60));
    expect(await values(page)).toEqual([20, 80]);
    await page.mouse.click(at(5), y); // the free thumb jumps toward 5 but can't pass the locked one
    expect(await values(page)).toEqual([20, 20]);
    await expect(page.locator(".rs-thumb").first()).toHaveCSS("cursor", "not-allowed");
  });

  test("readOnly ignores dragging and track clicks", async ({ page }) => {
    await open(page, "readonly");
    const { y, at } = await geometry(page, 0, 100);
    await drag(page, { x: at(20), y }, at(60));
    await page.mouse.click(at(95), y);
    expect(await values(page)).toEqual([20, 80]);
    expect((await events(page)).length).toBe(0);
  });
});

test.describe("marks", () => {
  test("snapToMarks: a dragged thumb lands on the nearest mark", async ({ page }) => {
    await open(page, "marks-snap");
    const { y, at } = await geometry(page, 0, 100);
    await drag(page, { x: at(25), y }, at(8));
    expect(await values(page)).toEqual([0, 60]);
    await drag(page, { x: at(0), y }, at(40));
    expect(await values(page)).toEqual([25, 60]);
  });

  test("mark labels stay inside the slider at the ends", async ({ page }) => {
    await open(page, "marks-edges");
    const root = (await page.locator(".rs-root").boundingBox())!;
    const boxes = await page.locator(".rs-mark-label").evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect()).map((r) => ({ left: r.left, right: r.right }))
    );
    expect(boxes).toHaveLength(5);
    for (const b of boxes) {
      expect(b.left).toBeGreaterThanOrEqual(root.x - PX);
      expect(b.right).toBeLessThanOrEqual(root.x + root.width + PX);
    }
    // the middle labels stay centred on their ticks
    const mid = await page.locator(".rs-mark").nth(2).evaluate((el) => el.getBoundingClientRect().left);
    expectNear((boxes[2].left + boxes[2].right) / 2, mid, PX, "middle label centre");
  });
});

test.describe("drag callbacks", () => {
  test("onDragStart / onDragEnd bracket a thumb drag, before onChangeEnd", async ({ page }) => {
    await open(page, "basic");
    const { y, at } = await geometry(page, 0, 100);
    await drag(page, { x: at(80), y }, at(60));
    const order = (await events(page)).map((e) => e.type).filter((t) => t !== "change");
    expect(order).toEqual(["dragstart", "dragend", "end"]);
    expect(await dragEvents(page)).toEqual(["dragstart:1", "dragend:1"]);
  });
});
