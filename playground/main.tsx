import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import MultiRangeSlider, { RangeValues } from "../src";
import "../src/styles.css";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function App() {
  const [v, setV] = useState<RangeValues>({ min: 200, max: 800 });
  return (
    <div style={{ padding: 48, fontFamily: "system-ui", display: "grid", gap: 40, maxWidth: 420 }}>
      <h1>react-multi-input-rangeslider</h1>

      <section>
        <h3>Controlled + formatValue</h3>
        <MultiRangeSlider min={0} max={1000} step={10} value={v} onChange={setV} formatValue={(n) => usd.format(n)} width="100%" />
        <p>{JSON.stringify(v)} <button onClick={() => setV({ min: 0, max: 1000 })}>reset</button></p>
      </section>

      <section>
        <h3>Uncontrolled, minGap 100</h3>
        <MultiRangeSlider min={0} max={1000} minGap={100} defaultValue={{ min: 300, max: 600 }} />
      </section>

      <section>
        <h3>Legacy props (rangeColor / trackColor)</h3>
        <MultiRangeSlider min={0} max={100} rangeColor="#16a34a" trackColor="#bbf7d0" currencyText="€" />
      </section>

      <section>
        <h3>CSS variables</h3>
        <MultiRangeSlider min={0} max={100} style={{ "--rs-thumb-size": "28px", "--rs-track-height": "10px", "--rs-range-color": "#db2777" } as React.CSSProperties} />
      </section>

      <section>
        <h3>Disabled</h3>
        <MultiRangeSlider min={0} max={100} defaultValue={{ min: 20, max: 60 }} disabled />
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
