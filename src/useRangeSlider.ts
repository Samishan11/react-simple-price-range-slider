import React, { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  applyMove,
  centerAt,
  fractionAt,
  keyCommand,
  largeStepCount,
  normalize,
  pickFromStack,
  pressAt,
  settle,
  shiftAll,
  snapToStop,
  stepFrom,
  type Layout,
  type StopRule,
} from "./engine";
import type { ChangeMeta, Collision, DragMeta, Orientation, Step } from "./types";

export interface UseRangeSliderOptions {
  min: number;
  max: number;
  /** Granularity. `"any"` allows every value. Default `1`. */
  step?: Step;
  /** Only these values are allowed (e.g. the marks); takes precedence over `step`. */
  stops?: readonly number[];
  /** Controlled thumb values (clamped into range and sorted). */
  values?: readonly number[];
  /** Initial thumb values when uncontrolled. Default `[min, max]`. */
  defaultValues?: readonly number[];
  onChange?: (values: number[], meta: ChangeMeta) => void;
  /** Fires when a drag, key press or assistive-technology adjustment is committed. */
  onChangeEnd?: (values: number[], meta: ChangeMeta) => void;
  /** A pointer starts dragging a thumb (or the range: `thumb` is -1). */
  onDragStart?: (meta: DragMeta) => void;
  /** That drag ends. */
  onDragEnd?: (meta: DragMeta) => void;
  /** Minimum distance between neighbouring thumbs. Default `0`: thumbs can meet. */
  minGap?: number;
  /** Maximum distance between neighbouring thumbs ("block" stops there; "push" pulls the neighbour along). */
  maxGap?: number;
  /** When a thumb meets its neighbour: stop (`"block"`, default), push it, or pass it (`"swap"`). */
  collision?: Collision;
  /** Size of a PageUp/PageDown or Shift+Arrow step. Default: about 10% of the range. */
  largeStep?: number;
  disabled?: boolean;
  /** Thumbs that can't move, by index; e.g. `[true, false]` locks the lowest. */
  disabledThumbs?: readonly boolean[];
  /** Shows the values but ignores input; the thumbs stay focusable so screen readers can read them. */
  readOnly?: boolean;
  /** Pressing the filled range and dragging moves all thumbs together. */
  draggableRange?: boolean;
  orientation?: Orientation;
  /** Puts the maximum at the start: left (right in RTL), or top when vertical. */
  inverted?: boolean;
}

/** How far (px) the pointer must move before a press on overlapping thumbs picks one. */
const PICK_DISTANCE = 3;

/** `Drag.thumb` value while the whole range is being dragged. */
const RANGE = -1;

/**
 * Focus for a thumb grabbed with the pointer: keyboard control continues on it, without a focus
 * ring. (`focusVisible` is in the HTML spec and all current engines, not yet in TypeScript's DOM types.)
 */
const POINTER_FOCUS = { preventScroll: true, focusVisible: false } as FocusOptions;

/** Keys whose release commits a keyboard adjustment (fires onChangeEnd). */
const COMMIT_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

/**
 * Thumb diameter until the real thumb has been measured (first render, server rendering):
 * the theme variable, or 24px without the stylesheet.
 */
const THEME_SIZE = "var(--rs-thumb-size, 24px)";
const percent = (f: number) => `${f * 100}%`;

// Layout effects measure before the browser paints; on the server they do nothing, so use
// useEffect there to avoid React's server warning.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Invisible, but focusable and in the accessibility tree; it covers its thumb so screen readers outline the thumb. */
const HIDDEN_INPUT: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  margin: 0,
  padding: 0,
  border: 0,
  opacity: 0,
  pointerEvents: "none",
  appearance: "none",
  WebkitAppearance: "none",
};

interface Drag {
  pointerId: number;
  /** The dragged thumb, RANGE for the whole range, or null while overlapping thumbs wait for movement. */
  thumb: number | null;
  /** Thumbs under the pointer when it went down (used while `thumb` is null). */
  stack: number[];
  /** Pointer position (main axis) when it went down. */
  start: number;
  /** Pointer distance from the grabbed thumb's centre, so the thumb never jumps to the pointer. */
  offset: number;
  /** Values when a range drag started: it moves them all by the pointer's distance. */
  startValues: number[];
  /** onDragStart has fired (so onDragEnd must). */
  started: boolean;
  layout: Layout;
}

