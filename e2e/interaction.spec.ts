import { test, expect, type Page } from "@playwright/test";
import type { RangeValues } from "../src";
import {
  open,
  controlBox,
  centerX,
  centerY,
  thumbSize,
  thumbX,
  thumbY,
  drag,
  values,
  labels,
  events,
  measureThumbs,
  expectNear,
  PX,
} from "./helpers";

/** Pointer geometry for a slider with the given range: `at(v)` is the x of a thumb at value v (LTR). */
async function geometry(page: Page, min: number, max: number) {
  const box = await controlBox(page);
  const size = await thumbSize(page);
  const at = (v: number) => thumbX(box, size, min, max, v);
  return { box, y: centerY(box), at, rtlAt: (v: number) => 2 * box.x + box.width - at(v) };
}

const between = (n: number, lo: number, hi: number) => {
  expect(n).toBeGreaterThanOrEqual(lo);
  expect(n).toBeLessThanOrEqual(hi);
};

// Firefox fires `blur` on a focused thumb while Playwright tears the page down; React's dev-only
// error tracking then logs "An error was thrown ... React doesn't know what it was". Blurring
// first keeps the log clean. (Not a user-facing issue: it only happens as the page is destroyed.)
test.afterEach(async ({ page }) => {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
});

test.describe("pointer", () => {
  test("dragging a thumb moves it and fires onChangeEnd once with the final value", async ({ page }) => {
    await open(page, "basic");
    const { y, at } = await geometry(page, 0, 100);
    await drag(page, { x: at(20), y }, at(50));

    const [lo, hi] = await values(page);
    between(lo, 49, 51);
    expect(hi).toBe(80);
    const log = await events(page);
    expect(log.filter((e) => e.type === "change").length).toBeGreaterThan(1);
    const ends = log.filter((e) => e.type === "end");
    expect(ends).toHaveLength(1);
    expect(ends[0].value).toEqual({ min: lo, max: hi });
  });

  test("the drag keeps tracking outside the slider and ends where the pointer is released", async ({ page }) => {
    await open(page, "basic");
    const { box, y, at } = await geometry(page, 0, 100);
    await page.mouse.move(at(80), y);
    await page.mouse.down();
    await page.mouse.move(at(90), y + 80, { steps: 5 });
    await page.mouse.move(box.x + box.width + 40, y + 80, { steps: 5 });
    await page.mouse.up();
    expect(await values(page)).toEqual([20, 100]);
    expect((await events(page)).filter((e) => e.type === "end")).toHaveLength(1);
  });

  test("a thumb grabbed off-centre doesn't jump to the pointer", async ({ page }) => {
    await open(page, "basic");
    const { y, at } = await geometry(page, 0, 100);
    await page.mouse.click(at(20) + 8, y);
    expect(await values(page)).toEqual([20, 80]);
    expect((await events(page)).filter((e) => e.type === "change")).toHaveLength(0);
    // moving by exactly 10 units' worth of pixels moves the value by 10
    await drag(page, { x: at(20) + 8, y }, at(30) + 8);
    expect(await values(page)).toEqual([30, 80]);
  });

  test("clicking the track moves the nearest thumb there", async ({ page }) => {
    await open(page, "basic");
    const { y, at } = await geometry(page, 0, 100);
    await page.mouse.click(at(5), y);
    expect(await values(page)).toEqual([5, 80]);
    await page.mouse.click(at(95), y);
    expect(await values(page)).toEqual([5, 95]);
    expect((await events(page)).filter((e) => e.type === "end")).toHaveLength(2);
  });

  test("thumbs meet exactly, with no offset between them", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" }); // measure settled thumbs, not the grow animation
    await open(page, "basic");
    const { y, at } = await geometry(page, 0, 100);
    await drag(page, { x: at(80), y }, at(0));
    expect(await values(page)).toEqual([20, 20]);
    const [lower, upper] = await measureThumbs(page);
    expectNear(upper.center, lower.center, 0.01, "stacked thumb centres");
    expectNear(upper.width, lower.width, 0.01, "stacked thumb widths");
  });

  test("minGap keeps the thumbs apart", async ({ page }) => {
    await open(page, "min-gap");
    const { y, at } = await geometry(page, 0, 100);
    await drag(page, { x: at(80), y }, at(0));
    expect(await values(page)).toEqual([20, 30]);
  });

  test("a disabled slider ignores dragging and track clicks", async ({ page }) => {
    await open(page, "disabled");
    const { y, at } = await geometry(page, 0, 100);
    await drag(page, { x: at(20), y }, at(60));
    await page.mouse.click(at(95), y);
    expect(await values(page)).toEqual([20, 80]);
    expect(await events(page)).toEqual([]);
  });

  test("RTL: the minimum sits on the right and dragging left increases it", async ({ page }) => {
    await open(page, "rtl");
    const { y, rtlAt } = await geometry(page, 0, 100);
    await drag(page, { x: rtlAt(20), y }, rtlAt(40));
    const [lo, hi] = await values(page);
    between(lo, 39, 41);
    expect(hi).toBe(80);
  });

  test("decimal steps never leak floating-point noise into onChange", async ({ page }) => {
    await open(page, "decimal");
    const { box, y, at } = await geometry(page, 0, 1);
    // Push the lower thumb (0.2) into the upper one (0.4) and keep going.
    await page.mouse.move(at(0.2), y);
    await page.mouse.down();
    for (let x = at(0.2); x <= box.x + box.width + 30; x += 4) await page.mouse.move(x, y);
    await page.mouse.up();

    const log = (await events(page)).filter((e) => e.type === "change" || e.type === "end");
    expect(log.length).toBeGreaterThan(0);
    for (const { value } of log) {
      const { min, max } = value as RangeValues;
      expect(min).toBe(Number(min.toFixed(1)));
      expect(max).toBe(Number(max.toFixed(1)));
    }
    expect(await labels(page)).toEqual(["$0.3", "$0.4"]);
  });

  test("touch: dragging a thumb moves it", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "touch input is emulated through the Chrome DevTools Protocol");
    await open(page, "basic");
    const { y, at } = await geometry(page, 0, 100);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }] });
    await touch("touchStart", at(20));
    for (let i = 1; i <= 10; i++) await touch("touchMove", at(20 + 3 * i));
    await touch("touchEnd", at(50));
    const [lo, hi] = await values(page);
    between(lo, 49, 51);
    expect(hi).toBe(80);
  });
});

