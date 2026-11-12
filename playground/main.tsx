import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import MultiRangeSlider, { RangeSlider, RangeValues } from "../src";
import "../src/styles.css";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const card: React.CSSProperties = { padding: "28px 24px 20px", borderRadius: 12, border: "1px solid #8884" };

function Section({ title, dark, children }: { title: string; dark?: boolean; children: React.ReactNode }) {
  return (
    <section style={{ ...card, ...(dark ? { background: "#0b1220", color: "#e2e8f0" } : null) }}>
      <h3 style={{ margin: "0 0 28px", fontSize: 14 }}>{title}</h3>
      {children}
    </section>
  );
}

function App() {
  const [v, setV] = useState<RangeValues>({ min: 200, max: 800 });
  return (
    <div style={{ padding: 32, fontFamily: "system-ui", display: "grid", gap: 20, maxWidth: 440 }}>
      <Section title="Controlled · formatValue · tooltip on hover">
        <MultiRangeSlider min={0} max={1000} step={10} value={v} onChange={setV} formatValue={(n) => usd.format(n)} tooltip width="100%" />
        <p>{JSON.stringify(v)} <button onClick={() => setV({ min: 0, max: 1000 })}>reset</button></p>
      </Section>
      <Section title="Tooltip always + marks (auto)">
        <MultiRangeSlider min={0} max={100} defaultValue={{ min: 25, max: 75 }} tooltip="always" marks width="100%" />
      </Section>
      <Section title="Custom marks">
        <MultiRangeSlider min={0} max={100} defaultValue={{ min: 20, max: 80 }} width="100%" showValues={false}
          marks={[{ value: 0, label: "Low" }, { value: 50, label: "Mid" }, { value: 100, label: "High" }]} />
      </Section>
      <Section title="Dark theme" dark>
        <MultiRangeSlider min={0} max={100} defaultValue={{ min: 30, max: 70 }} theme="dark" tooltip="always" marks={4} width="100%" />
      </Section>
      <Section title="RTL">
        <div dir="rtl">
          <MultiRangeSlider min={0} max={100} defaultValue={{ min: 20, max: 60 }} dir="rtl" tooltip="always" marks width="100%" />
        </div>
      </Section>
      <Section title="Legacy colours + CSS variables + slots">
        <MultiRangeSlider min={0} max={100} rangeColor="#16a34a" trackColor="#bbf7d0" currencyText="€" width="100%" />
        <div style={{ height: 16 }} />
        <MultiRangeSlider min={0} max={100} width="100%" style={{ "--rs-thumb-size": "28px", "--rs-track-height": "10px", "--rs-range-color": "#db2777" } as React.CSSProperties}
          classNames={{ value: "my-value" }} styles={{ value: { fontWeight: 800 } }} />
      </Section>
      <Section title="Disabled">
        <MultiRangeSlider min={0} max={100} defaultValue={{ min: 20, max: 60 }} disabled width="100%" />
      </Section>
      <Section title="v3 · single thumb (number in, number out)">
        <RangeSlider defaultValue={40} tooltip ariaLabel="Volume" formatValue={(n) => `${n}%`} width="100%" />
      </Section>
      <Section title="v3 · three thumbs">
        <RangeSlider defaultValue={[20, 50, 80]} tooltip marks width="100%" />
      </Section>
      <Section title="v3 · step 30 with an off-grid max (100 is reachable)">
        <RangeSlider max={100} step={30} defaultValue={[0, 100]} marks={[0, 30, 60, 90, 100].map((value) => ({ value }))} width="100%" />
      </Section>
      <Section title="v3 · inverted">
        <RangeSlider defaultValue={[20, 60]} inverted width="100%" />
      </Section>
      <Section title="v3 · vertical">
        <div style={{ display: "flex", gap: 48 }}>
          <RangeSlider orientation="vertical" defaultValue={[20, 80]} tooltip marks />
          <RangeSlider orientation="vertical" defaultValue={30} ariaLabel="Level" showValues={false} />
        </div>
      </Section>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
