import React, { useState } from "react";
import MultiRangeSlider from "./component/RangeSlide";

function App() {
  const [sliderValues, setSliderValues] = useState({ min: 0, max: 100 });

  const handleSliderChange = (values: typeof sliderValues) => {
    setSliderValues(values);
  };

  return (
    <div className="App">
      <h1>MultiRangeSlider Example</h1>
      <MultiRangeSlider
        min={0}
        max={100}
        onChange={handleSliderChange}
        trackColor="#ddd"
        rangeColor="#007bff"
        thumbColor="#007bff"
        thumbSize={20}
      />
      <div>Min Value: {sliderValues.min}</div>
      <div>Max Value: {sliderValues.max}</div>
    </div>
  );
}

export default App;
