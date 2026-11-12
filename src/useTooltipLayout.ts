import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { containShift, groupOverlapping, type TipBox } from "./engine";

// useLayoutEffect measures before the browser paints (no flicker); on the server it does
// nothing, so fall back to useEffect there to avoid React's server warning.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Labels closer than this (px) merge into one. */
const MERGE_GAP = 4;

export interface TooltipLayout {
  /** Thumb indices whose tooltips are merged into one label, ascending; only groups of 2+. */
  merged: number[][];
  /** Shift (px along the main axis) that keeps each thumb's own label inside the slider. */
  shifts: number[];
  /** The same for each merged label, by group. */
  mergedShifts: number[];
}

const NONE: TooltipLayout = { merged: [], shifts: [], mergedShifts: [] };
/** Half-pixel resolution: sub-pixel measuring noise must not re-render forever. */
const round = (n: number) => Math.round(n * 2) / 2;

interface Options {
  enabled: boolean;
  /** Merge overlapping labels (always-on tooltips; hover tooltips show one at a time). */
  merge: boolean;
  vertical: boolean;
  count: number;
  control: RefObject<HTMLElement | null>;
}

/**
 * Measures the tooltip labels after each render and works out which ones merge and how far
 * each must shift to stay inside the slider. Positions along the track stay in CSS; this only
 * nudges labels, so the arrows keep pointing at their thumbs.
 */
export function useTooltipLayout({ enabled, merge, vertical, count, control }: Options) {
  const anchors = useRef<(HTMLElement | null)[]>([]);
  const labels = useRef<(HTMLElement | null)[]>([]);
  const mergedLabels = useRef<(HTMLElement | null)[]>([]);
  const [layout, setLayout] = useState<TooltipLayout>(NONE);
  const [, remeasure] = useState(0);

  useIsoLayoutEffect(() => {
    const el = control.current;
    const box = el?.getBoundingClientRect();
    const length = box ? (vertical ? box.height : box.width) : 0;
    if (!enabled || !box || !length) {
      if (layout !== NONE) setLayout(NONE);
      return; // nothing to lay out, or not laid out yet (hidden, or a test DOM)
    }
    const start = vertical ? box.top : box.left;
    const tips: TipBox[] = [];
    for (let i = 0; i < count; i++) {
      const anchor = anchors.current[i]?.getBoundingClientRect();
      const label = labels.current[i]?.getBoundingClientRect();
      if (!anchor || !label) return;
      // Anchors are zero-width (zero-height when vertical) at the thumb centre.
      tips.push({ center: (vertical ? anchor.top : anchor.left) - start, size: vertical ? label.height : label.width });
    }
    const merged = merge
      ? groupOverlapping(tips, MERGE_GAP)
          .filter((g) => g.length > 1)
          .map((g) => [...g].sort((a, b) => a - b))
      : [];
    const next: TooltipLayout = {
      merged,
      shifts: tips.map((t) => round(containShift(t.center, t.size, length))),
      mergedShifts: merged.map((g, gi) => {
        const label = mergedLabels.current[gi]?.getBoundingClientRect();
        if (!label) return 0; // rendered on the next pass, then measured
        const center = (tips[g[0]].center + tips[g[g.length - 1]].center) / 2;
        return round(containShift(center, vertical ? label.height : label.width, length));
      }),
    };
    if (JSON.stringify(next) !== JSON.stringify(layout)) setLayout(next);
  });

  // Re-fit when the slider is resized or web fonts change the labels' widths.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const bump = () => alive && remeasure((n) => n + 1);
    document.fonts?.ready.then(bump, () => {});
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(bump);
    if (observer && control.current) observer.observe(control.current);
    return () => {
      alive = false;
      observer?.disconnect();
    };
  }, [enabled, control]);

  /** Inline style nudging a label by `px` along the main axis. */
  const shiftStyle = (px: number | undefined): CSSProperties | undefined =>
    px ? (vertical ? { top: px } : { left: px }) : undefined;

  return { layout, anchors, labels, mergedLabels, shiftStyle };
}
