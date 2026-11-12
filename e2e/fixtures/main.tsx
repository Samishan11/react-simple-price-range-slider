import React from "react";
import { createRoot } from "react-dom/client";
import { RangeSlider, type RangeSliderProps, type SliderValue } from "../../src";
import "../../src/styles.css";

/**
 * One page, many scenarios: `/?case=<name>` renders a single slider (300px wide, or 200px tall
 * when vertical). Optional overrides: `&value=20,80` (start values) and `&thumb=32` (thumb size).
 * Every onChange / onChangeEnd payload is recorded on `window.__events` for the tests.
 */
export type SliderEvent = { type: "change" | "end"; value: SliderValue };

const events: SliderEvent[] = [];
(window as unknown as { __events: SliderEvent[] }).__events = events;
const record = (type: SliderEvent["type"]) => (value: SliderValue) => {
  events.push({ type, value });
};

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

type Case = Omit<RangeSliderProps<SliderValue>, "onChange" | "onChangeEnd">;

const cases: Record<string, Case> = {
  basic: { min: 0, max: 100, defaultValue: { min: 20, max: 80 } },
  "min-gap": { min: 0, max: 100, defaultValue: { min: 20, max: 80 }, minGap: 10 },
  // Thumbs 10 apart on a 0–1000 range: they overlap almost completely.
  overlap: { min: 0, max: 1000, step: 10, defaultValue: { min: 500, max: 510 } },
  "rtl-overlap": { min: 0, max: 1000, step: 10, defaultValue: { min: 500, max: 510 }, dir: "rtl" },
  // 100 is not on the step grid (0, 30, 60, 90).
  "off-grid-max": { min: 0, max: 100, step: 30 },
  // minGap 0.1 makes the slider compute 0.4 - 0.1, which is 0.30000000000000004 in floating point.
  decimal: { min: 0, max: 1, step: 0.1, minGap: 0.1, defaultValue: { min: 0.2, max: 0.4 } },
  "tooltips-hover": { min: 0, max: 100, defaultValue: { min: 20, max: 80 }, tooltip: true },
  "tooltips-close": { min: 0, max: 1000, step: 10, defaultValue: { min: 480, max: 520 }, tooltip: "always", formatValue: usd },
  "tooltips-edges": { min: 0, max: 1000, step: 10, tooltip: "always", formatValue: usd },
  "tooltips-edges-rtl": { min: 0, max: 1000, step: 10, tooltip: "always", formatValue: usd, dir: "rtl" },
  "tooltips-stacked": { min: 0, max: 100, defaultValue: { min: 50, max: 50 }, tooltip: "always" },
  "tooltips-three": { min: 0, max: 100, defaultValue: [20, 22, 80], tooltip: "always" },
  "tooltips-vertical": { min: 0, max: 1000, step: 10, orientation: "vertical", tooltip: "always", formatValue: usd },
  rtl: { min: 0, max: 100, defaultValue: { min: 20, max: 80 }, dir: "rtl" },
  disabled: { min: 0, max: 100, defaultValue: { min: 20, max: 80 }, disabled: true },
  single: { min: 0, max: 100, defaultValue: 30, ariaLabel: "Volume" },
  three: { min: 0, max: 100, defaultValue: [20, 50, 80] },
  vertical: { min: 0, max: 100, defaultValue: [20, 80], orientation: "vertical" },
  inverted: { min: 0, max: 100, defaultValue: [20, 80], inverted: true },
  form: { min: 0, max: 100, defaultValue: { min: 20, max: 80 }, name: "price" },
};

const params = new URLSearchParams(location.search);
const name = params.get("case") ?? "basic";
const props: Case | undefined = cases[name] && { ...cases[name] };

const value = params.get("value");
if (props && value) {
  const numbers = value.split(",").map(Number);
  const given = props.defaultValue;
  props.defaultValue =
    typeof given === "number" ? numbers[0] : Array.isArray(given) ? numbers : { min: numbers[0], max: numbers[1] };
}
const thumb = params.get("thumb");

const slider = props && (
  <RangeSlider
    {...props}
    width="300px"
    style={thumb ? ({ "--rs-thumb-size": `${thumb}px` } as React.CSSProperties) : undefined}
    onChange={record("change")}
    onChangeEnd={record("end")}
  />
);

createRoot(document.getElementById("root")!).render(
  !slider ? <p>Unknown case “{name}”</p> : name === "form" ? <form id="form">{slider}</form> : slider
);
