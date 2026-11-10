import React, { CSSProperties, FC, useState } from "react";

export interface RangeValues {
  min: number;
  max: number;
}

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

  const rootStyle = {
    ...(width ? { "--rs-width": width } : null),
    ...(trackColor ? { "--rs-track-color": trackColor } : null),
    ...(rangeColor ? { "--rs-range-color": rangeColor } : null),
    "--rs-left": `${pct(current.min)}%`,
    "--rs-right": `${100 - pct(current.max)}%`,
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

  return (
    <div
      className={["rs-root", className].filter(Boolean).join(" ")}
      style={rootStyle}
      data-disabled={disabled || undefined}
    >
      <div className="rs-control">
        <div className="rs-rail">
          <div className="rs-track" />
          <div className="rs-range" />
        </div>
        <input
          {...shared}
          className="rs-thumb rs-thumb-min"
          name={name ? `${name}-min` : undefined}
          aria-label={minAriaLabel}
          aria-valuetext={fmt(current.min)}
          value={current.min}
          style={{ zIndex: minOnTop ? 4 : 3 }}
          onFocus={() => setActive("min")}
          onPointerDown={() => setActive("min")}
          onChange={(e) =>
            commit({
              min: clamp(Number(e.target.value), min, current.max - gap),
              max: current.max,
            })
          }
        />
        <input
          {...shared}
          className="rs-thumb rs-thumb-max"
          name={name ? `${name}-max` : undefined}
          aria-label={maxAriaLabel}
          aria-valuetext={fmt(current.max)}
          value={current.max}
          style={{ zIndex: minOnTop ? 3 : 4 }}
          onFocus={() => setActive("max")}
          onPointerDown={() => setActive("max")}
          onChange={(e) =>
            commit({
              min: current.min,
              max: clamp(Number(e.target.value), current.min + gap, max),
            })
          }
        />
      </div>
      {showValues && (
        <div className="rs-values" style={valueStyle}>
          <span className="rs-value">{fmt(current.min)}</span>
          <span className="rs-value-sep" aria-hidden="true">–</span>
          <span className="rs-value">{fmt(current.max)}</span>
        </div>
      )}
    </div>
  );
};

export default MultiRangeSlider;
