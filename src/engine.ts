/*
 * Framework-free slider math: values, stops, geometry, keyboard, and which thumb a pointer
 * press grabs. Pure functions only (no React, no DOM), so they are easy to test and reuse.
 * Thumb values are passed as an ascending array (index 0 = lowest).
 */
import type { RangeValues, SliderValue, Step } from "./types";

export const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/** Number of decimal places in `n`, including exponent forms such as `1e-7`. */
export const decimalsOf = (n: number) => {
  if (!Number.isFinite(n)) return 0;
  const [mantissa, exponent = "0"] = String(n).toLowerCase().split("e");
  return Math.max(0, (mantissa.split(".")[1] ?? "").length - Number(exponent));
};

/**
 * Rounds `n` to the most decimals used by `refs`, removing binary noise from the
 * arithmetic (e.g. `0.4 - 0.1 = 0.30000000000000004` becomes `0.3`).
 */
export const roundLike = (n: number, ...refs: number[]) =>
  Number(n.toFixed(Math.min(20, Math.max(...refs.map(decimalsOf)))));

// ---- values ------------------------------------------------------------------------------

export type Shape = "number" | "array" | "object";

const isList = (v: SliderValue): v is readonly number[] => Array.isArray(v);

export const shapeOf = (v: SliderValue | undefined): Shape | undefined =>
  v === undefined ? undefined : typeof v === "number" ? "number" : isList(v) ? "array" : "object";

/** Any slider value as a plain array of thumb values. */
export const toValues = (v: SliderValue): number[] =>
  typeof v === "number" ? [v] : isList(v) ? [...v] : [(v as RangeValues).min, (v as RangeValues).max];

/** Thumb values back in the shape the slider was given. */
export const fromValues = (values: readonly number[], shape: Shape): number | number[] | RangeValues =>
  shape === "number"
    ? values[0]
    : shape === "object"
      ? { min: values[0], max: values[values.length - 1] }
      : [...values];

/** Clamps every value into [min, max] (non-numbers become `min`) and sorts them ascending. */
export const normalize = (values: readonly number[], min: number, max: number) =>
  values.map((v) => (Number.isFinite(v) ? clamp(v, min, max) : min)).sort((a, b) => a - b);

// ---- stops -------------------------------------------------------------------------------

const stepSize = (step: Step) => (typeof step === "number" && step > 0 ? step : 0);

/**
 * The nearest allowed value ("stop"): the grid `min + k * step` inside [min, max], plus `max`
 * itself, so `max` stays reachable even when `max - min` isn't a multiple of `step`.
 */
export function snapToStop(raw: number, min: number, max: number, step: Step) {
  const value = clamp(raw, min, max);
  const s = stepSize(step);
  if (!s || max <= min) return value;
  const k = Math.floor((value - min) / s + 1e-9);
  const below = roundLike(min + k * s, s, min);
  const above = Math.min(roundLike(min + (k + 1) * s, s, min), max);
  return value - below < above - value ? below : above;
}

/**
 * The stop `count` stops away from `value` (negative = down). From a value between stops the
 * first step lands on the next stop in that direction. Without a step (`"any"`), one step is
 * 1% of the range.
 */
export function stepFrom(value: number, count: number, min: number, max: number, step: Step) {
  if (count === 0) return value;
  const s = stepSize(step) || (max - min) / 100;
  if (!(s > 0)) return clamp(value, min, max);
  const position = (value - min) / s;
  const k = count > 0 ? Math.floor(position + 1e-9) + count : Math.ceil(position - 1e-9) + count;
  return clamp(roundLike(min + k * s, s, min), min, max);
}

/**
 * A value set from outside (assistive technology, autofill): the nearest stop, but at least one
 * stop away from `current` in the direction it moved, so a screen reader's small "increment"
 * never snaps back to where it started.
 */
export function settle(raw: number, current: number, min: number, max: number, step: Step) {
  if (Number.isNaN(raw)) return current;
  const snapped = snapToStop(raw, min, max, step);
  if (snapped !== current || raw === current) return snapped;
  return stepFrom(current, raw > current ? 1 : -1, min, max, step);
}

/** Stops in a large step (PageUp/PageDown, Shift+Arrow): `largeStep` if given, else ~10% of the range. */
export function largeStepCount(min: number, max: number, step: Step, largeStep?: number) {
  const s = stepSize(step) || (max - min) / 100;
  if (!(s > 0)) return 1;
  const size = largeStep && largeStep > 0 ? largeStep : (max - min) / 10;
  return Math.max(1, Math.round(size / s));
}

// ---- constraints ---------------------------------------------------------------------------

export interface Bounds {
  min: number;
  max: number;
  /** Used only to round away float noise; pass 0 for `"any"`. */
  step: number;
  /** Minimum distance kept between neighbouring thumbs. */
  gap: number;
}

/** Moves thumb `index` toward `target`, stopping at its neighbours (keeping `gap` between them). */
export function moveThumb(values: readonly number[], index: number, target: number, b: Bounds): number[] {
  const refs = [b.step, b.min, b.max, b.gap, ...values];
  const lo = index > 0 ? roundLike(values[index - 1] + b.gap, ...refs) : b.min;
  const hi = index < values.length - 1 ? roundLike(values[index + 1] - b.gap, ...refs) : b.max;
  const next = values.slice();
  next[index] = clamp(target, lo, hi);
  return next;
}

// ---- geometry ------------------------------------------------------------------------------

