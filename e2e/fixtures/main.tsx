import React from "react";
import { createRoot } from "react-dom/client";
import { RangeSlider, type RangeSliderProps, type SliderSize, type SliderValue, type SliderVariant } from "../../src";
import "../../src/styles.css";

/**
 * One page, many scenarios: `/?case=<name>` renders a single slider (300px wide, or 200px tall
 * when vertical). Optional overrides: `&value=20,80` (start values), `&thumb=32` (thumb size),
 * `&variant=material` and `&size=lg`.
 * Every onChange / onChangeEnd payload (and drag start/end thumb) is recorded on `window.__events`.
 */
export type SliderEvent = { type: "change" | "end" | "dragstart" | "dragend"; value: SliderValue };

const events: SliderEvent[] = [];
(window as unknown as { __events: SliderEvent[] }).__events = events;
const record = (type: SliderEvent["type"]) => (value: SliderValue) => {
  events.push({ type, value });
};

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

type Case = Omit<RangeSliderProps<SliderValue>, "onChange" | "onChangeEnd" | "onDragStart" | "onDragEnd">;

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
  "rtl-single": { min: 0, max: 100, defaultValue: 30, dir: "rtl", ariaLabel: "Volume" },
  disabled: { min: 0, max: 100, defaultValue: { min: 20, max: 80 }, disabled: true },
  single: { min: 0, max: 100, defaultValue: 30, ariaLabel: "Volume" },
  three: { min: 0, max: 100, defaultValue: [20, 50, 80] },
  vertical: { min: 0, max: 100, defaultValue: [20, 80], orientation: "vertical" },
  inverted: { min: 0, max: 100, defaultValue: [20, 80], inverted: true },
  form: { min: 0, max: 100, defaultValue: { min: 20, max: 80 }, name: "price" },
  draggable: { min: 0, max: 100, defaultValue: [30, 60], draggableRange: true },
  push: { min: 0, max: 100, defaultValue: [20, 50, 80], collision: "push" },
  "max-gap": { min: 0, max: 100, defaultValue: [20, 40], maxGap: 30 },
  swap: { min: 0, max: 100, defaultValue: [20, 50], collision: "swap" },
  "disabled-thumb": { min: 0, max: 100, defaultValue: [20, 80], disabledThumbs: [true, false] },
  readonly: { min: 0, max: 100, defaultValue: [20, 80], readOnly: true },
  "marks-snap": { min: 0, max: 100, defaultValue: [25, 60], marks: [0, 25, 60, 100].map((v) => ({ value: v, label: String(v) })), snapToMarks: true },
  "marks-edges": { min: 0, max: 1000, step: 10, marks: 4, formatValue: usd },
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
if (props && params.get("variant")) props.variant = params.get("variant") as SliderVariant;
if (props && params.get("size")) props.size = params.get("size") as SliderSize;

const slider = props && (
  <RangeSlider
    {...props}
    width="300px"
    style={thumb ? ({ "--rs-thumb-size": `${thumb}px` } as React.CSSProperties) : undefined}
    onChange={record("change")}
    onChangeEnd={record("end")}
    onDragStart={({ thumb }) => record("dragstart")(thumb)}
    onDragEnd={({ thumb }) => record("dragend")(thumb)}
  />
);

createRoot(document.getElementById("root")!).render(
  !slider ? <p>Unknown case “{name}”</p> : name === "form" ? <form id="form">{slider}</form> : slider
);
