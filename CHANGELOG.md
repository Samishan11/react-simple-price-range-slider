# Changelog

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
