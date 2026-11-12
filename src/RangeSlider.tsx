import React, { type CSSProperties, type ReactElement, type ReactNode } from "react";
import { fromValues, shapeOf, toValues, type Shape } from "./engine";
import { useRangeSlider } from "./useRangeSlider";
import { useTooltipLayout } from "./useTooltipLayout";
import type {
  ChangeMeta,
  Mark,
  Orientation,
  RangeValues,
  SliderSlot,
  SliderValue,
  Step,
  ThumbState,
  ValueOf,
} from "./types";

export interface RangeSliderProps<V extends SliderValue = number[]> {
  /** Lowest value. Default `0`. */
  min?: number;
  /** Highest value. Default `100`. */
  max?: number;
  /**
   * Controlled value. Its shape decides the thumbs and what `onChange` reports: a number
   * (one thumb), an array (one thumb per entry) or `{ min, max }` (two thumbs).
   */
  value?: V;
  /** Initial value when uncontrolled, in any of the shapes `value` takes. */
  defaultValue?: V;
  /** Fires on every change while dragging, on each key press, and when assistive technology moves a thumb. */
  onChange?: (value: ValueOf<V>, meta: ChangeMeta) => void;
  /** Fires once when a drag, key press or assistive-technology adjustment is committed. Handy for fetching. */
  onChangeEnd?: (value: ValueOf<V>, meta: ChangeMeta) => void;
  /** Granularity. `"any"` allows every value. Default `1`. */
  step?: Step;
  /** Minimum distance between neighbouring thumbs. Default `0`: the thumbs can meet. */
  minGap?: number;
  /** Size of a PageUp/PageDown or Shift+Arrow step. Default: about 10% of the range. */
  largeStep?: number;
  disabled?: boolean;
  /** Default `"horizontal"`. Vertical sliders have the minimum at the bottom. */
  orientation?: Orientation;
  /** Puts the maximum at the start: left (right in RTL), or the top when vertical. */
  inverted?: boolean;
  /** Formats the values shown in labels, tooltips and marks, and read by screen readers. */
  formatValue?: (value: number) => string;
  /** Show the values row under the slider. Default `true`. */
  showValues?: boolean;
  /** Form field name: one thumb submits `name`, two submit `${name}-min` / `${name}-max`, more submit `name` once per thumb. */
  name?: string;
  /** Accessible name of the slider (a labelled `group` when there are several thumbs). */
  ariaLabel?: string;
  /** Accessible name of the lower thumb of a two-thumb slider. Default `"Minimum value"`. */
  minAriaLabel?: string;
  /** Accessible name of the upper thumb of a two-thumb slider. Default `"Maximum value"`. */
  maxAriaLabel?: string;
  /** Accessible name of each thumb, by index. Takes precedence over the other labels. */
  getAriaLabel?: (index: number) => string;
  className?: string;
  style?: CSSProperties;
  /** `"auto"` follows the OS colour scheme. Default: light. */
  theme?: "light" | "dark" | "auto";
  /** Text direction. Thumbs, fill, tooltips, marks and arrow keys all follow it. */
  dir?: "ltr" | "rtl";
  /** Value bubble on each thumb: on hover/focus/drag, or always visible. Default `false`. */
  tooltip?: boolean | "hover" | "always";
  /** Tick marks: `true` = 4 even intervals, a number = that many intervals, or `[{ value, label }]`. */
  marks?: boolean | number | Mark[];
  /**
   * Leave out the built-in `rs-*` class names, so the stylesheet doesn't apply and you style every
   * part yourself (e.g. with Tailwind through `classNames`). Layout still works: positions are inline.
   */
  unstyled?: boolean;
  /** Extra class names for the inner parts, e.g. `{ thumb: "my-thumb" }`. */
  classNames?: Partial<Record<SliderSlot, string>>;
  /** Inline styles for the inner parts, e.g. `{ range: { borderRadius: 0 } }`. */
  styles?: Partial<Record<SliderSlot, CSSProperties>>;
  /** Content inside each thumb: an icon, grip lines, the value… */
  renderThumb?: (thumb: ThumbState) => ReactNode;
  /** Content of each tooltip label instead of the formatted value. */
  renderTooltip?: (thumb: ThumbState) => ReactNode;
  /** Sets the `--rs-range-color` CSS variable. */
  rangeColor?: string;
  /** Sets the `--rs-track-color` CSS variable. */
  trackColor?: string;
  /** Slider width (any CSS length). Sets `--rs-width`. Default `250px`. */
  width?: string;
  /** Inline style for the values row. */
  valueStyle?: CSSProperties;
  /** Prefix for displayed values when `formatValue` is not set. Default `"$"`. */
  currencyText?: string;
}

