import { test, expect, type Page } from "@playwright/test";
import { controlBox, measureThumbs, thumbX, drag, expectNear, PX } from "./helpers";

const open = async (page: Page, name: string) => {
  await page.goto(`/tailwind.html?case=${name}`);
  await expect(page.locator('#root input[type="range"]').first()).toBeAttached();
};

/** Parts found by structure, since `unstyled` leaves out every `rs-*` class. */
const parts = (page: Page) => {
  const thumbs = page.locator("#root [data-index]");
  const control = thumbs.first().locator("xpath=..");
  const track = control.locator(":scope > div").first();
  return { thumbs, control, track, fill: track.locator(":scope > div") };
};

const values = (page: Page) =>
  page.locator('#root input[type="range"]').evaluateAll((els) => els.map((el) => Number((el as HTMLInputElement).value)));

test.describe("Tailwind v4", () => {
  test("with style.layer.css, utility classes override the defaults", async ({ page }) => {
    await open(page, "layered");
    const pink = await page.locator("#pink").evaluate((el) => getComputedStyle(el).backgroundColor);
    await expect(page.locator(".rs-range")).toHaveCSS("background-color", pink);

    // size-8 makes the thumbs 32px, and every position follows the measured size.
    const box = await controlBox(page);
    const [lower, upper] = await measureThumbs(page);
    expectNear(lower.width, 32, PX, "thumb width");
    expectNear(lower.center, thumbX(box, 32, 0, 100, 20), PX, "lower thumb centre");
    expectNear(upper.center, thumbX(box, 32, 0, 100, 80), PX, "upper thumb centre");
    const fill = (await page.locator(".rs-range").boundingBox())!;
    expectNear(fill.x, lower.center, PX, "fill start");
    expectNear(fill.x + fill.width, upper.center, PX, "fill end");
  });

  test("with the plain stylesheet the defaults win (what style.layer.css is for)", async ({ page }) => {
    await open(page, "plain");
    await expect(page.locator(".rs-range")).toHaveCSS("background-color", "rgb(37, 99, 235)");
  });

  test("unstyled: no built-in classes; geometry and dragging follow the 20px thumbs", async ({ page }) => {
    await open(page, "unstyled");
    expect(await page.locator('#root [class*="rs-"]').count()).toBe(0);

    const { thumbs, control, track, fill } = parts(page);
    const box = (await control.boundingBox())!;
    const rects = await thumbs.evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect()).map((r) => ({ center: r.left + r.width / 2, width: r.width }))
    );
    expectNear(rects[0].width, 20, PX, "thumb width");
    expectNear(rects[0].center, thumbX(box, 20, 0, 100, 20), PX, "lower thumb centre");
    expectNear(rects[1].center, thumbX(box, 20, 0, 100, 80), PX, "upper thumb centre");
    const trackBox = (await track.boundingBox())!;
    expectNear(trackBox.x, box.x + 10, PX, "track start");
    const fillBox = (await fill.boundingBox())!;
    expectNear(fillBox.x, rects[0].center, PX, "fill start");
    expectNear(fillBox.x + fillBox.width, rects[1].center, PX, "fill end");

    await drag(page, { x: rects[0].center, y: box.y + box.height / 2 }, thumbX(box, 20, 0, 100, 50));
    const [lo] = await values(page);
    expect(lo).toBeGreaterThanOrEqual(49);
    expect(lo).toBeLessThanOrEqual(51);
  });

  test("unstyled tooltips: data-visible drives the Tailwind classes", async ({ page }) => {
    await open(page, "unstyled");
    const { thumbs, control } = parts(page);
    const tip = page.locator('#root [data-index="0"] + [aria-hidden="true"]');
    await expect(tip).toHaveCSS("opacity", "0");
    const thumb = (await thumbs.first().boundingBox())!;
    await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
    await expect(tip).toHaveAttribute("data-visible", "");
    await expect(tip).toHaveCSS("opacity", "1");
    const box = (await control.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y - 80);
    await expect(tip).toHaveCSS("opacity", "0");
  });
});
