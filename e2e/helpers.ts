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

/** The thumb's size along the main axis, measured like the slider does (layout size, ignoring hover scaling). */
export const thumbSize = (page: Page) =>
  page
    .locator(".rs-thumb")
    .first()
    .evaluate((el) =>
      (el as HTMLElement).closest("[data-orientation='vertical']")
        ? (el as HTMLElement).offsetHeight
        : (el as HTMLElement).offsetWidth
    );

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

/** A pixel's colour class: page background (white), black, or red. Tests repaint sliders in these. */
export type Paint = "w" | "k" | "r";

/** Pixels along a line, classed; `scale` = device pixels per CSS pixel (2 for WebKit's Desktop Safari). */
export interface PaintLine {
  paint: Paint[];
  scale: number;
}

/**
 * What a real screenshot shows along one line of CSS pixels (`length` px from `x, y` along
 * `axis`), each device pixel classed as the nearest of white, black and red. An anti-aliased
 * pixel is a blend of its two neighbours, and a blend of two of these colours is never nearest
 * the third.
 */
export async function paintAlong(page: Page, x: number, y: number, length: number, axis: "x" | "y"): Promise<PaintLine> {
  const clip = axis === "x" ? { x, y, width: length, height: 1 } : { x, y, width: 1, height: length };
  const png = await page.screenshot({ clip, animations: "disabled" });
  // Decode with the browser's own PNG decoder, on a detached canvas; keep the middle row/column.
  const { rgb, scale } = await page.evaluate(
    async ({ src, axis, length }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const line =
        axis === "x"
          ? ctx.getImageData(0, Math.floor(img.height / 2), img.width, 1)
          : ctx.getImageData(Math.floor(img.width / 2), 0, 1, img.height);
      return { rgb: Array.from(line.data), scale: (axis === "x" ? img.width : img.height) / length };
    },
    { src: `data:image/png;base64,${png.toString("base64")}`, axis, length }
  );
  const paint: Paint[] = [];
  for (let i = 0; i < rgb.length; i += 4) {
    const [r, g, b] = [rgb[i], rgb[i + 1], rgb[i + 2]];
    const d = { w: (255 - r) ** 2 + (255 - g) ** 2 + (255 - b) ** 2, k: r ** 2 + g ** 2 + b ** 2, r: (255 - r) ** 2 + g ** 2 + b ** 2 };
    paint.push((Object.keys(d) as Paint[]).reduce((a, c) => (d[c] < d[a] ? c : a)));
  }
  return { paint, scale };
}

/**
 * Compares painted pixels with what they should be. `expected(p)` gives the paint at page
 * coordinate `p` along the line; pixels within 1 CSS px of an expected edge may differ
 * (anti-aliasing), every other pixel must match.
 */
export function paintMismatches({ paint, scale }: PaintLine, start: number, expected: (p: number) => Paint): string[] {
  const out: string[] = [];
  paint.forEach((got, i) => {
    const p = start + (i + 0.5) / scale;
    const want = expected(p);
    if (got === want || expected(p - 1) !== want || expected(p + 1) !== want) return;
    out.push(`${p}: ${got}, expected ${want}`);
  });
  return out;
}
