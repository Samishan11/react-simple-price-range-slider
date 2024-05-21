import React, { useCallback, useEffect, useState, useRef, FC } from "react";

interface MultiRangeSliderProps {
  min: number;
  max: number;
  onChange: (values: { min: number; max: number }) => void;
  trackColor?: string;
  rangeColor?: string;
  disabled?: boolean;
}

const MultiRangeSlider: FC<MultiRangeSliderProps> = ({
  min,
  max,
  trackColor = "#ddd",
  onChange,
  rangeColor = "#0b79d0",
  disabled = false,
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
    <div className="multislide_container">
      <input
        type="range"
        min={min}
        max={max}
        value={minVal}
        disabled={disabled}
        onChange={(event) => {
          const value = Math.min(Number(event.target.value), maxVal - 1);
          setMinVal(value);
        }}
        className="thumb thumb--left"
        style={{
          zIndex: minVal > max - 100 || minVal === maxVal ? 5 : undefined,
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={maxVal}
        disabled={disabled}
        onChange={(event) => {
          const value = Math.max(Number(event.target.value), minVal + 1);
          setMaxVal(value);
        }}
        className="thumb thumb--right"
        style={{
          zIndex: minVal > max - 100 || minVal === maxVal ? 4 : undefined,
        }}
      />

      <div className="slider">
        <div
          className="slider__track"
          style={{ backgroundColor: trackColor }}
        />
        <div
          ref={range}
          style={{ backgroundColor: rangeColor }}
          className="slider__range"
        />
        <div className="flex items-center justify-center gap-2 pt-3">
          <div className="text-xs font-medium">${minVal}</div>
          <span>-</span>
          <div className="text-xs font-medium">${maxVal}</div>
        </div>
      </div>
    </div>
  );
};

export default MultiRangeSlider;
