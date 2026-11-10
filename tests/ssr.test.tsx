// @vitest-environment node
import React from "react";
import { renderToString } from "react-dom/server";
import MultiRangeSlider from "../src";

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
});