/** Where the slider's interactive area sits on screen along its main axis, in client pixels. */
export interface Layout {
  /** Left edge (horizontal) or top edge (vertical) of the control. */
  start: number;
  /** Width (horizontal) or height (vertical) of the control. */
  length: number;
  /** Thumb diameter. Thumb centres travel from `start + size / 2` to `start + length - size / 2`. */
  size: number;
  /** True when values grow toward `start`: right-to-left, vertical (min at the bottom) or inverted. */
  reversed: boolean;
}

/** Position along the track for a pointer at `pos`: 0 at the min end, 1 at the max end. */
export function fractionAt(pos: number, l: Layout) {
  const travel = l.length - l.size;
  if (travel <= 0) return 0;
  const f = clamp((pos - l.start - l.size / 2) / travel, 0, 1);
  return l.reversed ? 1 - f : f;
}

/** Screen position of the centre of a thumb at track fraction `f` (inverse of `fractionAt`). */
export const centerAt = (f: number, l: Layout) =>
  l.start + l.size / 2 + (l.reversed ? 1 - f : f) * (l.length - l.size);

// ---- pointer -------------------------------------------------------------------------------

export type Press =
  /** Exactly one thumb is under the pointer. */
  | { kind: "thumb"; index: number }
  /** Several thumbs overlap under the pointer: the first movement decides (see `pickFromStack`). */
  | { kind: "stack"; indices: number[] }
  /** Bare track: the nearest thumb jumps to the pointer. */
  | { kind: "track"; index: number };

/**
 * What a press at `pos` grabs, given each thumb's centre (in value order) and the thumb
 * radius. On the bare track the nearest thumb wins; when several thumbs sit at the same spot,
 * the one on the side of the press wins (so it can actually move there).
 */
export function pressAt(pos: number, centers: readonly number[], radius: number, reversed: boolean): Press {
  const under = centers.flatMap((c, i) => (Math.abs(pos - c) <= radius ? [i] : []));
  if (under.length === 1) return { kind: "thumb", index: under[0] };
  if (under.length > 1) return { kind: "stack", indices: under };
  let best = 0;
  for (let i = 1; i < centers.length; i++) {
    const d = Math.abs(pos - centers[i]);
    const bestD = Math.abs(pos - centers[best]);
    const pressIsHigher = reversed ? pos < centers[i] : pos > centers[i];
    if (d < bestD || (d === bestD && pressIsHigher)) best = i;
  }
  return { kind: "track", index: best };
}

/**
 * For overlapping thumbs: moving toward higher values takes the highest one, toward lower values
 * the lowest one. The picked thumb always moves away from the others, so a stack never gets stuck.
 */
export const pickFromStack = (indices: readonly number[], towardHigher: boolean) =>
  towardHigher ? Math.max(...indices) : Math.min(...indices);

// ---- keyboard ------------------------------------------------------------------------------

export type KeyCommand = { steps: number } | { to: "min" | "max" };

export interface KeyOptions {
  shift: boolean;
  /** Stops in a large step (see `largeStepCount`). */
  large: number;
  /** Swap Left/Right: right-to-left or inverted horizontal sliders. */
  flipLeftRight: boolean;
  /** Swap Up/Down: inverted vertical sliders. */
  flipUpDown: boolean;
}

// ---- tooltips ------------------------------------------------------------------------------

/** A tooltip label along the slider's main axis, in px from the control's start (screen order). */
export interface TipBox {
  /** Centre of the label: the thumb centre it points at. */
  center: number;
  /** Width (horizontal) or height (vertical) of the label. */
  size: number;
}

/**
 * Groups neighbouring tooltips whose labels would overlap or come closer than `gap`, walking
 * them in screen order. A group of one is a tooltip shown on its own; larger groups merge.
 */
export function groupOverlapping(tips: readonly TipBox[], gap: number): number[][] {
  const order = tips.map((_, i) => i).sort((a, b) => tips[a].center - tips[b].center);
  const groups: number[][] = [];
  for (const i of order) {
    const group = groups[groups.length - 1];
    const prev = group && tips[group[group.length - 1]];
    if (prev && prev.center + prev.size / 2 + gap > tips[i].center - tips[i].size / 2) group.push(i);
    else groups.push([i]);
  }
  return groups;
}

/**
 * How far to move a label centred at `center` so it stays inside [0, length]. A label wider
 * than the slider lines up with its start.
 */
export function containShift(center: number, size: number, length: number) {
  const start = center - size / 2;
  if (size >= length || start < 0) return -start;
  const end = center + size / 2;
  return end > length ? length - end : 0;
}

// ---- keyboard (continued) --------------------------------------------------------------------

/** What a key does to a focused thumb (WAI-ARIA slider pattern), or null for other keys. */
export function keyCommand(key: string, o: KeyOptions): KeyCommand | null {
  const n = o.shift ? o.large : 1;
  switch (key) {
    case "ArrowRight":
      return { steps: o.flipLeftRight ? -n : n };
    case "ArrowLeft":
      return { steps: o.flipLeftRight ? n : -n };
    case "ArrowUp":
      return { steps: o.flipUpDown ? -n : n };
    case "ArrowDown":
      return { steps: o.flipUpDown ? n : -n };
    case "PageUp":
      return { steps: o.large };
    case "PageDown":
      return { steps: -o.large };
    case "Home":
      return { to: "min" };
    case "End":
      return { to: "max" };
    default:
      return null;
  }
}
