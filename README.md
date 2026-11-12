# react-multi-input-rangeslider

[![npm version](https://img.shields.io/npm/v/react-multi-input-rangeslider.svg)](https://www.npmjs.com/package/react-multi-input-rangeslider)
[![CI](https://github.com/Samishan11/react-simple-price-range-slider/actions/workflows/ci.yml/badge.svg)](https://github.com/Samishan11/react-simple-price-range-slider/actions/workflows/ci.yml)
[![types](https://img.shields.io/npm/types/react-multi-input-rangeslider.svg)](https://www.npmjs.com/package/react-multi-input-rangeslider)
[![license](https://img.shields.io/npm/l/react-multi-input-rangeslider.svg)](LICENSE)

A small, accessible, themeable **dual-thumb range slider** for React — built for price filters and any other numeric range. Zero runtime dependencies, TypeScript types included, works with React 16.8 – 19, server rendering and React Server Components (Next.js App Router).

![Preview](docs/preview.png)

- Controlled **and** uncontrolled
- `step`, `minGap`, `disabled`, custom value formatting (`Intl.NumberFormat`, currencies, units…)
- Themeable with **CSS variables**; light / dark / auto themes
- Value tooltips, tick marks (auto or custom labels), RTL
- Precise pointer handling: click the track to jump, thumbs can meet exactly, and overlapping thumbs separate in the direction you drag
- Accessible: native range inputs, labelled thumbs, keyboard support, 24px targets, forced-colors and reduced-motion support
- Style any inner part via `classNames` / `styles`

## Install

```sh
npm install react-multi-input-rangeslider
```

## Usage

```tsx
import { useState } from "react";
import MultiRangeSlider from "react-multi-input-rangeslider";
import "react-multi-input-rangeslider/style.css";

export default function PriceFilter() {
  const [range, setRange] = useState({ min: 200, max: 800 });

  return (
    <MultiRangeSlider
      min={0}
      max={1000}
      step={10}
      value={range}
      onChange={setRange}
      formatValue={(n) => `$${n}`}
      tooltip
      ariaLabel="Price range"
    />
  );
}
```

Uncontrolled? Drop `value` and use `defaultValue` (or nothing, to start at the full range):

```tsx
<MultiRangeSlider min={0} max={100} defaultValue={{ min: 20, max: 80 }} onChangeEnd={(v) => fetchResults(v)} />
```

> The old `react-multi-input-rangeslider/style/style.css` import path still works.

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `min` | `number` | — | Lowest selectable value. |
| `max` | `number` | — | Highest selectable value. |
| `value` | `{ min, max }` | — | Controlled value. Pair with `onChange`. |
| `defaultValue` | `{ min, max }` | full range | Initial value when uncontrolled. |
| `onChange` | `(v: { min, max }) => void` | — | Called on every change while dragging or using the keyboard. |
| `onChangeEnd` | `(v: { min, max }) => void` | — | Called once when a drag or key press ends. Handy for fetching. |
| `step` | `number` | `1` | Slider granularity. |
| `minGap` | `number` | `0` | Minimum distance between the thumbs. `0` lets them meet. |
| `disabled` | `boolean` | `false` | Disable both thumbs. |
| `formatValue` | `(n: number) => string` | `` `${currencyText}${n}` `` | Formats the displayed values, tooltips, labels and `aria-valuetext`. |
| `showValues` | `boolean` | `true` | Show the `min – max` row under the slider. |
| `tooltip` | `boolean \| "hover" \| "always"` | `false` | Value bubble over each thumb. `true` = `"hover"` (also on focus/drag). |
| `marks` | `boolean \| number \| { value, label? }[]` | — | Tick marks. `true` = 4 intervals; a number = that many; or an array of custom marks. |
| `theme` | `"light" \| "dark" \| "auto"` | light | `"auto"` follows the OS colour scheme. |
| `dir` | `"ltr" \| "rtl"` | — | Text direction. |
| `name` | `string` | — | Form field name. Submitted as `${name}-min` / `${name}-max`. |
| `ariaLabel` | `string` | — | Accessible name of the whole slider (`role="group"`). |
| `minAriaLabel` / `maxAriaLabel` | `string` | `"Minimum value"` / `"Maximum value"` | Accessible names of the thumbs. |
| `className` / `style` | | | Applied to the root element. |
| `classNames` / `styles` | `Partial<Record<Slot, …>>` | — | Per-part overrides. Slots: `root control track range thumb tooltip marks mark values value`. |
| `width` | `string` | `250px` | Slider width (sets `--rs-width`). |
| `rangeColor` / `trackColor` | `string` | — | Shortcuts for `--rs-range-color` / `--rs-track-color`. |
| `currencyText` | `string` | `"$"` | Prefix used when `formatValue` isn't set. |
| `valueStyle` | `CSSProperties` | — | Inline style for the values row. |

## Theming

Everything visual is a CSS variable. Override them on the slider, a wrapper, or globally:

```css
.my-slider {
  --rs-range-color: #db2777;
  --rs-thumb-size: 28px;
  --rs-track-height: 10px;
}
```

| Variable | Default (light) |
| --- | --- |
| `--rs-width` | `250px` |
| `--rs-track-color` | `#e2e8f0` |
| `--rs-range-color` | `#2563eb` |
| `--rs-track-height` | `6px` |
| `--rs-thumb-size` | `24px` |
| `--rs-thumb-color` | `#fff` |
| `--rs-thumb-border-color` | `var(--rs-range-color)` |
| `--rs-thumb-border-width` | `2px` |
| `--rs-focus-ring` | translucent range-colour ring |
| `--rs-value-color` | `#334155` |
| `--rs-font-size` | `0.875rem` |
| `--rs-tooltip-bg` / `--rs-tooltip-color` | `#0f172a` / `#fff` |
| `--rs-mark-color` | `#64748b` |

Dark mode: `theme="dark"`, or `theme="auto"` to follow `prefers-color-scheme`.

## Migrating from 1.x

2.0 is mostly additive — **the 1.x props still work** (`min`, `max`, `onChange`, `rangeColor`, `trackColor`, `currencyText`, `valueStyle`, `width`). What changed:

- **Markup & class names.** The old `.thumb`, `.slider`, `.track-slider`, `.range-slider` classes are gone (replaced by `.rs-*`). If you overrode them in your own CSS, switch to the `--rs-*` variables or the `classNames` / `styles` props.
- **Tailwind classes removed** from the value labels (`text-xs font-medium` were never shipped with the package). Use `styles.value` / `classNames.value` instead.
- **`onChange` timing.** It now fires from the input event itself (not from an effect), only when the value actually changes, and never on mount.
- **Default thumb is 24px** (was 18px) and the default look is updated.
- **Peer dependencies** are now `react >=16.8 <20` and `react-dom >=16.8 <20`; the package ships ESM + CJS with types.
- **Bug fixes:** `disabled` now works (it was documented but missing); `min` / `max` prop changes are respected; the fill is exact (no whole-percent rounding); thumbs no longer get stuck when both sit at the max end.
- **Controlled mode is new:** pass `value` to drive the slider from state (e.g. a "reset filters" button).

## Development

```sh
npm install
npm run dev            # playground at http://localhost:5173
npm test               # unit tests (vitest + jsdom)
npm run test:e2e       # real-browser tests: Chromium, Firefox, WebKit (first run: npx playwright install)
npm run typecheck
npm run build          # dist/ (ESM, CJS, d.ts, style.css)
npm run check:package  # after build: publint, attw, "use client", size budget
npm run test:consumer  # after build: installs the packed tarball into a Next.js app and builds it
npm run docs           # static playground into ./site
```

## License

MIT
