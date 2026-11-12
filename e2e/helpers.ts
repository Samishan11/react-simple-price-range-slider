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

/** The interactive area: as long as the slider, one thumb thick. */
export async function controlBox(page: Page): Promise<Box> {
  const box = await page.locator(".rs-control").boundingBox();
  if (!box) throw new Error("slider is not rendered");
  return box;
}

export const centerY = (box: Box) => box.y + box.height / 2;
export const centerX = (box: Box) => box.x + box.width / 2;

export const thumbSize = (page: Page) =>
  page.locator(".rs-root").evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue("--rs-thumb-size")));

/**
 * The geometry contract: where the centre of a thumb showing `value` must be.
 * Thumbs stay inside the control, so centres run from `size / 2` to `width - size / 2`.
 */
export function thumbX(box: Box, size: number, min: number, max: number, value: number) {
  return box.x + size / 2 + ((box.width - size) * (value - min)) / (max - min);
}

/** Same contract for vertical sliders, where the minimum is at the bottom. */
export function thumbY(box: Box, size: number, min: number, max: number, value: number) {
  return box.y + box.height - size / 2 - ((box.height - size) * (value - min)) / (max - min);
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

/** Every part, thumbs included, is a real element with an exact rect: hold them to half a pixel. */
export const PX = 0.5;
export const THUMB_PX = PX;

/** Each thumb's centre and size along the main axis (`y` for vertical sliders). */
export function measureThumbs(page: Page, axis: "x" | "y" = "x") {
  return page.locator(".rs-thumb").evaluateAll(
    (els, a) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return a === "x" ? { center: r.left + r.width / 2, width: r.width } : { center: r.top + r.height / 2, width: r.height };
      }),
    axis
  );
}
