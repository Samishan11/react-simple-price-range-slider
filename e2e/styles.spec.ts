import { test, expect, type Page } from "@playwright/test";
import {
  open,
  controlBox,
  centerX,
  centerY,
  thumbSize,
  thumbX,
  thumbY,
  measureThumbs,
  expectNear,
  values,
  drag,
  paintAlong,
  paintMismatches,
  PX,
  type Paint,
} from "./helpers";

/** Each variant at size "md": thumb size along the track, track thickness, control thickness. */
const VARIANTS = {
  default: { thumb: 24, track: 6, control: 24 },
  minimal: { thumb: 14, track: 2, control: 24 },
  soft: { thumb: 28, track: 4, control: 28 },
  material: { thumb: 24, track: 16, control: 44 },
} as const;
type Variant = keyof typeof VARIANTS;
const variants = Object.keys(VARIANTS) as Variant[];
const SCALES = { sm: 5 / 6, md: 1, lg: 4 / 3 };

/** The control is at least 24px thick to tap (WCAG 2.5.8); Material's handle makes it thicker. */
const controlFor = (variant: Variant, scale: number) =>
  variant === "material" ? VARIANTS.material.control * scale : Math.max(VARIANTS[variant].thumb * scale, 24);

// Blur before teardown: a blur during page unload makes React (dev) log a spurious error in Firefox.
test.afterEach(async ({ page }) => {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
});

const box = async (page: Page, selector: string) => (await page.locator(selector).first().boundingBox())!;

test.describe("variants and sizes keep the geometry contract", () => {
  for (const variant of variants) {
    for (const [size, scale] of Object.entries(SCALES)) {
      test(`${variant} · ${size}`, async ({ page }) => {
        await open(page, "basic", `&variant=${variant}&size=${size}`);
        const control = await controlBox(page);
        const thumb = await thumbSize(page);
        expectNear(thumb, VARIANTS[variant].thumb * scale, PX, "thumb size");
        expectNear(control.height, controlFor(variant, scale), PX, "control thickness");

        const [lower, upper] = await measureThumbs(page);
        expectNear(lower.center, thumbX(control, thumb, 0, 100, 20), PX, "lower thumb centre");
        expectNear(upper.center, thumbX(control, thumb, 0, 100, 80), PX, "upper thumb centre");

        const fill = await box(page, ".rs-range");
        expectNear(fill.x, lower.center, PX, "fill start");
        expectNear(fill.x + fill.width, upper.center, PX, "fill end");

        const track = await box(page, ".rs-track");
        expectNear(track.x, control.x + thumb / 2, PX, "track start");
        expectNear(track.x + track.width, control.x + control.width - thumb / 2, PX, "track end");
        expectNear(track.height, VARIANTS[variant].track * scale, PX, "track thickness");
        expectNear(centerY(track), centerY(control), PX, "track centred across the control");
        for (const t of await page.locator(".rs-thumb").all()) {
          expectNear(centerY((await t.boundingBox())!), centerY(control), PX, "thumb centred across the control");
        }
      });
    }
  }
});

