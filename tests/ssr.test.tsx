// @vitest-environment node
import React from "react";
import { renderToString } from "react-dom/server";
import MultiRangeSlider, { RangeSlider } from "../src";

describe("server rendering", () => {
  it("renders in a non-DOM environment without touching window/document", () => {
    expect(typeof window).toBe("undefined");
    const html = renderToString(
      <MultiRangeSlider min={0} max={100} tooltip marks theme="auto" ariaLabel="Price" />
    );
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Price"');
    expect(html.match(/type="range"/g)).toHaveLength(2);
  });

  it("positions thumbs and fill inline and exactly (no rounding)", () => {
    const html = renderToString(<RangeSlider min={0} max={3} value={[1, 2]} />);
    // fill: starts at 1/3, ends 1/3 from the end (attributes in any order)
    const fill = html.match(/<div[^>]*class="rs-range"[^>]*>/)![0];
    expect(fill).toMatch(/inset-inline-start:33\.333333333333\d*%/);
    expect(fill).toMatch(/inset-inline-end:33\.333333333333\d*%/);
    // thumbs: centre at size/2 + (100% - size) * fraction
    expect(html).toContain("inset-inline-start:calc(var(--rs-thumb-size, 24px) / 2 + (100% - var(--rs-thumb-size, 24px)) * 0.3333333333333333)");
  });

  it("renders the variant, size and thumb positions, so styles apply before hydration", () => {
    const html = renderToString(<RangeSlider min={0} max={4} value={[1, 3]} variant="material" size="sm" />);
    const root = html.match(/<div[^>]*class="rs-root"[^>]*>/)![0];
    expect(root).toContain('data-variant="material"');
    expect(root).toContain('data-size="sm"');
    expect(root).toContain('data-thumbs="2"');
    const control = html.match(/<div[^>]*class="rs-control"[^>]*>/)![0];
    expect(control).toMatch(/--rs-p0:0\.25(;|")/);
    expect(control).toMatch(/--rs-p1:0\.75(;|")/);
  });

  it("renders a single value as one slider, without a group", () => {
    const html = renderToString(<RangeSlider defaultValue={40} ariaLabel="Volume" />);
    expect(html).not.toContain('role="group"');
    expect(html.match(/type="range"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Volume"');
  });
});
