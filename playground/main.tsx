import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import MultiRangeSlider, { RangeSlider, RangeValues } from "../src";
import "../src/styles.css";
import "./tailwind.css";

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

const VARIANTS = ["default", "minimal", "soft", "material"] as const;
const caption: React.CSSProperties = { fontSize: 12, opacity: 0.6, margin: "0 0 4px" };

function Gallery({ dark }: { dark?: boolean }) {
  return (
    <>
      {VARIANTS.map((variant) => (
        <div key={variant} style={{ marginBottom: 14 }}>
          <p style={caption}>{variant}</p>
          <RangeSlider variant={variant} theme={dark ? "dark" : undefined} defaultValue={[25, 70]} tooltip="always" width="100%" />
        </div>
      ))}
    </>
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
      <Section title="v3 · tooltips merge when close and stay inside at the ends">
        <RangeSlider max={1000} step={10} defaultValue={[480, 520]} tooltip="always" formatValue={(n) => usd.format(n)} width="100%" />
        <div style={{ height: 12 }} />
        <RangeSlider max={1000} step={10} defaultValue={[0, 1000]} tooltip="always" formatValue={(n) => usd.format(n)} width="100%" />
      </Section>
      <Section title="v3 · styles: variant=…">
        <Gallery />
      </Section>
      <Section title="v3 · styles in dark mode" dark>
        <Gallery dark />
      </Section>
      <Section title="v3 · sizes: sm · md · lg (any variant)">
        {(["sm", "md", "lg"] as const).map((size) => (
          <div key={size} style={{ marginBottom: 10 }}>
            <p style={caption}>{size}</p>
            <RangeSlider size={size} defaultValue={[30, 70]} width="100%" />
          </div>
        ))}
        <RangeSlider size="lg" variant="material" defaultValue={[30, 70]} width="100%" />
      </Section>
      <Section title="v3 · material: one handle · RTL · vertical">
        <RangeSlider variant="material" defaultValue={40} width="100%" ariaLabel="Brightness" />
        <div style={{ height: 8 }} />
        <div dir="rtl">
          <RangeSlider variant="material" defaultValue={[20, 60]} dir="rtl" width="100%" />
        </div>
        <div style={{ display: "flex", gap: 40, marginTop: 12 }}>
          <RangeSlider variant="material" orientation="vertical" defaultValue={[30, 70]} tooltip />
          <RangeSlider variant="soft" orientation="vertical" defaultValue={[30, 70]} />
          <RangeSlider variant="minimal" orientation="vertical" defaultValue={[30, 70]} />
        </div>
      </Section>
      <Section title="v3 · unstyled + Tailwind classes (no stylesheet)">
        <RangeSlider
          unstyled
          defaultValue={[25, 75]}
          tooltip
          formatValue={(n) => `${n}%`}
          classNames={{
            control: "h-5",
            track: "h-1.5 rounded-full bg-violet-100",
            range: "rounded-full bg-violet-600",
            thumb:
              "size-5 rounded-full border-2 border-violet-600 bg-white shadow-md transition-transform data-[dragging]:scale-125 data-[focus-visible]:ring-4 data-[focus-visible]:ring-violet-300",
            tooltip: "opacity-0 transition-opacity data-[visible]:opacity-100",
            tooltipLabel: "rounded-md bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white",
            values: "mt-3 flex justify-between text-sm font-medium text-violet-700",
            separator: "hidden",
          }}
        />
      </Section>
      <Section title="v3 · custom thumb content (renderThumb)">
        <RangeSlider
          defaultValue={[30, 70]}
          width="100%"
          style={{ "--rs-thumb-size": "28px" } as React.CSSProperties}
          renderThumb={({ dragging }) => (
            <span
              aria-hidden
              style={{ display: "grid", placeItems: "center", height: "100%", fontSize: 11, fontWeight: 700, color: dragging ? "#1d4ed8" : "#93c5fd" }}
            >
              |||
            </span>
          )}
        />
      </Section>
      <Section title="v3 · drag the range (grab the fill)">
        <RangeSlider defaultValue={[30, 60]} draggableRange tooltip width="100%" />
      </Section>
      <Section title="v3 · when thumbs meet: push · swap">
        <RangeSlider defaultValue={[20, 50, 80]} collision="push" tooltip width="100%" />
        <div style={{ height: 12 }} />
        <RangeSlider defaultValue={[20, 50]} collision="swap" tooltip width="100%" />
      </Section>
      <Section title="v3 · a locked thumb · read-only">
        <RangeSlider defaultValue={[20, 80]} disabledThumbs={[true, false]} width="100%" />
        <div style={{ height: 12 }} />
        <RangeSlider defaultValue={[35, 65]} readOnly width="100%" />
      </Section>
      <Section title="v3 · snap to marks · Intl currency (de-DE)">
        <RangeSlider
          max={10000}
          defaultValue={[2500, 7500]}
          marks={4}
          snapToMarks
          format={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }}
          locale="de-DE"
          width="100%"
        />
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
