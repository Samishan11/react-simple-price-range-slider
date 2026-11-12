# Changelog

## Unreleased (3.0.0)

### Added
- **Any number of thumbs.** `value` / `defaultValue` take a number (one thumb), an array (one thumb per entry) or `{ min, max }`, and `onChange` / `onChangeEnd` report the same shape. New named export `RangeSlider`; `MultiRangeSlider` stays the default export.
- **Vertical** sliders (`orientation="vertical"`, length `--rs-height`) and **`inverted`** sliders.
- **Full WAI-ARIA keyboard support**: Shift + arrows and Page Up / Page Down take a large step (`largeStep`, ~10% by default), Home / End go to the thumb's limits, and arrows follow RTL and `inverted`.
- **`step="any"`**, **`getAriaLabel(index)`**, and a second callback argument `{ thumb, source }` (`"pointer"`, `"keyboard"` or `"input"`).
- **`useRangeSlider` hook** (experimental) for fully custom markup.
- `min` / `max` are optional (0 / 100).

### Changed
- **Thumbs are real elements.** `.rs-thumb` is now a `div`, and each one holds a visually hidden native `<input type="range">` (`.rs-input`) for focus, screen readers and forms. Custom CSS on `::-webkit-slider-thumb` / `::-moz-range-thumb` or `.rs-thumb:focus-visible` moves to `.rs-thumb` / `.rs-thumb[data-focus-visible]`.
- `.rs-rail` is gone (`.rs-range` sits inside `.rs-track`). Positions are inline styles, and the root no longer sets `--rs-left` / `--rs-right`.
- Tooltips are a zero-width `.rs-tooltip` anchor around a `.rs-tooltip-label` bubble, centred without transforms (crisper text). Always-on tooltips reserve space above the slider. A merged label is a `.rs-tooltip.rs-tooltip-merged`; the thumbs' own tooltips are then marked `data-merged` and hidden.
- The last-used thumb is marked `data-active` (drawn on top) instead of an inline `z-index`.
- A single-thumb slider is no longer wrapped in `role="group"`; `ariaLabel` names the slider itself.

### Fixed
- **An off-grid `max` is reachable**, and every thumb sits exactly where its value says: e.g. `max={100} step={30}` used to snap the thumb to 90 while the fill and label said 100.
- **Always-on tooltips no longer cover each other.** When thumbs come close, their tooltips merge into one label (`$480 – $520`, or a single value when the thumbs coincide) and split again as the thumbs move apart.
- **Tooltips stay inside the slider at the ends.** A label that would overflow is nudged inward while its arrow keeps pointing at the thumb; labels re-fit when the slider is resized. Works in RTL and on vertical sliders.
- **`onChangeEnd` fires for assistive technology**: a screen reader's increment (e.g. a VoiceOver swipe) never ended an adjustment before.
- Assistive-technology increments always move at least one step, even when the browser's own increment is smaller than `step`.
- The focus ring follows the input method: shown for keyboard focus, hidden after a pointer press, back as soon as a key is pressed.

## 2.1.0

### Added
- **Click the track** to move the nearest thumb there (and keep dragging).
- **Overlapping thumbs separate in the direction you drag:** left moves the lower thumb, right the upper one. Before, the thumb drawn on top blocked the other, so overlapping thumbs could get stuck.
- A grabbed thumb no longer jumps to the pointer, and dragging keeps tracking outside the slider.

### Changed
- **`minGap` now defaults to `0`:** the thumbs can meet and sit exactly on top of each other. It was `step`, which stopped them one step apart with a visible sliver. Pass `minGap={step}` for the old behaviour.
- The control (`.rs-control`) now handles all pointer input; the thumb inputs (`.rs-thumb`) no longer receive the pointer. Hover and drag styles use `.rs-thumb[data-hover]` / `.rs-thumb[data-dragging]` instead of `:hover` / `:active`, so update custom CSS that targeted e.g. `.rs-thumb:hover::-webkit-slider-thumb`.
- After a mouse drag the dragged thumb keeps keyboard focus (arrow keys continue), without a focus ring.

### Fixed
- **Next.js App Router / React Server Components:** the bundles now start with `"use client"`, so a Server Component can render the slider directly. Before, `next build` failed with `useState is not a function`.
- **Types for CommonJS consumers:** `require` now resolves `index.d.cts`. Before, CJS projects using `moduleResolution: node16` / `nodenext` were given the ESM type declarations.
- **Decimal steps:** values such as `0.30000000000000004` no longer reach `onChange`, the labels or `aria-valuetext` (e.g. `step={0.1}` with a `minGap`).
- **Firefox thumb size:** thumbs rendered 4px larger than `--rs-thumb-size` and sat up to 2px off the fill. They now match Chrome and Safari.
- **`prefers-reduced-motion`** was ignored in Chrome, Edge and Safari: one CSS rule listed both browsers' thumb selectors, so they dropped it. Thumb and tooltip animations now turn off.

### Internal
- Slider math lives in `src/engine.ts`: pure, unit-tested functions that the 3.0 engine will reuse.
- Playwright end-to-end tests in Chromium, Firefox and WebKit: pointer, touch, keyboard and hover interactions, a pixel-geometry contract, and tests that pin down the remaining known 2.x bugs (off-grid `max`, tooltip collisions) for 3.0.
- Package checks in CI: publint, are-the-types-wrong, a `"use client"` check, a size budget, and a smoke test that installs the packed tarball into a Next.js App Router app.

## 2.0.0

### Added
- Controlled (`value`) and uncontrolled (`defaultValue`) modes.
- `step`, `minGap`, `disabled`, `formatValue`, `showValues`, `name`, `onChangeEnd`, `className`, `style`.
- `theme` (`light` / `dark` / `auto`), `dir="rtl"`, `tooltip`, `marks`, `classNames` / `styles` slots.
- `ariaLabel`, `minAriaLabel`, `maxAriaLabel`; the root is a labelled `group`.
- CSS-variable theming (`--rs-*`), hover / active / focus-visible states, reduced-motion and forced-colors support.
- Named export `MultiRangeSlider`; exported types `MultiRangeSliderProps`, `RangeValues`, `Mark`, `SliderSlot`.
- ESM + CJS + `.d.ts` build; `react-multi-input-rangeslider/style.css` export.
- Vitest suite, GitHub Actions CI, Vite playground, docs site build.

### Changed
- New markup and `.rs-*` class names (old `.thumb` / `.slider` / `.track-slider` / `.range-slider` removed).
- Default thumb is 24px; refreshed default look and higher-contrast mark labels.
- `onChange` fires from the input event, only on real changes, never on mount.
- Peer dependencies widened to React / React DOM `>=16.8 <20`.

### Fixed
- `disabled` was documented but not implemented.
- Changing `min` / `max` after mount left stale internal state.
- Fill position was rounded to whole percents and drifted from the thumb centres.
- Thumb stacking relied on a hardcoded `max - 100` heuristic and could trap the thumbs at the max end.

### Removed
- Unused Babel config and runtime dependencies (including the `save-dev` placeholder package); Tailwind class names in the value labels.

## 1.0.11
Last 1.x release.
