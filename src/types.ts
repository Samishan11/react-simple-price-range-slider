import type { ReactNode } from "react";

/** A two-thumb value as an object: the 1.x / 2.x shape. */
export interface RangeValues {
  min: number;
  max: number;
}

/**
 * What a slider holds. The shape you pass in is the shape you get back:
 * a number (one thumb), an array (one thumb per entry) or `{ min, max }` (two thumbs).
 */
export type SliderValue = number | readonly number[] | RangeValues;

/** The plain type `onChange` reports for a value of type `V` (number, number[] or RangeValues). */
export type ValueOf<V extends SliderValue> = V extends number
  ? number
  : V extends readonly number[]
    ? number[]
    : RangeValues;

export interface Mark {
  value: number;
  label?: ReactNode;
}

export type SliderSlot =
  | "root"
  | "control"
  | "track"
  | "range"
  | "thumb"
  | "tooltip"
  | "tooltipLabel"
  | "marks"
  | "mark"
  | "markLabel"
  | "values"
  | "value"
  | "separator";

/** Everything a custom thumb or tooltip renderer needs to know about one thumb. */
export interface ThumbState {
  /** Index of the thumb (0 = lowest value). */
  index: number;
  value: number;
  /** The value as `formatValue` (or the currency prefix) shows it. */
  formatted: string;
  /** Used last, so drawn on top. */
  active: boolean;
  hover: boolean;
  dragging: boolean;
  /** Focused from the keyboard (show a focus ring). */
  focusVisible: boolean;
  disabled: boolean;
}

export type Orientation = "horizontal" | "vertical";

/** `"any"` (or a non-positive number) means no stepping: every value is allowed. */
export type Step = number | "any";

/** Passed to `onChange` / `onChangeEnd` alongside the value. */
export interface ChangeMeta {
  /** Index of the thumb that moved (0 = lowest value). */
  thumb: number;
  /**
   * What moved it: a pointer (drag or track press), a key, or a value set directly on the
   * thumb's input by assistive technology or autofill.
   */
  source: "pointer" | "keyboard" | "input";
}
