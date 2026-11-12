import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { containShift, groupOverlapping, type TipBox } from "./engine";

// useLayoutEffect measures before the browser paints (no flicker); on the server it does
// nothing, so fall back to useEffect there to avoid React's server warning.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Labels closer than this (px) merge into one. */
const MERGE_GAP = 4;

/** Half-pixel resolution: sub-pixel measuring noise must not re-render forever. */
const round = (n: number) => Math.round(n * 2) / 2;

/** The control's extent along the main axis, or null before layout (hidden, or a test DOM). */
const extentOf = (control: HTMLElement | null, vertical: boolean) => {
  const box = control?.getBoundingClientRect();
  const length = box ? (vertical ? box.height : box.width) : 0;
  return box && length ? { start: vertical ? box.top : box.left, length } : null;
};

/**
 * Each label's centre (its zero-size anchor's position, relative to the control's start) and
 * size along the main axis; null where a label isn't rendered.
 */
const measure = (
  anchors: readonly (HTMLElement | null)[],
  labels: readonly (HTMLElement | null)[],
  count: number,
  start: number,
  vertical: boolean
): (TipBox | null)[] =>
  Array.from({ length: count }, (_, i) => {
    const a = anchors[i]?.getBoundingClientRect();
    const l = labels[i]?.getBoundingClientRect();
    return a && l ? { center: (vertical ? a.top : a.left) - start, size: vertical ? l.height : l.width } : null;
  });

/** Re-renders (so the layout effects measure again) when the slider resizes or web fonts load. */
function useRemeasure(enabled: boolean, control: RefObject<HTMLElement | null>) {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const again = () => alive && bump((n) => n + 1);
    document.fonts?.ready.then(again, () => {});
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(again);
    if (observer && control.current) observer.observe(control.current);
    return () => {
      alive = false;
      observer?.disconnect();
    };
  }, [enabled, control]);
}

/** Inline style nudging a label by `px` along the main axis. */
const shiftStyleFor =
  (vertical: boolean) =>
  (px: number | undefined): CSSProperties | undefined =>
    px ? (vertical ? { top: px } : { left: px }) : undefined;

export interface TooltipLayout {
  /** Thumb indices whose tooltips are merged into one label, ascending; only groups of 2+. */
  merged: number[][];
  /** Shift (px along the main axis) that keeps each thumb's own label inside the slider. */
  shifts: number[];
  /** The same for each merged label, by group. */
  mergedShifts: number[];
}

const NONE: TooltipLayout = { merged: [], shifts: [], mergedShifts: [] };

interface Options {
  enabled: boolean;
  vertical: boolean;
  count: number;
  control: RefObject<HTMLElement | null>;
}

/**
 * Measures the tooltip labels after each render and works out which ones merge and how far
 * each must shift to stay inside the slider. Positions along the track stay in CSS; this only
 * nudges labels, so the arrows keep pointing at their thumbs.
 */
export function useTooltipLayout({ enabled, merge, vertical, count, control }: Options & { merge: boolean }) {
  const anchors = useRef<(HTMLElement | null)[]>([]);
  const labels = useRef<(HTMLElement | null)[]>([]);
  const mergedLabels = useRef<(HTMLElement | null)[]>([]);
  const [layout, setLayout] = useState<TooltipLayout>(NONE);

  useIsoLayoutEffect(() => {
    const extent = enabled ? extentOf(control.current, vertical) : null;
    const measured = extent && measure(anchors.current, labels.current, count, extent.start, vertical);
    if (!extent || !measured || measured.some((t) => !t)) {
      if (layout !== NONE) setLayout(NONE);
      return;
    }
    const tips = measured as TipBox[];
    const merged = merge
      ? groupOverlapping(tips, MERGE_GAP)
          .filter((g) => g.length > 1)
          .map((g) => [...g].sort((a, b) => a - b))
      : [];
    const next: TooltipLayout = {
      merged,
      shifts: tips.map((t) => round(containShift(t.center, t.size, extent.length))),
      mergedShifts: merged.map((g, gi) => {
        const label = mergedLabels.current[gi]?.getBoundingClientRect();
        if (!label) return 0; // rendered on the next pass, then measured
        const center = (tips[g[0]].center + tips[g[g.length - 1]].center) / 2;
        return round(containShift(center, vertical ? label.height : label.width, extent.length));
      }),
    };
    if (JSON.stringify(next) !== JSON.stringify(layout)) setLayout(next);
  });
  useRemeasure(enabled, control);

  return { layout, anchors, labels, mergedLabels, shiftStyle: shiftStyleFor(vertical) };
}

/** Keeps mark labels inside the slider's ends; the marks themselves stay at their values. */
export function useMarkLayout({ enabled, vertical, count, control }: Options) {
  const anchors = useRef<(HTMLElement | null)[]>([]);
  const labels = useRef<(HTMLElement | null)[]>([]);
  const [shifts, setShifts] = useState<number[]>([]);

  useIsoLayoutEffect(() => {
    const extent = enabled ? extentOf(control.current, vertical) : null;
    const next = extent
      ? measure(anchors.current, labels.current, count, extent.start, vertical).map((m) =>
          m ? round(containShift(m.center, m.size, extent.length)) : 0
        )
      : [];
    if (next.join() !== shifts.join()) setShifts(next);
  });
  useRemeasure(enabled, control);

  return { anchors, labels, shifts, shiftStyle: shiftStyleFor(vertical) };
}
