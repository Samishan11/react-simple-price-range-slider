import React, { CSSProperties, FC, ReactNode, useRef, useState } from "react";
import { centerAt, clamp, fractionAt, moveThumb, pickFromStack, pressAt, snapToStep, type Layout } from "./engine";

export interface RangeValues {
  min: number;
  max: number;
}

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
  | "marks"
  | "mark"
  | "values"
  | "value";

export interface MultiRangeSliderProps {
  /** Lowest value the slider can reach. */
  min: number;
  /** Highest value the slider can reach. */
  max: number;
  /** Controlled value. Pair with `onChange`. */
  value?: RangeValues;
  /** Initial value for uncontrolled usage. Defaults to the full range. */
  defaultValue?: RangeValues;
  /** Fires on every change while dragging or using the keyboard. */
  onChange?: (values: RangeValues) => void;
  /** Fires once when the user finishes a drag or keyboard adjustment. */
  onChangeEnd?: (values: RangeValues) => void;
  /** Granularity of the slider. Default `1`. */
  step?: number;
  /** Minimum distance between the two thumbs. Default `0`: the thumbs can meet and overlap. */
  minGap?: number;
  disabled?: boolean;
  /** Format the numbers shown under the slider (and read by screen readers). */
  formatValue?: (value: number) => string;
  /** Hide the value labels under the slider. Default `true`. */
  showValues?: boolean;
  /** Form field base name. Inputs are submitted as `${name}-min` / `${name}-max`. */
  name?: string;
  /** Accessible name for the whole slider (rendered as a labelled `group`). */
  ariaLabel?: string;
  minAriaLabel?: string;
  maxAriaLabel?: string;
  className?: string;
  style?: CSSProperties;
  /** `"auto"` follows the OS colour scheme. Default: light. */
  theme?: "light" | "dark" | "auto";
  /** Text direction. Thumbs, fill, tooltips and marks all follow it. */
  dir?: "ltr" | "rtl";
  /** Value bubble above each thumb: on hover/focus/drag, or always visible. Default `false`. */
  tooltip?: boolean | "hover" | "always";
  /**
   * Tick marks. `true` = 4 even intervals, a number = that many intervals,
   * or pass `[{ value, label }]` for custom marks.
   */
  marks?: boolean | number | Mark[];
  /** Extra class names for the inner parts, e.g. `{ thumb: "my-thumb" }`. */
  classNames?: Partial<Record<SliderSlot, string>>;
  /** Inline styles for the inner parts, e.g. `{ range: { borderRadius: 0 } }`. */
  styles?: Partial<Record<SliderSlot, CSSProperties>>;

  /** Sets the `--rs-range-color` CSS variable. Prefer styling with CSS variables. */
  rangeColor?: string;
  /** Sets the `--rs-track-color` CSS variable. Prefer styling with CSS variables. */
  trackColor?: string;
  /** Slider width (any CSS length). Sets `--rs-width`. Default `250px`. */
  width?: string;
  /** Style override for the value labels row. */
  valueStyle?: CSSProperties;
  /** Prefix for displayed values when `formatValue` is not provided. Default `"$"`. */
  currencyText?: string;
}

const resolveMarks = (marks: MultiRangeSliderProps["marks"], min: number, max: number): Mark[] => {
  if (!marks) return [];
  if (Array.isArray(marks)) return marks.filter((m) => m.value >= min && m.value <= max);
  const n = marks === true ? 4 : Math.max(1, Math.floor(marks));
  return Array.from({ length: n + 1 }, (_, i) => ({
    value: Number((min + ((max - min) * i) / n).toFixed(2)),
  }));
};

const KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

type Thumb = "min" | "max";
const THUMBS: Thumb[] = ["min", "max"];

/** How far (px) the pointer must move before a press on overlapping thumbs picks one. */
const PICK_DISTANCE = 3;

/**
 * Focus for a thumb grabbed with the pointer: keyboard control continues on it, but without a
 * focus ring, like a native click. (`focusVisible` is in the HTML spec and supported by all
 * current engines, but not yet in TypeScript's DOM types.)
 */
const POINTER_FOCUS = { preventScroll: true, focusVisible: false } as FocusOptions;

interface Drag {
  pointerId: number;
  /** The thumb being dragged; null while a press on overlapping thumbs waits for movement. */
  thumb: Thumb | null;
  /** Thumbs under the pointer when it went down (used while `thumb` is null). */
  stack: number[];
  startX: number;
  /** Pointer distance from the grabbed thumb's centre, so the thumb never jumps to the pointer. */
  offset: number;
  layout: Layout;
}

/** The control is exactly one thumb tall, so its height is the thumb size. */
const layoutOf = (control: HTMLElement): Layout => {
  const rect = control.getBoundingClientRect();
  return {
    left: rect.left,
    width: rect.width,
    size: rect.height,
    rtl: getComputedStyle(control).direction === "rtl",
  };
};