test.describe("overlapping thumbs", () => {
  test("dragging left from the overlap moves the lower thumb", async ({ page }) => {
    await open(page, "overlap");
    const { box, y, at } = await geometry(page, 0, 1000);
    await drag(page, { x: (at(500) + at(510)) / 2, y }, box.x + 30);
    const [lo, hi] = await values(page);
    expect(lo).toBeLessThan(500);
    expect(hi).toBe(510);
  });

  test("dragging right from the overlap moves the upper thumb, whichever was used last", async ({ page }) => {
    await open(page, "overlap");
    await page.locator('.rs-root input[type="range"]').first().focus(); // lower thumb drawn on top
    const { box, y, at } = await geometry(page, 0, 1000);
    await drag(page, { x: (at(500) + at(510)) / 2, y }, box.x + box.width - 30);
    const [lo, hi] = await values(page);
    expect(lo).toBe(500);
    expect(hi).toBeGreaterThan(510);
  });

  for (const direction of ["left", "right"] as const) {
    test(`thumbs on the same value separate when dragged ${direction}`, async ({ page }) => {
      await open(page, "basic", "&value=50,50");
      const { y, at } = await geometry(page, 0, 100);
      await drag(page, { x: at(50), y }, at(direction === "left" ? 30 : 70));
      const [lo, hi] = await values(page);
      if (direction === "left") {
        between(lo, 29, 31);
        expect(hi).toBe(50);
      } else {
        expect(lo).toBe(50);
        between(hi, 69, 71);
      }
    });
  }

  test("RTL: dragging left from the overlap moves the upper thumb", async ({ page }) => {
    await open(page, "rtl-overlap");
    const { box, y, rtlAt } = await geometry(page, 0, 1000);
    await drag(page, { x: (rtlAt(500) + rtlAt(510)) / 2, y }, box.x + 30);
    const [lo, hi] = await values(page);
    expect(lo).toBe(500);
    expect(hi).toBeGreaterThan(510);
  });
});

