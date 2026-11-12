import { expect, type Page } from "@playwright/test";
import type { SliderEvent } from "./fixtures/main";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Opens a fixture scenario (see e2e/fixtures/main.tsx). */
export async function open(page: Page, name: string, query = "") {
  await page.goto(`/?case=${name}${query}`);
  await expect(page.locator(".rs-root")).toBeVisible();
}

/** The interactive area: as wide as the slider, as tall as a thumb. */
export async function controlBox(page: Page): Promise<Box> {
  const box = await page.locator(".rs-control").boundingBox();
  if (!box) throw new Error("slider is not rendered");
  return box;
}

export const centerY = (box: Box) => box.y + box.height / 2;

export const thumbSize = (page: Page) =>
  page.locator(".rs-root").evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue("--rs-thumb-size")));

/**
 * The geometry contract: where the centre of a thumb showing `value` must be.
 * Thumbs stay inside the control, so centres run from `size / 2` to `width - size / 2`.
 */
export function thumbX(box: Box, size: number, min: number, max: number, value: number) {
  return box.x + size / 2 + ((box.width - size) * (value - min)) / (max - min);
}

export async function drag(page: Page, from: { x: number; y: number }, toX: number, steps = 20) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(toX, from.y, { steps });
  await page.mouse.up();
}

/** Thumb values, read from the native inputs (which also carry the submitted form values). */
export const values = (page: Page) =>
  page
    .locator('.rs-root input[type="range"]')
    .evaluateAll((els) => els.map((el) => Number((el as HTMLInputElement).value)));

export const labels = (page: Page) => page.locator(".rs-value").allTextContents();

/** Every onChange / onChangeEnd payload so far, in order. */
export const events = (page: Page) =>
  page.evaluate(() => (window as unknown as { __events: SliderEvent[] }).__events);

/** Asserts `actual` is within `tolerance` px of `expected`. */
export function expectNear(actual: number, expected: number, tolerance: number, what: string) {
  expect(Math.abs(actual - expected), `${what}: ${actual.toFixed(2)} vs ${expected.toFixed(2)}`).toBeLessThanOrEqual(tolerance);
}

/** Real elements (track, fill, tooltips) have exact rects: hold them to half a pixel. */
export const PX = 0.5;

/**
 * How precisely measureThumbs() can see a thumb. 2.x thumbs are pseudo-elements and
 * elementFromPoint() only resolves ~1px in Chromium/WebKit. v3 thumbs are real elements,
 * so this drops to PX.
 */
export const THUMB_PX = 1;

/**
 * Where each thumb really is on screen. 2.x thumbs are browser pseudo-elements with no
 * bounding box, so this hit-tests along the control's centre line in 0.25px steps, hiding
 * the other thumbs while one is measured so overlapping thumbs measure correctly. Thumbs
 * normally ignore the pointer (the control handles it), so hit-testing is switched on for
 * them only while measuring.
 */
export function measureThumbs(page: Page) {
  return page.locator(".rs-control").evaluate((control) => {
    const STEP = 0.25;
    const probe = document.createElement("style");
    probe.textContent =
      ".rs-thumb::-webkit-slider-thumb { pointer-events: all !important; }\n" +
      ".rs-thumb::-moz-range-thumb { pointer-events: all !important; }";
    document.head.append(probe);
    const rect = control.getBoundingClientRect();
    const y = rect.top + rect.height / 2;
    const inputs = Array.from(control.querySelectorAll<HTMLInputElement>('input[type="range"]'));
    const measured = inputs.map((input) => {
      const others = inputs.filter((other) => other !== input);
      others.forEach((other) => (other.style.visibility = "hidden"));
      let first = NaN;
      let last = NaN;
      for (let x = rect.left - 40; x <= rect.right + 40; x += STEP) {
        if (document.elementFromPoint(x, y) === input) {
          if (Number.isNaN(first)) first = x;
          last = x;
        }
      }
      others.forEach((other) => (other.style.visibility = ""));
      return { center: (first + last + STEP) / 2, width: last - first + STEP };
    });
    probe.remove();
    return measured;
  });
}
