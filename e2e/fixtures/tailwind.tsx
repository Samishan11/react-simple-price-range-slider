/// <reference types="vite/client" />
import React from "react";
import { createRoot } from "react-dom/client";
import { RangeSlider, type RangeSliderProps, type SliderValue } from "../../src";

/**
 * Tailwind v4 scenarios: `/tailwind.html?case=<name>`.
 *   layered   the default look (layered stylesheet), overridden by utility classes
 *   plain     the same classes next to the plain, unlayered stylesheet: the defaults win
 *   unstyled  no built-in classes at all; Tailwind styles every part
 */
const cases: Record<string, RangeSliderProps<SliderValue>> = {
  layered: {
    defaultValue: [20, 80],
    width: "300px",
    classNames: { range: "bg-pink-500", thumb: "size-8 border-pink-500" },
  },
  plain: {
    defaultValue: [20, 80],
    width: "300px",
    classNames: { range: "bg-pink-500" },
  },
  unstyled: {
    unstyled: true,
    defaultValue: [20, 80],
    tooltip: true,
    classNames: {
      root: "w-[300px]",
      control: "h-5 cursor-pointer",
      track: "h-1.5 rounded-full bg-zinc-200",
      range: "rounded-full bg-zinc-900",
      thumb:
        "size-5 rounded-full border-2 border-zinc-900 bg-white shadow data-[focus-visible]:ring-4 data-[focus-visible]:ring-zinc-400/50",
      tooltip: "opacity-0 transition-opacity data-[visible]:opacity-100",
      tooltipLabel: "rounded bg-zinc-900 px-2 py-0.5 text-xs text-white",
      values: "mt-3 flex justify-between text-sm",
    },
  },
};

const name = new URLSearchParams(location.search).get("case") ?? "layered";

// The stylesheet decides the cascade, so each case loads the one it is about.
(name === "plain" ? import("./tailwind-plain.css") : import("./tailwind-layered.css")).then(() => {
  createRoot(document.getElementById("root")!).render(
    cases[name] ? (
      <>
        <RangeSlider {...cases[name]} />
        {/* Reference colour for the tests */}
        <span id="pink" className="bg-pink-500" hidden />
      </>
    ) : (
      <p>Unknown case “{name}”</p>
    )
  );
});