test.describe("variants in RTL, inverted and vertical", () => {
  for (const variant of variants) {
    test(variant, async ({ page }) => {
      for (const name of ["rtl", "inverted"]) {
        await open(page, name, `&variant=${variant}`);
        const control = await controlBox(page);
        const thumb = await thumbSize(page);
        const mirrored = (v: number) => 2 * control.x + control.width - thumbX(control, thumb, 0, 100, v);
        const [lower, upper] = await measureThumbs(page);
        expectNear(lower.center, mirrored(20), PX, `${name}: lower thumb`);
        expectNear(upper.center, mirrored(80), PX, `${name}: upper thumb`);
        const fill = await box(page, ".rs-range");
        expectNear(fill.x, upper.center, PX, `${name}: fill start`);
        expectNear(fill.x + fill.width, lower.center, PX, `${name}: fill end`);
      }

      await open(page, "vertical", `&variant=${variant}`);
      const control = await controlBox(page);
      const thumb = await thumbSize(page);
      expectNear(thumb, VARIANTS[variant].thumb, PX, "vertical: thumb size");
      expectNear(control.width, controlFor(variant, 1), PX, "vertical: control thickness");
      const [lower, upper] = await measureThumbs(page, "y");
      expectNear(lower.center, thumbY(control, thumb, 0, 100, 20), PX, "vertical: lower thumb");
      expectNear(upper.center, thumbY(control, thumb, 0, 100, 80), PX, "vertical: upper thumb");
      const fill = await box(page, ".rs-range");
      expectNear(fill.y, upper.center, PX, "vertical: fill top");
      expectNear(fill.y + fill.height, lower.center, PX, "vertical: fill bottom");
      const track = await box(page, ".rs-track");
      expectNear(track.width, VARIANTS[variant].track, PX, "vertical: track thickness");
      expectNear(centerX(track), centerX(control), PX, "vertical: track centred");
      for (const t of await page.locator(".rs-thumb").all()) {
        expectNear(centerX((await t.boundingBox())!), centerX(control), PX, "vertical: thumb centred");
      }
    });
  }
});

/*
 * Material draws what the DOM can't show: handle bars (::before), gaps masked out of the track
 * around each handle, and stop dots in the unfilled ends. Check them pixel by pixel on a real
 * screenshot, repainted so every pixel is classable: unfilled track black, fill/handles/dots red.
 */
test.describe("material paints gaps, handles and stop dots where the thumbs are", () => {
  // Asymmetric values: a mirrored layout must not pass by symmetry.
  const scenarios = [
    { label: "two thumbs", name: "basic", query: "&value=10,60" },
    { label: "two thumbs · lg", name: "basic", query: "&value=10,60&size=lg" },
    { label: "one thumb", name: "single", query: "" },
    { label: "RTL", name: "rtl", query: "&value=10,60" },
    { label: "RTL · one thumb", name: "rtl-single", query: "" },
    { label: "inverted", name: "inverted", query: "&value=10,60" },
    { label: "inverted · one thumb", name: "inverted", query: "&value=30" },
    { label: "vertical", name: "vertical", query: "&value=10,60" },
    { label: "vertical · one thumb", name: "vertical", query: "&value=30" },
  ];
  for (const { label, name, query } of scenarios) {
    test(label, async ({ page }) => {
      await open(page, name, `&variant=material${query}`);
      await page.locator(".rs-root").evaluate((el) => {
        (el as HTMLElement).style.setProperty("--rs-track-color", "#000");
        (el as HTMLElement).style.setProperty("--rs-range-color", "#f00");
      });
      const scale = query.includes("lg") ? 4 / 3 : 1;
      const [cut, bar, dot, thickness] = [8 * scale, 4 * scale, 4 * scale, 16 * scale];
      const vertical = name === "vertical";
      const control = await controlBox(page);
      const track = await box(page, ".rs-track");
      const fill = await box(page, ".rs-range");
      const centers = (await measureThumbs(page, vertical ? "y" : "x")).map((t) => t.center);
      const [t0, t1] = vertical ? [track.y, track.y + track.height] : [track.x, track.x + track.width];
      const [f0, f1] = vertical ? [fill.y, fill.y + fill.height] : [fill.x, fill.x + fill.width];
      // A dot centred in the rounded cap of each end the fill doesn't cover.
      const dots = [t0 + thickness / 2, t1 - thickness / 2].filter((d) => d < f0 || d > f1);

      const expected = (p: number): Paint => {
        if (p < t0 || p > t1) return "w";
        for (const c of centers) {
          if (Math.abs(p - c) < bar / 2) return "r"; // the handle
          if (Math.abs(p - c) < cut) return "w"; // the gap around it
        }
        if (dots.some((d) => Math.abs(p - d) < dot / 2)) return "r";
        return p > f0 && p < f1 ? "r" : "k";
      };
      const start = Math.floor(vertical ? control.y : control.x);
      const length = Math.ceil(vertical ? control.height : control.width);
      const line = Math.floor(vertical ? centerX(track) : centerY(track));
      const shot = vertical
        ? await paintAlong(page, line, start, length, "y")
        : await paintAlong(page, start, line, length, "x");
      expect(paintMismatches(shot, start, expected)).toEqual([]);
      expect(shot.paint.filter((p) => p === "k").length / shot.scale).toBeGreaterThan(20);
      expect(shot.paint.filter((p) => p === "r").length / shot.scale).toBeGreaterThan(20);
    });
  }
});