test.describe("hover", () => {
  test("hovering a thumb shows its tooltip in hover mode", async ({ page }) => {
    await open(page, "tooltips-hover");
    const { y, at } = await geometry(page, 0, 100);
    const [lowerTip, upperTip] = await page.locator(".rs-tooltip").all();
    await expect(lowerTip).toHaveCSS("opacity", "0");
    await page.mouse.move(at(20), y);
    await expect(lowerTip).toHaveCSS("opacity", "1");
    await expect(upperTip).toHaveCSS("opacity", "0");
    await page.mouse.move(at(50), y);
    await expect(lowerTip).toHaveCSS("opacity", "0");
  });

  test("a thumb doesn't stay hovered when a drag ends away from it", async ({ page }) => {
    await open(page, "tooltips-hover");
    const { y, at } = await geometry(page, 0, 100);
    await drag(page, { x: at(80), y }, at(0)); // upper thumb stops on the lower one at 20
    expect(await values(page)).toEqual([20, 20]);
    await expect(page.locator(".rs-thumb[data-hover], .rs-thumb[data-dragging]")).toHaveCount(0);
    for (const tip of await page.locator(".rs-tooltip").all()) await expect(tip).toHaveCSS("opacity", "0");
  });
});

test.describe("accessibility", () => {
  test("every browser keeps the prefers-reduced-motion rules", async ({ page }) => {
    await open(page, "basic");
    const selectors = await page.evaluate(() =>
      Array.from(document.styleSheets).flatMap((sheet) =>
        Array.from(sheet.cssRules)
          .filter((r): r is CSSMediaRule => r instanceof CSSMediaRule && r.conditionText.includes("prefers-reduced-motion"))
          .flatMap((r) => Array.from(r.cssRules).map((s) => (s as CSSStyleRule).selectorText))
      )
    );
    expect(selectors).toContain(".rs-thumb");
    expect(selectors).toContain(".rs-tooltip");
  });
});

test.describe("keyboard", () => {
  test("arrows step, Home/End jump to the limits, onChangeEnd fires on key release", async ({ page }) => {
    await open(page, "basic");
    await page.locator('.rs-root input[type="range"]').first().focus();

    await page.keyboard.press("ArrowRight");
    expect((await values(page))[0]).toBe(21);
    await page.keyboard.press("End");
    expect((await values(page))[0]).toBe(80);
    await page.keyboard.press("Home");
    expect((await values(page))[0]).toBe(0);

    const ends = (await events(page)).filter((e) => e.type === "end");
    expect(ends.length).toBeGreaterThanOrEqual(3);
    expect(ends[ends.length - 1].value).toEqual({ min: 0, max: 80 });
  });

  test("after a mouse drag the keyboard continues on that thumb, with no focus ring", async ({ page }) => {
    await open(page, "basic");
    const { y, at } = await geometry(page, 0, 100);
    await drag(page, { x: at(80), y }, at(70));
    await expect(page.locator(".rs-input").nth(1)).toBeFocused();
    await expect(page.locator(".rs-thumb[data-focus-visible]")).toHaveCount(0);
    await page.keyboard.press("ArrowLeft");
    expect(await values(page)).toEqual([20, 69]);
    await expect(page.locator(".rs-thumb").nth(1)).toHaveAttribute("data-focus-visible", "");
  });

  test("Tab moves focus between thumbs and shows the focus ring", async ({ page, browserName }) => {
    test.skip(browserName === "webkit", "Safari's Tab only reaches text fields unless Full Keyboard Access is on");
    await open(page, "basic");
    await page.keyboard.press("Tab");
    await expect(page.locator(".rs-input").first()).toBeFocused();
    await expect(page.locator(".rs-thumb").first()).toHaveAttribute("data-focus-visible", "");
    await page.keyboard.press("Tab");
    await expect(page.locator(".rs-input").nth(1)).toBeFocused();
    await expect(page.locator(".rs-thumb[data-focus-visible]")).toHaveCount(1);
  });
});

