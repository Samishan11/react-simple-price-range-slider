/*
 * Framework-free slider math: snapping, geometry, and which thumb a pointer press grabs.
 * Pure functions only (no React, no DOM), so they are easy to test and reuse.
 * Thumb values are passed as an ordered array (index 0 = lowest).
 */

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

/**
 * Snaps `raw` to the step grid that starts at `min`, like a native range input does:
 * only grid values inside [min, max] are allowed.
 */
export function snapToStep(raw: number, min: number, max: number, step: number) {
  if (!(step > 0) || max <= min) return clamp(raw, min, Math.max(min, max));
  const last = Math.floor((max - min) / step + 1e-9);
  const k = clamp(Math.round((raw - min) / step), 0, last);
  return roundLike(min + k * step, step, min);
}

export interface Bounds {
  min: number;
  max: number;
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

/** Where the slider's interactive area sits on screen, in client pixels. */
export interface Layout {
  left: number;
  width: number;
  /** Thumb diameter. Thumb centres travel from `left + size / 2` to `left + width - size / 2`. */
  size: number;
  rtl: boolean;
}

/** Position along the track for a pointer at clientX `x`: 0 at the min end, 1 at the max end. */
export function fractionAt(x: number, l: Layout) {
  const travel = l.width - l.size;
  if (travel <= 0) return 0;
  const f = clamp((x - l.left - l.size / 2) / travel, 0, 1);
  return l.rtl ? 1 - f : f;
}

/** clientX of the centre of a thumb at track fraction `f` (inverse of `fractionAt`). */
export const centerAt = (f: number, l: Layout) => l.left + l.size / 2 + (l.rtl ? 1 - f : f) * (l.width - l.size);

export type Press =
  /** Exactly one thumb is under the pointer. */
  | { kind: "thumb"; index: number }
  /** Several thumbs overlap under the pointer: the first movement decides (see `pickFromStack`). */
  | { kind: "stack"; indices: number[] }
  /** Bare track: the nearest thumb jumps to the pointer. */
  | { kind: "track"; index: number };

/**
 * What a press at clientX `x` grabs, given each thumb's centre (clientX, in value order)
 * and the thumb radius. On the bare track, the nearest thumb wins; when several thumbs sit
 * at the same spot, the one on the side of the press wins (so it can actually move there).
 */
export function pressAt(x: number, centers: readonly number[], radius: number, rtl: boolean): Press {
  const under = centers.flatMap((c, i) => (Math.abs(x - c) <= radius ? [i] : []));
  if (under.length === 1) return { kind: "thumb", index: under[0] };
  if (under.length > 1) return { kind: "stack", indices: under };
  let best = 0;
  for (let i = 1; i < centers.length; i++) {
    const d = Math.abs(x - centers[i]);
    const bestD = Math.abs(x - centers[best]);
    const pressIsHigher = rtl ? x < centers[i] : x > centers[i];
    if (d < bestD || (d === bestD && pressIsHigher)) best = i;
  }
  return { kind: "track", index: best };
}

/**
 * For overlapping thumbs: moving toward higher values takes the highest one, moving toward
 * lower values the lowest one. The picked thumb always moves away from the others, so a
 * stack can never get stuck.
 */
export const pickFromStack = (indices: readonly number[], towardHigher: boolean) =>
  towardHigher ? Math.max(...indices) : Math.min(...indices);
