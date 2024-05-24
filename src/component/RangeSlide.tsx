import React, {
  useCallback,
  useEffect,
  useState,
  useRef,
  FC,
  CSSProperties,
} from "react";

interface MultiRangeSliderProps {
  min: number;
  max: number;
  onChange: (values: { min: number; max: number }) => void;
  trackColor?: string;
  rangeColor?: string;
  valueStyle?: CSSProperties;
  currencyText?: string;
  width?: string;
}

const valueCss = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1,
  gap: "2px",
  paddingTop: "3px",
};

const MultiRangeSlider: FC<MultiRangeSliderProps> = ({
  min,
  max,
  trackColor = "#ddd",
  onChange,
  rangeColor = "#0b79d0",
  valueStyle = valueCss,
  width = "250px",
  currencyText = "$",
}) => {
  const [minVal, setMinVal] = useState<number>(min);
  const [maxVal, setMaxVal] = useState<number>(max);
  const minValRef = useRef<number>(min);
  const maxValRef = useRef<number>(max);
  const range = useRef<HTMLDivElement>(null);

  // Convert to percentage
  const getPercent = useCallback(
    (value: number) => Math.round(((value - min) / (max - min)) * 100),
    [min, max]
  );

  // Set width of the range to decrease from the left side
  useEffect(() => {
    const minPercent = getPercent(minVal);
    const maxPercent = getPercent(maxValRef.current);

    if (range.current) {
      range.current.style.left = `${minPercent}%`;
      range.current.style.width = `${maxPercent - minPercent}%`;
    }
  }, [minVal, getPercent]);

  // Set width of the range to decrease from the right side
  useEffect(() => {
    const minPercent = getPercent(minValRef.current);
    const maxPercent = getPercent(maxVal);

    if (range.current) {
      range.current.style.width = `${maxPercent - minPercent}%`;
    }
  }, [maxVal, getPercent]);

  // Get min and max values when their state changes
  useEffect(() => {
    if (minVal !== minValRef.current || maxVal !== maxValRef.current) {
      onChange({ min: minVal, max: maxVal });
      minValRef.current = minVal;
      maxValRef.current = maxVal;
    }
  }, [minVal, maxVal, onChange]);

  return (
    <div style={{ width }} className="multi-slide-input_container">
      <input
        type="range"
        min={min}
        max={max}
        value={minVal}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          const value = Math.min(Number(event.target.value), maxVal - 1);
          setMinVal(value);
        }}
        className="thumb thumb-left"
        style={{
          width,
          zIndex: minVal > max - 100 || minVal === maxVal ? 5 : undefined,
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={maxVal}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          const value = Math.max(Number(event.target.value), minVal + 1);
          setMaxVal(value);
        }}
        className="thumb thumb-right"
        style={{
          width,
          zIndex: minVal > max - 100 || minVal === maxVal ? 4 : undefined,
        }}
      />

      <div className="slider">
        <div className="track-slider" style={{ backgroundColor: trackColor }} />
        <div
          ref={range}
          style={{ backgroundColor: rangeColor }}
          className="range-slider"
        />
        <div className="values" style={valueStyle}>
          <div className="text-xs font-medium">
            {currencyText}
            {minVal}
          </div>
          <span>-</span>
          <div className="text-xs font-medium">
            {currencyText}
            {maxVal}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiRangeSlider;
