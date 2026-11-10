import React, { CSSProperties, FC, ReactNode, useState } from "react";

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
  /** Minimum distance between the two thumbs. Default: `step`. */
  minGap?: number;
  disabled?: boolean;
  /** Format the numbers shown under the slider (and read by screen readers). */
  formatValue?: (value: number) => string;
  /** Hide the value labels under the slider. Default `true`. */
  showValues?: boolean;
  /** Form field base name. Inputs are submitted as `${name}-min` / `${name}-max`. */
  name?: string;
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

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

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
  const [active, setActive] = useState<"min" | "max">("max");

  const gap = Math.max(minGap ?? step, 0);

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

  const fmt = (n: number) => (formatValue ? formatValue(n) : `${currencyText}${n}`);

  // The thumb that can still move toward the other one must be on top.
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

  const shared = {
    type: "range" as const,
    min,
    max,
    step,
    disabled,
    onPointerUp: finish,
    onKeyUp: (e: React.KeyboardEvent) => KEYS.has(e.key) && finish(),
  };

  const thumbProps = (which: "min" | "max") => {
    const isMin = which === "min";
    const val = isMin ? current.min : current.max;
    const top = isMin ? minOnTop : !minOnTop;
    return {
      ...shared,
      className: cx("thumb", `rs-thumb rs-thumb-${which}`),
      name: name ? `${name}-${which}` : undefined,
      "aria-label": isMin ? minAriaLabel : maxAriaLabel,
      "aria-valuetext": fmt(val),
      value: val,
      style: { ...styles.thumb, zIndex: top ? 4 : 3 },
      onFocus: () => setActive(which),
      onPointerDown: () => setActive(which),
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        const n = Number(e.target.value);
        commit(
          isMin
            ? { min: clamp(n, min, current.max - gap), max: current.max }
            : { min: current.min, max: clamp(n, current.min + gap, max) }
        );
      },
    };
  };

  const tip = (which: "min" | "max") =>
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
      dir={dir}
      data-theme={theme}
      data-disabled={disabled || undefined}
    >
      <div className={cx("control", "rs-control")} style={styles.control}>
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