/** Props of the 2.x-compatible `MultiRangeSlider`, whose values default to `{ min, max }`. */
export type MultiRangeSliderProps = RangeSliderProps<RangeValues>;

const resolveMarks = (marks: RangeSliderProps["marks"], min: number, max: number): Mark[] => {
  if (!marks) return [];
  if (Array.isArray(marks)) return marks.filter((m) => m.value >= min && m.value <= max);
  const n = marks === true ? 4 : Math.max(1, Math.floor(marks));
  return Array.from({ length: n + 1 }, (_, i) => ({
    value: Number((min + ((max - min) * i) / n).toFixed(2)),
  }));
};

const TOOLTIP_OFFSET = "var(--rs-tooltip-offset, 8px)";
const NO_WRAP: CSSProperties = { whiteSpace: "nowrap" };

// Structure the layout depends on, inline so it holds without the stylesheet (and in `unstyled`
// mode). Tooltips and marks are zero-size anchors at their point; their labels centre on it.
const layout = (vertical: boolean) => ({
  tooltip: (vertical
    ? { position: "absolute", insetInlineStart: `calc(100% + ${TOOLTIP_OFFSET})`, height: 0, display: "flex", alignItems: "center", pointerEvents: "none" }
    : { position: "absolute", bottom: `calc(100% + ${TOOLTIP_OFFSET})`, width: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }) as CSSProperties,
  mark: (vertical
    ? { position: "absolute", left: 0, height: 0, display: "flex", alignItems: "center" }
    : { position: "absolute", top: 0, width: 0, display: "flex", justifyContent: "center" }) as CSSProperties,
});

type ViewProps = RangeSliderProps<SliderValue> & { defaultShape: Shape };