const MultiRangeSlider: FC<MultiRangeSliderProps> = ({
  min,
  max,
  value,
  defaultValue,
  onChange,
  onChangeEnd,
  step = 1,
  minGap,
  disabled = false,
  formatValue,
  showValues = true,
  name,
  ariaLabel,
  minAriaLabel = "Minimum value",
  maxAriaLabel = "Maximum value",
  className,
  style,
  theme,
  dir,
  tooltip = false,
  marks,
  classNames = {},
  styles = {},
  rangeColor,
  trackColor,
  width,
  valueStyle,
  currencyText = "$",
}) => {
  const isControlled = value !== undefined;
  const [inner, setInner] = useState<RangeValues>(
    defaultValue ?? { min, max }
  );
  const [active, setActive] = useState<Thumb>("max");
  const [hover, setHover] = useState<Thumb | null>(null);
  const [dragging, setDragging] = useState<Thumb | "pending" | null>(null);
  const drag = useRef<Drag | null>(null);
  const minInput = useRef<HTMLInputElement>(null);
  const maxInput = useRef<HTMLInputElement>(null);

  const gap = Math.max(minGap ?? 0, 0);

  // Always render a valid, ordered pair that sits inside [min, max],
  // even if props change after mount.
  const raw = isControlled ? value! : inner;
  const lo = clamp(raw.min, min, max);
  const hi = clamp(raw.max, lo, max);
  const current: RangeValues = { min: lo, max: hi };

  const span = max - min || 1;
  const pct = (n: number) => ((n - min) / span) * 100;

  const commit = (next: RangeValues) => {
    if (next.min === current.min && next.max === current.max) return;
    if (!isControlled) setInner(next);
    onChange?.(next);
  };

  /** Moves one thumb toward `to`, stopping at the other thumb (keeping `minGap`). */
  const setThumb = (thumb: Thumb, to: number) => {
    const [a, b] = moveThumb([lo, hi], THUMBS.indexOf(thumb), to, { min, max, step, gap });
    commit({ min: a, max: b });
  };

  const fmt = (n: number) => (formatValue ? formatValue(n) : `${currencyText}${n}`);

  // Purely visual: the thumb used last is drawn on top (at the max end, the min thumb,
  // which is the only one that can still move). Which thumb a press grabs is decided
  // by the pointer logic below, never by the stacking order.
  const minOnTop = active === "min" || current.min >= max - gap;

  const cx = (slot: SliderSlot, base: string) =>
    [base, classNames[slot]].filter(Boolean).join(" ");
  const markList = resolveMarks(marks, min, max);
  const tipMode = tooltip === true ? "hover" : tooltip || undefined;

  const rootStyle = {
    ...(width ? { "--rs-width": width } : null),
    ...(trackColor ? { "--rs-track-color": trackColor } : null),
    ...(rangeColor ? { "--rs-range-color": rangeColor } : null),
    "--rs-left": `${pct(current.min)}%`,
    "--rs-right": `${100 - pct(current.max)}%`,
    ...styles.root,
    ...style,
  } as CSSProperties;

  const finish = () => onChangeEnd?.(current);

  // ---- pointer input -------------------------------------------------------------------
  // The native inputs ignore the pointer (CSS); the control handles every press so it can
  // tell overlapping thumbs apart, jump to track clicks and keep the grab offset.

  const centersFor = (layout: Layout) => [lo, hi].map((v) => centerAt((v - min) / span, layout));
  const valueAt = (x: number, layout: Layout) =>
    snapToStep(min + fractionAt(x, layout) * (max - min), min, max, step);

  const grab = (thumb: Thumb) => {
    setActive(thumb);
    setDragging(thumb);
    // Script focus would otherwise match :focus-visible and leave the ring and tooltip on.
    (thumb === "min" ? minInput : maxInput).current?.focus(POINTER_FOCUS);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only the primary pointer drags (a second finger is ignored), and only the main mouse button.
    if (disabled || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    const layout = layoutOf(e.currentTarget);
    if (layout.width <= layout.size) return; // not laid out (hidden, or a test DOM)
    if (drag.current) finish(); // a previous drag whose release we never saw: close it first
    e.preventDefault(); // no text selection; focus moves to the grabbed thumb instead
    setHover(null); // the dragged thumb shows its own state; hover is recomputed on release
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // the pointer is already gone
    }
    const centers = centersFor(layout);
    const press = pressAt(e.clientX, centers, layout.size / 2, layout.rtl);
    const d: Drag = { pointerId: e.pointerId, thumb: null, stack: [], startX: e.clientX, offset: 0, layout };
    drag.current = d;
    if (press.kind === "stack") {
      d.stack = press.indices;
      setDragging("pending");
      return;
    }
    d.thumb = THUMBS[press.index];
    grab(d.thumb);
    if (press.kind === "thumb") d.offset = e.clientX - centers[press.index];
    else setThumb(d.thumb, valueAt(e.clientX, layout)); // bare track: jump there
  };

  const trackHover = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || disabled) return;
    const layout = layoutOf(e.currentTarget);
    const centers = centersFor(layout);
    const order = minOnTop ? [0, 1] : [1, 0]; // the thumb drawn on top wins
    const index = order.find((i) => Math.abs(e.clientX - centers[i]) <= layout.size / 2);
    const next = index === undefined ? null : THUMBS[index];
    if (next !== hover) setHover(next);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return trackHover(e);
    if (e.pointerId !== d.pointerId) return;
    if (!d.thumb) {
      const dx = e.clientX - d.startX;
      if (Math.abs(dx) < PICK_DISTANCE) return;
      const index = pickFromStack(d.stack, dx > 0 !== d.layout.rtl);
      d.thumb = THUMBS[index];
      d.offset = d.startX - centersFor(d.layout)[index];
      grab(d.thumb);
    }
    setThumb(d.thumb, valueAt(e.clientX - d.offset, d.layout));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    drag.current = null;
    setDragging(null);
    trackHover(e); // the pointer may have been released away from the thumb
    finish();
  };

  // ---- rendering ----------------------------------------------------------------------

  const shared = {
    type: "range" as const,
    min,
    max,
    step,
    disabled,
    onKeyUp: (e: React.KeyboardEvent) => KEYS.has(e.key) && finish(),
  };

  const thumbProps = (which: Thumb) => {
    const isMin = which === "min";
    const val = isMin ? current.min : current.max;
    const top = isMin ? minOnTop : !minOnTop;
    return {
      ...shared,
      ref: isMin ? minInput : maxInput,
      className: cx("thumb", `rs-thumb rs-thumb-${which}`),
      name: name ? `${name}-${which}` : undefined,
      "aria-label": isMin ? minAriaLabel : maxAriaLabel,
      "aria-valuetext": fmt(val),
      "data-hover": hover === which ? "" : undefined,
      "data-dragging": dragging === which ? "" : undefined,
      value: val,
      style: { ...styles.thumb, zIndex: top ? 4 : 3 },
      onFocus: () => setActive(which),
      // Keyboard, assistive tech and form autofill arrive here as native input events.
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setThumb(which, Number(e.target.value)),
    };
  };

  const tip = (which: Thumb) =>
    tipMode && (
      <div
        className={cx("tooltip", "rs-tooltip")}
        style={{
          ...styles.tooltip,
          ["--p" as string]: pct(which === "min" ? current.min : current.max),
        }}
        data-show={tipMode === "always" ? "always" : undefined}
        aria-hidden="true"
      >
        {fmt(which === "min" ? current.min : current.max)}
      </div>
    );

  return (
    <div
      className={[cx("root", "rs-root"), className].filter(Boolean).join(" ")}
      style={rootStyle}
      role="group"
      aria-label={ariaLabel}
      dir={dir}
      data-theme={theme}
      data-disabled={disabled || undefined}
    >
      <div
        className={cx("control", "rs-control")}
        style={styles.control}
        data-hover={hover ? "" : undefined}
        data-dragging={dragging ? "" : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onPointerLeave={() => hover && setHover(null)}
      >
        <div className="rs-rail">
          <div className={cx("track", "rs-track")} style={styles.track} />
          <div className={cx("range", "rs-range")} style={styles.range} />
        </div>
        <input {...thumbProps("min")} />
        {tip("min")}
        <input {...thumbProps("max")} />
        {tip("max")}
      </div>
      {markList.length > 0 && (
        <div className={cx("marks", "rs-marks")} style={styles.marks} aria-hidden="true">
          {markList.map((m) => (
            <span
              key={m.value}
              className={cx("mark", "rs-mark")}
              style={{ ...styles.mark, ["--p" as string]: pct(m.value) }}
              data-active={m.value >= current.min && m.value <= current.max ? "" : undefined}
            >
              {(m.label ?? (Array.isArray(marks) ? undefined : fmt(m.value))) !== undefined && (
                <span className="rs-mark-label">{m.label ?? fmt(m.value)}</span>
              )}
            </span>
          ))}
        </div>
      )}
      {showValues && (
        <div className={cx("values", "rs-values")} style={{ ...styles.values, ...valueStyle }}>
          <span className={cx("value", "rs-value")} style={styles.value}>{fmt(current.min)}</span>
          <span className="rs-value-sep" aria-hidden="true">–</span>
          <span className={cx("value", "rs-value")} style={styles.value}>{fmt(current.max)}</span>
        </div>
      )}
    </div>
  );
};

export default MultiRangeSlider;