const attr = (on: boolean) => (on ? "" : undefined);

/** Computed direction, falling back to the nearest `dir` attribute where styles aren't computed. */
const isRtl = (el: Element) => {
  const computed = getComputedStyle(el).direction;
  return computed ? computed === "rtl" : el.closest("[dir]")?.getAttribute("dir")?.toLowerCase() === "rtl";
};

/**
 * Headless range slider: state, pointer / keyboard / assistive-technology input and positions for
 * any number of thumbs. Render the parts with the returned prop getters; positions come as inline
 * styles, so the slider works with or without the stylesheet.
 */
export function useRangeSlider(options: UseRangeSliderOptions) {
  const {
    min,
    max,
    step = 1,
    minGap,
    maxGap,
    largeStep,
    collision = "block",
    disabled = false,
    readOnly = false,
    orientation = "horizontal",
    inverted = false,
  } = options;
  const vertical = orientation === "vertical";
  const controlled = options.values !== undefined;
  /** Where thumbs may stop: the listed values, or the step grid. */
  const rule: StopRule = options.stops ?? step;

  const [inner, setInner] = useState<number[]>(() => normalize(options.defaultValues ?? [min, max], min, max));
  const values = normalize(controlled ? options.values! : inner, min, max);
  const count = values.length;
  const locked = values.map((_, i) => disabled || !!options.disabledThumbs?.[i]);
  const inert = disabled || readOnly;
  const rangeDraggable = !!options.draggableRange && count > 1 && !inert && !locked.some(Boolean) && !options.stops;

  const [lastUsed, setLastUsed] = useState(count - 1);
  const [hover, setHover] = useState<number | "range" | null>(null);
  const [dragging, setDragging] = useState<number | "pending" | "range" | null>(null);
  const [focusVisible, setFocusVisible] = useState<number | null>(null);
  const active = Math.min(lastUsed, count - 1);

  const controlRef = useRef<HTMLDivElement | null>(null);
  const thumbs = useRef<(HTMLElement | null)[]>([]);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const drag = useRef<Drag | null>(null);
  const lastMeta = useRef<ChangeMeta>({ thumb: 0, source: "pointer" });

  // Thumbs can be sized by anything (the theme variable, utility classes), so positions and
  // pointer math use the first thumb's measured size. Layout size ignores hover/drag scaling.
  const [thumbPx, setThumbPx] = useState<number | null>(null);
  const measureThumb = () => {
    const t = thumbs.current[0];
    const px = t ? (vertical ? t.offsetHeight : t.offsetWidth) : 0;
    return px > 0 ? px : null;
  };
  useIsoLayoutEffect(() => {
    const update = () => setThumbPx(measureThumb());
    update();
    const t = thumbs.current[0];
    if (!t || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(t, { box: "border-box" });
    return () => observer.disconnect();
  }, [vertical, count]);
  /** The thumb diameter as CSS: measured once mounted, the theme's before that. */
  const size = thumbPx ? `${thumbPx}px` : THEME_SIZE;
  /** Offset that puts an element's anchor at track fraction `f`. Thumbs travel inside the control. */
  const along = (f: number) => `calc(${size} / 2 + (100% - ${size}) * ${f})`;

  const span = max - min || 1;
  const fractions = values.map((v) => (v - min) / span);
  const gap = Math.max(minGap ?? 0, 0);
  const bounds = { min, max, step: typeof step === "number" ? step : 0, gap, maxGap: maxGap === undefined ? undefined : Math.max(maxGap, gap) };

  // The latest values, including a change committed in this event that hasn't rendered yet,
  // so onChangeEnd never reports a stale value.
  const latest = useRef(values);
  latest.current = values;

  const commit = (next: number[], meta: ChangeMeta) => {
    lastMeta.current = meta;
    if (next.every((v, i) => v === values[i])) return;
    latest.current = next;
    if (!controlled) setInner(next);
    options.onChange?.(next, meta);
  };
  /** Moves a thumb under the collision rule; returns its index afterwards (it changes on a swap). */
  const moveTo = (thumb: number, target: number, source: ChangeMeta["source"]) => {
    const moved = applyMove(values, thumb, target, bounds, collision, locked);
    commit(moved.values, { thumb: moved.index, source });
    return moved.index;
  };
  const finish = () => options.onChangeEnd?.(latest.current, lastMeta.current);
  const latestFinish = useRef(finish);
  latestFinish.current = finish;

  // Assistive technology (e.g. a screen reader's increment) and autofill change the input
  // directly and fire a native `change` when done. Listen on the root node, after React has
  // handled the event, so onChangeEnd reports the new value.
  useEffect(() => {
    const root = controlRef.current?.getRootNode() as Document | ShadowRoot | undefined;
    if (!root) return;
    const onCommit = (e: Event) => {
      if (inputs.current.includes(e.target as HTMLInputElement)) latestFinish.current();
    };
    root.addEventListener("change", onCommit);
    return () => root.removeEventListener("change", onCommit);
  }, []);

  // ---- pointer ---------------------------------------------------------------------------

  const layoutOf = (el: HTMLElement): Layout => {
    const r = el.getBoundingClientRect();
    if (vertical) return { start: r.top, length: r.height, size: measureThumb() ?? r.width, reversed: !inverted };
    return { start: r.left, length: r.width, size: measureThumb() ?? r.height, reversed: isRtl(el) !== inverted };
  };
  const posOf = (e: { clientX: number; clientY: number }) => (vertical ? e.clientY : e.clientX);
  const centersFor = (l: Layout) => fractions.map((f) => centerAt(f, l));
  const valueAt = (pos: number, l: Layout) => snapToStop(min + fractionAt(pos, l) * (max - min), min, max, rule);

  const pointerFocusing = useRef(false);
  const focusThumb = (thumb: number) => {
    pointerFocusing.current = true;
    inputs.current[thumb]?.focus(POINTER_FOCUS);
    pointerFocusing.current = false;
  };
  const grab = (d: Drag, thumb: number) => {
    d.thumb = thumb;
    d.started = true;
    lastMeta.current = { thumb, source: "pointer" };
    setLastUsed(thumb);
    setDragging(thumb);
    focusThumb(thumb);
    options.onDragStart?.({ thumb });
  };
  const release = (d: Drag) => {
    if (d.started) options.onDragEnd?.({ thumb: d.thumb ?? RANGE });
  };

  const trackHover = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || inert) return;
    const l = layoutOf(e.currentTarget);
    const c = centersFor(l);
    const pos = posOf(e);
    // Where thumbs overlap, the one drawn on top (the last used) wins; locked thumbs don't react.
    const order = [active, ...values.map((_, i) => i).filter((i) => i !== active)].filter((i) => !locked[i]);
    let next: number | "range" | null = order.find((i) => Math.abs(pos - c[i]) <= l.size / 2) ?? null;
    if (next === null && rangeDraggable && pos > Math.min(c[0], c[count - 1]) && pos < Math.max(c[0], c[count - 1]))
      next = "range";
    if (next !== hover) setHover(next);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only the primary pointer drags (a second finger is ignored), and only the main mouse button.
    if (inert || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    const l = layoutOf(e.currentTarget);
    if (l.length <= l.size) return; // not laid out (hidden, or a test DOM)
    const c = centersFor(l);
    const pos = posOf(e);
    const press = pressAt(pos, c, l.size / 2, { reversed: l.reversed, locked, range: rangeDraggable });
    if (press.kind === "none") return;
    if (drag.current) {
      release(drag.current); // a previous drag whose release we never saw
      finish();
    }
    e.preventDefault(); // no text selection; focus moves to the grabbed thumb instead
    setHover(null);
    setFocusVisible(null);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // the pointer is already gone
    }
    const d: Drag = { pointerId: e.pointerId, thumb: null, stack: [], start: pos, offset: 0, startValues: values, started: false, layout: l };
    drag.current = d;
    if (press.kind === "stack") {
      d.stack = press.indices;
      setDragging("pending");
      return;
    }
    if (press.kind === "range") {
      d.thumb = RANGE;
      d.started = true;
      lastMeta.current = { thumb: RANGE, source: "pointer" };
      setDragging("range");
      options.onDragStart?.({ thumb: RANGE });
      return;
    }
    grab(d, press.index);
    if (press.kind === "thumb") d.offset = pos - c[press.index];
    else d.thumb = moveTo(press.index, valueAt(pos, l), "pointer"); // bare track: jump there
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return trackHover(e);
    if (e.pointerId !== d.pointerId) return;
    const pos = posOf(e);
    if (d.thumb === RANGE) {
      // The whole range follows the pointer, in whole steps, keeping its spacing.
      const delta = (fractionAt(pos, d.layout, true) - fractionAt(d.start, d.layout, true)) * (max - min);
      const s = bounds.step > 0 ? bounds.step : 0;
      commit(shiftAll(d.startValues, s ? Math.round(delta / s) * s : delta, bounds), { thumb: RANGE, source: "pointer" });
      return;
    }
    if (d.thumb === null) {
      const delta = pos - d.start;
      if (Math.abs(delta) < PICK_DISTANCE) return;
      const thumb = pickFromStack(d.stack, delta > 0 !== d.layout.reversed);
      d.offset = d.start - centersFor(d.layout)[thumb];
      grab(d, thumb);
    }
    const now = moveTo(d.thumb!, valueAt(pos - d.offset, d.layout), "pointer");
    if (now !== d.thumb) {
      // Swapped past a neighbour: keep dragging (and focusing) the same visual thumb.
      d.thumb = now;
      setLastUsed(now);
      setDragging(now);
      focusThumb(now);
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    setDragging(null);
    trackHover(e); // the pointer may have been released away from the thumb
    release(d);
    finish();
  };

  // ---- keyboard & assistive technology -------------------------------------------------------

  const onKeyDown = (thumb: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    const rtl = !vertical && isRtl(e.currentTarget);
    const command = keyCommand(e.key, {
      shift: e.shiftKey,
      large: largeStepCount(min, max, rule, largeStep),
      flipLeftRight: !vertical && rtl !== inverted,
      flipUpDown: vertical && inverted,
    });
    if (!command) return;
    e.preventDefault(); // the slider handles the key (and a read-only one swallows it)
    setFocusVisible(thumb);
    if (inert || locked[thumb]) return;
    const target =
      "to" in command ? (command.to === "min" ? min : max) : stepFrom(values[thumb], command.steps, min, max, rule);
    const now = moveTo(thumb, target, "keyboard");
    if (now !== thumb) {
      // Swapped past a neighbour: keyboard focus follows the thumb.
      setLastUsed(now);
      setFocusVisible(now);
      inputs.current[now]?.focus();
    }
  };

  // ---- prop getters --------------------------------------------------------------------------

  /** Inline position of an anchor (thumb, tooltip, mark) at track fraction `f`. */
  const alongStyle = (f: number): CSSProperties =>
    vertical
      ? { [inverted ? "top" : "bottom"]: along(f) }
      : { [inverted ? "insetInlineEnd" : "insetInlineStart"]: along(f) };

  const half = `calc(${size} / -2)`;
  const lo = count > 1 ? fractions[0] : 0;
  const hi = fractions[count - 1];

  return {
    /** Current thumb values, ascending. */
    values,
    /** Each thumb's position along the track: 0 = min end, 1 = max end. */
    fractions,
    orientation,
    disabled,
    readOnly,
    /** Per thumb: can't move (disabled, or listed in `disabledThumbs`). */
    locked,
    /** Index of the thumb used last (drawn on top). */
    active,
    /** The control element (set through `getControlProps`), e.g. for measuring. */
    controlRef,
    /** The hovered thumb, `"range"` for a draggable range, or null. */
    hover,
    /** The dragged thumb, `"range"`, `"pending"` (overlapping thumbs, before the first move) or null. */
    dragging,
    focusVisible,
    alongStyle,
    /** The thumb diameter as a CSS length (measured once mounted). */
    thumbSize: size,

    /** Moves keyboard focus to a thumb. */
    focus: (thumb = 0) => inputs.current[thumb]?.focus(),
    blur: () => inputs.current.forEach((el) => el?.blur()),
    /** The latest values, including a change not rendered yet. */
    getValues: () => latest.current.slice(),
    /** Sets the values of an uncontrolled slider (no-op when controlled: update `values`). */
    setValues: (next: readonly number[]) => {
      if (!controlled) setInner(normalize(next, min, max));
    },

    getControlProps: () => ({
      ref: controlRef,
      // At least one thumb thick, so thumbs never hang outside the slider's box.
      style: {
        position: "relative",
        touchAction: vertical ? "pan-x" : "pan-y",
        [vertical ? "minWidth" : "minHeight"]: size,
      } as CSSProperties,
      "data-hover": attr(hover !== null),
      "data-dragging": attr(dragging !== null),
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onLostPointerCapture: endDrag,
      onPointerLeave: () => {
        if (hover !== null) setHover(null);
      },
    }),

    getTrackProps: () => ({
      style: (vertical
        ? { position: "absolute", top: `calc(${size} / 2)`, bottom: `calc(${size} / 2)`, left: 0, right: 0, marginInline: "auto" }
        : { position: "absolute", insetInline: `calc(${size} / 2)`, top: 0, bottom: 0, marginBlock: "auto" }) as CSSProperties,
    }),

    /** The filled part: between the outer thumbs, or from the min end with a single thumb. */
    getRangeProps: () => ({
      style: (vertical
        ? { position: "absolute", left: 0, right: 0, [inverted ? "top" : "bottom"]: percent(lo), [inverted ? "bottom" : "top"]: percent(1 - hi) }
        : {
            position: "absolute",
            top: 0,
            bottom: 0,
            [inverted ? "insetInlineEnd" : "insetInlineStart"]: percent(lo),
            [inverted ? "insetInlineStart" : "insetInlineEnd"]: percent(1 - hi),
          }) as CSSProperties,
      "data-draggable": attr(rangeDraggable),
      "data-hover": attr(hover === "range"),
      "data-dragging": attr(dragging === "range"),
    }),

    getThumbProps: (i: number) => ({
      ref: (el: HTMLElement | null) => {
        thumbs.current[i] = el;
      },
      style: {
        position: "absolute",
        ...(vertical
          ? { left: 0, right: 0, marginInline: "auto", [inverted ? "marginTop" : "marginBottom"]: half }
          : { top: 0, bottom: 0, marginBlock: "auto", [inverted ? "marginInlineEnd" : "marginInlineStart"]: half }),
        ...alongStyle(fractions[i]),
      } as CSSProperties,
      "data-index": i,
      "data-active": attr(i === active),
      "data-hover": attr(i === hover),
      "data-dragging": attr(i === dragging || dragging === "range"),
      "data-focus-visible": attr(i === focusVisible),
      "data-disabled": attr(locked[i]),
    }),

    getInputProps: (i: number) => ({
      ref: (el: HTMLInputElement | null) => {
        inputs.current[i] = el;
      },
      type: "range" as const,
      min,
      max,
      // The thumbs snap themselves; "any" keeps the browser from re-snapping (e.g. an off-grid max).
      step: "any",
      value: values[i],
      disabled: locked[i],
      "aria-readonly": readOnly || undefined,
      "aria-orientation": vertical ? ("vertical" as const) : undefined,
      style: HIDDEN_INPUT,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!inert && !locked[i]) moveTo(i, settle(Number(e.target.value), values[i], min, max, rule), "input");
      },
      onKeyDown: onKeyDown(i),
      onKeyUp: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (COMMIT_KEYS.has(e.key) && !inert) finish();
      },
      onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
        setLastUsed(i);
        let keyboard = !pointerFocusing.current;
        try {
          keyboard = keyboard && e.currentTarget.matches(":focus-visible");
        } catch {
          // :focus-visible unsupported: treat non-pointer focus as keyboard focus
        }
        setFocusVisible(keyboard ? i : null);
      },
      onBlur: () => setFocusVisible((f) => (f === i ? null : f)),
    }),
  };
}

export type RangeSliderState = ReturnType<typeof useRangeSlider>;