function SliderView({
  min = 0,
  max = 100,
  value,
  defaultValue,
  onChange,
  onChangeEnd,
  step = 1,
  minGap,
  largeStep,
  disabled = false,
  orientation = "horizontal",
  inverted = false,
  formatValue,
  showValues = true,
  name,
  ariaLabel,
  minAriaLabel = "Minimum value",
  maxAriaLabel = "Maximum value",
  getAriaLabel,
  className,
  style,
  theme,
  dir,
  tooltip = false,
  marks,
  unstyled = false,
  classNames = {},
  styles = {},
  renderThumb,
  renderTooltip,
  rangeColor,
  trackColor,
  width,
  valueStyle,
  currencyText = "$",
  defaultShape,
}: ViewProps) {
  const shape = shapeOf(value ?? defaultValue) ?? defaultShape;
  const report = (cb?: (value: ValueOf<SliderValue>, meta: ChangeMeta) => void) =>
    cb && ((values: number[], meta: ChangeMeta) => cb(fromValues(values, shape), meta));

  const s = useRangeSlider({
    min,
    max,
    step,
    minGap,
    largeStep,
    disabled,
    orientation,
    inverted,
    values: value === undefined ? undefined : toValues(value),
    defaultValues: defaultValue === undefined ? undefined : toValues(defaultValue),
    onChange: report(onChange),
    onChangeEnd: report(onChangeEnd),
  });

  const { values } = s;
  const count = values.length;
  const vertical = orientation === "vertical";
  const parts = layout(vertical);
  const span = max - min || 1;
  const fmt = (n: number) => (formatValue ? formatValue(n) : `${currencyText}${n}`);
  /** Built-in class (left out when unstyled) plus the user's class for that part. */
  const cx = (slot: SliderSlot, base: string) => [unstyled ? "" : base, classNames[slot]].filter(Boolean).join(" ") || undefined;
  const tipMode = tooltip === true ? "hover" : tooltip || undefined;
  const markList = resolveMarks(marks, min, max);
  const inRange = (v: number) => (count > 1 ? v >= values[0] && v <= values[count - 1] : v <= values[0]);

  const stateOf = (i: number): ThumbState => ({
    index: i,
    value: values[i],
    formatted: fmt(values[i]),
    active: i === s.active,
    hover: i === s.hover,
    dragging: i === s.dragging,
    focusVisible: i === s.focusVisible,
    disabled,
  });
  const tipContent = (i: number) => (renderTooltip ? renderTooltip(stateOf(i)) : fmt(values[i]));
  const tipVisible = (i: number) =>
    tipMode === "always" || i === s.hover || i === s.dragging || i === s.focusVisible;

  const tips = useTooltipLayout({
    enabled: !!tipMode,
    merge: tipMode === "always",
    vertical,
    count,
    control: s.controlRef,
  });
  const mergedInto = new Set(tips.layout.merged.flat());
  /** One label for a merged group: "$480 – $520", or a single value when the thumbs coincide. */
  const mergedContent = (group: number[]) => {
    const distinct = group.filter((i, k) => k === 0 || values[i] !== values[group[k - 1]]);
    return distinct.map((i, k) => (
      <React.Fragment key={i}>
        {k > 0 && " – "}
        {tipContent(i)}
      </React.Fragment>
    ));
  };

  const labelFor = (i: number) =>
    getAriaLabel?.(i) ??
    (count === 1 ? ariaLabel ?? "Value" : count === 2 ? (i === 0 ? minAriaLabel : maxAriaLabel) : `Value ${i + 1} of ${count}`);
  const nameFor = (i: number) => (!name ? undefined : count === 2 ? `${name}-${i === 0 ? "min" : "max"}` : name);
  const thumbClass = (i: number) =>
    cx("thumb", count === 2 ? `rs-thumb rs-thumb-${i === 0 ? "min" : "max"}` : "rs-thumb");

  const rootStyle = {
    ...(width ? { "--rs-width": width } : null),
    ...(trackColor ? { "--rs-track-color": trackColor } : null),
    ...(rangeColor ? { "--rs-range-color": rangeColor } : null),
    ...styles.root,
    ...style,
  } as CSSProperties;

  const controlProps = s.getControlProps();
  const trackProps = s.getTrackProps();
  const rangeProps = s.getRangeProps();

  return (
    <div
      className={[cx("root", "rs-root"), className].filter(Boolean).join(" ") || undefined}
      style={rootStyle}
      role={count > 1 ? "group" : undefined}
      aria-label={count > 1 ? ariaLabel : undefined}
      dir={dir}
      data-theme={theme}
      data-orientation={orientation}
      data-disabled={disabled || undefined}
      data-tooltip={tipMode}
    >
      <div {...controlProps} className={cx("control", "rs-control")} style={{ ...controlProps.style, ...styles.control }}>
        <div className={cx("track", "rs-track")} style={{ ...trackProps.style, ...styles.track }}>
          <div className={cx("range", "rs-range")} style={{ ...rangeProps.style, ...styles.range }} />
        </div>
        {values.map((v, i) => {
          const thumbProps = s.getThumbProps(i);
          return (
            <React.Fragment key={i}>
              <div {...thumbProps} className={thumbClass(i)} style={{ ...thumbProps.style, ...styles.thumb }}>
                <input
                  {...s.getInputProps(i)}
                  className={unstyled ? undefined : "rs-input"}
                  name={nameFor(i)}
                  aria-label={labelFor(i)}
                  aria-valuetext={fmt(v)}
                />
                {renderThumb?.(stateOf(i))}
              </div>
              {tipMode && (
                <div
                  ref={(el) => {
                    tips.anchors.current[i] = el;
                  }}
                  className={cx("tooltip", "rs-tooltip")}
                  style={{
                    ...parts.tooltip,
                    ...s.alongStyle(s.fractions[i]),
                    // Merged into a shared label: keep it measurable, but unseen.
                    ...(mergedInto.has(i) ? { visibility: "hidden" } : null),
                    ...styles.tooltip,
                  }}
                  data-show={tipMode === "always" ? "always" : undefined}
                  data-visible={tipVisible(i) && !mergedInto.has(i) ? "" : undefined}
                  data-merged={mergedInto.has(i) ? "" : undefined}
                  aria-hidden="true"
                >
                  <span
                    ref={(el) => {
                      tips.labels.current[i] = el;
                    }}
                    className={cx("tooltipLabel", "rs-tooltip-label")}
                    style={{ position: "relative", ...NO_WRAP, ...tips.shiftStyle(tips.layout.shifts[i]), ...styles.tooltipLabel }}
                  >
                    {tipContent(i)}
                  </span>
                </div>
              )}
            </React.Fragment>
          );
        })}
        {tips.layout.merged.map((group, gi) => (
          <div
            key={group.join("-")}
            className={cx("tooltip", "rs-tooltip rs-tooltip-merged")}
            style={{
              ...parts.tooltip,
              ...s.alongStyle((s.fractions[group[0]] + s.fractions[group[group.length - 1]]) / 2),
              ...styles.tooltip,
            }}
            data-show="always"
            data-visible=""
            aria-hidden="true"
          >
            <span
              ref={(el) => {
                tips.mergedLabels.current[gi] = el;
              }}
              className={cx("tooltipLabel", "rs-tooltip-label")}
              style={{ position: "relative", ...NO_WRAP, ...tips.shiftStyle(tips.layout.mergedShifts[gi]), ...styles.tooltipLabel }}
            >
              {mergedContent(group)}
            </span>
          </div>
        ))}
      </div>
      {markList.length > 0 && (
        <div className={cx("marks", "rs-marks")} style={{ position: "relative", ...styles.marks }} aria-hidden="true">
          {markList.map((m) => (
            <span
              key={m.value}
              className={cx("mark", "rs-mark")}
              style={{ ...parts.mark, ...s.alongStyle((m.value - min) / span), ...styles.mark }}
              data-active={inRange(m.value) ? "" : undefined}
            >
              {(m.label ?? (Array.isArray(marks) ? undefined : fmt(m.value))) !== undefined && (
                <span className={cx("markLabel", "rs-mark-label")} style={{ ...NO_WRAP, ...styles.markLabel }}>
                  {m.label ?? fmt(m.value)}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
      {showValues && (
        <div className={cx("values", "rs-values")} style={{ ...styles.values, ...valueStyle }}>
          {values.map((v, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <span className={cx("separator", "rs-value-sep")} style={styles.separator} aria-hidden="true">
                  {count === 2 ? "–" : "·"}
                </span>
              )}
              <span className={cx("value", "rs-value")} style={styles.value}>
                {fmt(v)}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A slider with one, two or more thumbs. `onChange` reports the shape you pass as
 * `value` / `defaultValue`: a number, an array, or `{ min, max }` (an array when neither is set).
 */
export function RangeSlider<V extends SliderValue = number[]>(props: RangeSliderProps<V>): ReactElement {
  return <SliderView {...(props as unknown as RangeSliderProps<SliderValue>)} defaultShape="array" />;
}

/** The 2.x component name: the same slider, with values defaulting to `{ min, max }`. */
export function MultiRangeSlider<V extends SliderValue = RangeValues>(props: RangeSliderProps<V>): ReactElement {
  return <SliderView {...(props as unknown as RangeSliderProps<SliderValue>)} defaultShape="object" />;
}

export default MultiRangeSlider;