test.describe("v3: thumbs, orientation and forms", () => {
  test("single thumb: drag, track click, and onChange reports a number", async ({ page }) => {
    await open(page, "single");
    const { y, at } = await geometry(page, 0, 100);
    await drag(page, { x: at(30), y }, at(60));
    between((await values(page))[0], 59, 61);
    await page.mouse.click(at(90), y);
    expect(await values(page)).toEqual([90]);
    const log = await events(page);
    const last = log[log.length - 1];
    expect(last).toEqual({ type: "end", value: 90 });
  });

  test("three thumbs: neighbours block the middle one; a stack separates by direction", async ({ page }) => {
    await open(page, "three");
    const { box, y, at } = await geometry(page, 0, 100);
    await drag(page, { x: at(50), y }, box.x + box.width + 20);
    expect(await values(page)).toEqual([20, 80, 80]);
    await drag(page, { x: at(80), y }, at(65));
    expect(await values(page)).toEqual([20, 65, 80]);
  });

  test("vertical: dragging up increases the value, and the thumbs sit on the contract", async ({ page }) => {
    await open(page, "vertical");
    const box = await controlBox(page);
    const size = await thumbSize(page);
    const x = centerX(box);
    const [lower, upper] = await measureThumbs(page, "y");
    expectNear(lower.center, thumbY(box, size, 0, 100, 20), PX, "lower thumb centre");
    expectNear(upper.center, thumbY(box, size, 0, 100, 80), PX, "upper thumb centre");
    await page.mouse.move(x, thumbY(box, size, 0, 100, 20));
    await page.mouse.down();
    await page.mouse.move(x, thumbY(box, size, 0, 100, 50), { steps: 15 });
    await page.mouse.up();
    between((await values(page))[0], 49, 51);
    await page.keyboard.press("ArrowUp");
    between((await values(page))[0], 50, 52);
  });

  test("inverted: the maximum is on the left", async ({ page }) => {
    await open(page, "inverted");
    const { y, rtlAt } = await geometry(page, 0, 100); // inverted LTR mirrors like RTL
    await drag(page, { x: rtlAt(20), y }, rtlAt(40));
    between((await values(page))[0], 39, 41);
  });

  test("an off-grid max is reachable, and the thumb sits exactly at the end of the fill", async ({ page }) => {
    await open(page, "off-grid-max");
    expect(await values(page)).toEqual([0, 100]);
    const [, upper] = await measureThumbs(page);
    const fill = (await page.locator(".rs-range").boundingBox())!;
    expectNear(fill.x + fill.width, upper.center, PX, "fill end vs upper thumb");
    const { box, y, at } = await geometry(page, 0, 100);
    await drag(page, { x: at(100), y }, at(60));
    expect(await values(page)).toEqual([0, 60]);
    await drag(page, { x: at(60), y }, box.x + box.width + 20);
    expect(await values(page)).toEqual([0, 100]);
  });

  test("forms submit the real values", async ({ page }) => {
    await open(page, "form");
    const read = () =>
      page.evaluate(() => Object.fromEntries(new FormData(document.getElementById("form") as HTMLFormElement)));
    expect(await read()).toEqual({ "price-min": "20", "price-max": "80" });
    await page.locator(".rs-input").first().focus();
    await page.keyboard.press("End");
    expect(await read()).toEqual({ "price-min": "80", "price-max": "80" });
  });
});
