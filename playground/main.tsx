import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import MultiRangeSlider from "../src";
import "../src/styles.css";

function App() {
  const [v, setV] = useState({ min: 100, max: 800 });
  return (
    <div style={{ padding: 48, fontFamily: "system-ui" }}>
      <h1>react-multi-input-rangeslider</h1>
      <MultiRangeSlider min={0} max={1000} onChange={setV} />
      <p>{JSON.stringify(v)}</p>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