test.describe("keyboard focus is visible in every variant", () => {
  for (const variant of variants) {
    test(variant, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" }); // no transition: read the final style
      await open(page, "basic", `&variant=${variant}`);
      await page.locator('.rs-root input[type="range"]').first().focus();
      await page.keyboard.press("ArrowRight");
      const thumb = page.locator(".rs-thumb").first();
      await expect(thumb).toHaveAttribute("data-focus-visible", "");
      if (variant === "material") {
        const outline = await thumb.evaluate((el) => {
          const s = getComputedStyle(el, "::before");
          return `${s.outlineStyle} ${s.outlineWidth}`;
        });
        expect(outline).toBe("solid 2px");
      } else {
        expect(await thumb.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("0px 0px 0px 4px");
      }
    });
  }
});

test("minimal: its 14px dots keep a 24px grab area", async ({ page }) => {
  await open(page, "basic", "&variant=minimal");
  const control = await controlBox(page);
  const y = centerY(control);
  const perUnit = (control.width - 14) / 100;
  const [lower] = await measureThumbs(page);

  // 10px from the centre is off the dot but within reach: it grabs the thumb, which doesn't jump.
  await page.mouse.move(lower.center + 10, y);
  await page.mouse.down();
  await page.mouse.up();
  expect(await values(page)).toEqual([20, 80]);
  // Dragging from there moves the thumb by the drag distance, not to the pointer.
  await drag(page, { x: lower.center + 10, y }, lower.center + 10 + 10 * perUnit);
  expect(await values(page)).toEqual([30, 80]);

  // 14px away is a track press: the thumb jumps to the pointer.
  const at30 = thumbX(control, 14, 0, 100, 30);
  await page.mouse.move(at30 - 14, y);
  await page.mouse.down();
  await page.mouse.up();
  expect(await values(page)).toEqual([25, 80]);
});

test("a class on the slider overrides every variant's tokens, whatever the stylesheet order", async ({ page }) => {
  for (const variant of variants) {
    await open(page, "basic", `&variant=${variant}`);
    await page.evaluate(() => {
      const style = document.createElement("style");
      style.textContent = ".brand { --rs-range-color: rgb(255, 0, 0); --rs-track-height: 10px; }";
      document.head.prepend(style); // before the slider's stylesheet, so only specificity decides
      document.querySelector(".rs-root")!.classList.add("brand");
    });
    const fillColor = await page.locator(".rs-range").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(fillColor, variant).toBe("rgb(255, 0, 0)");
    expectNear((await box(page, ".rs-track")).height, 10, PX, `${variant}: track thickness`);
  }
});

test("forced colours: borderless thumbs get a visible border", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "forced-colors emulation is Chromium-only");
  await page.emulateMedia({ forcedColors: "active" });
  for (const variant of ["minimal", "soft"]) {
    await open(page, "basic", `&variant=${variant}`);
    const border = await page.locator(".rs-thumb").first().evaluate((el) => {
      const s = getComputedStyle(el);
      return `${s.borderTopStyle} ${s.borderTopWidth}`;
    });
    expect(border, variant).toBe("solid 2px");
  }
});
