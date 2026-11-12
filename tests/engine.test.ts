import {
  centerAt,
  decimalsOf,
  fractionAt,
  fromValues,
  keyCommand,
  largeStepCount,
  moveThumb,
  normalize,
  pickFromStack,
  pressAt,
  roundLike,
  settle,
  shapeOf,
  snapToStop,
  stepFrom,
  toValues,
  type Layout,
} from "../src/engine";

describe("decimals and rounding", () => {
  it("counts decimals, including exponent forms", () => {
    expect([1, 0.1, 0.25, 1e-7, 1.5e-7, 1e21, 2.5e3].map(decimalsOf)).toEqual([0, 1, 2, 7, 8, 0, 0]);
  });

  it("removes binary noise without losing real precision", () => {
    expect(roundLike(0.4 - 0.1, 0.1)).toBe(0.3);
    expect(roundLike(0.1 + 0.2, 0.1, 0.25)).toBe(0.3);
    expect(roundLike(0.35000000000000003, 0.1, 0.45)).toBe(0.35);
  });
});

describe("value shapes", () => {
  it("detects and converts the three shapes", () => {
    expect([shapeOf(5), shapeOf([1, 2]), shapeOf({ min: 1, max: 2 }), shapeOf(undefined)]).toEqual([
      "number",
      "array",
      "object",
      undefined,
    ]);
    expect(toValues(5)).toEqual([5]);
    expect(toValues([1, 2, 3])).toEqual([1, 2, 3]);
    expect(toValues({ min: 1, max: 2 })).toEqual([1, 2]);
    expect(fromValues([7], "number")).toBe(7);
    expect(fromValues([1, 2], "array")).toEqual([1, 2]);
    expect(fromValues([1, 2], "object")).toEqual({ min: 1, max: 2 });
  });

  it("normalizes: clamps, sorts, and replaces non-numbers", () => {
    expect(normalize([80, -5, 150, NaN], 0, 100)).toEqual([0, 0, 80, 100]);
  });
});

describe("snapToStop", () => {
  it("snaps to the grid that starts at min", () => {
    expect(snapToStop(14, 0, 100, 10)).toBe(10);
    expect(snapToStop(15, 0, 100, 10)).toBe(20);
    expect(snapToStop(7, 5, 100, 10)).toBe(5);
    expect(snapToStop(-37, -50, 50, 25)).toBe(-25);
  });

  it("returns clean decimals", () => {
    expect(snapToStop(0.3, 0, 1, 0.1)).toBe(0.3);
    expect(snapToStop(0.72, 0, 1, 0.1)).toBe(0.7);
    expect(snapToStop(1, 0, 0.3, 0.1)).toBe(0.3); // 0.3 / 0.1 = 2.9999999999999996
  });

  it("keeps max reachable when it is off the step grid", () => {
    expect(snapToStop(100, 0, 100, 30)).toBe(100);
    expect(snapToStop(96, 0, 100, 30)).toBe(100);
    expect(snapToStop(94, 0, 100, 30)).toBe(90);
    expect(snapToStop(-5, 0, 100, 30)).toBe(0);
  });

  it("allows every value with step 'any'", () => {
    expect(snapToStop(33.333, 0, 100, "any")).toBe(33.333);
    expect(snapToStop(150, 0, 100, "any")).toBe(100);
  });
});

describe("stepFrom", () => {
  it("steps along the grid and lands on max past the last grid value", () => {
    expect(stepFrom(60, 1, 0, 100, 30)).toBe(90);
    expect(stepFrom(90, 1, 0, 100, 30)).toBe(100);
    expect(stepFrom(100, -1, 0, 100, 30)).toBe(90);
    expect(stepFrom(100, 5, 0, 100, 30)).toBe(100);
    expect(stepFrom(0, -1, 0, 100, 30)).toBe(0);
  });

  it("moves an off-grid value onto the next stop in that direction", () => {
    expect(stepFrom(95, 1, 0, 100, 30)).toBe(100);
    expect(stepFrom(95, -1, 0, 100, 30)).toBe(90);
    expect(stepFrom(13, 1, 0, 100, 10)).toBe(20);
    expect(stepFrom(13, -1, 0, 100, 10)).toBe(10);
  });

  it("uses 1% of the range when step is 'any', without float noise", () => {
    expect(stepFrom(0.2, 1, 0, 1, "any")).toBe(0.21);
    expect(stepFrom(0.3, -1, 0, 1, 0.1)).toBe(0.2);
  });
});

describe("settle (values set by assistive technology)", () => {
  it("snaps to the nearest stop", () => {
    expect(settle(43, 0, 0, 100, 10)).toBe(40);
  });

  it("moves at least one stop in the direction of a small nudge", () => {
    expect(settle(51, 50, 0, 100, 50)).toBe(100);
    expect(settle(49, 50, 0, 100, 50)).toBe(0);
  });

  it("ignores nonsense", () => {
    expect(settle(NaN, 30, 0, 100, 10)).toBe(30);
  });
});

describe("largeStepCount", () => {
  it("defaults to about 10% of the range, in stops", () => {
    expect(largeStepCount(0, 100, 1)).toBe(10);
    expect(largeStepCount(0, 1000, 50)).toBe(2);
    expect(largeStepCount(0, 100, 30)).toBe(1);
  });

  it("follows largeStep when given", () => {
    expect(largeStepCount(0, 100, 1, 25)).toBe(25);
    expect(largeStepCount(0, 1000, 10, 100)).toBe(10);
  });
});

describe("moveThumb", () => {
  const b = { min: 0, max: 100, step: 1, gap: 0 };

  it("moves freely between the bounds", () => {
    expect(moveThumb([20, 80], 0, 50, b)).toEqual([50, 80]);
    expect(moveThumb([20, 80], 1, 150, b)).toEqual([20, 100]);
  });

  it("lets thumbs meet when the gap is 0, never cross", () => {
    expect(moveThumb([20, 80], 0, 95, b)).toEqual([80, 80]);
    expect(moveThumb([20, 80], 1, 5, b)).toEqual([20, 20]);
  });

  it("keeps the minimum gap, without float noise", () => {
    expect(moveThumb([20, 80], 0, 95, { ...b, gap: 10 })).toEqual([70, 80]);
    expect(moveThumb([0.2, 0.4], 0, 0.9, { min: 0, max: 1, step: 0.1, gap: 0.1 })).toEqual([0.3, 0.4]);
    expect(moveThumb([0.2, 0.6], 1, 0, { min: 0, max: 1, step: 0.1, gap: 0.1 })).toEqual([0.2, 0.3]);
  });

  it("works for one and for many thumbs", () => {
    expect(moveThumb([40], 0, 120, b)).toEqual([100]);
    expect(moveThumb([10, 40, 70], 1, 90, b)).toEqual([10, 70, 70]);
    expect(moveThumb([10, 40, 70], 1, 0, b)).toEqual([10, 10, 70]);
  });
});

describe("geometry", () => {
  const ltr: Layout = { start: 100, length: 300, size: 24, reversed: false };
  const rtl: Layout = { ...ltr, reversed: true };

  it("maps a pointer position to a track fraction, thumbs staying inside the control", () => {
    expect(fractionAt(112, ltr)).toBe(0);
    expect(fractionAt(388, ltr)).toBe(1);
    expect(fractionAt(250, ltr)).toBe(0.5);
    expect(fractionAt(0, ltr)).toBe(0);
    expect(fractionAt(999, ltr)).toBe(1);
  });

  it("mirrors when reversed (RTL, vertical, inverted)", () => {
    expect(fractionAt(112, rtl)).toBe(1);
    expect(fractionAt(388, rtl)).toBe(0);
  });

  it("centerAt is the inverse of fractionAt", () => {
    for (const l of [ltr, rtl]) for (const f of [0, 0.2, 0.5, 1]) expect(fractionAt(centerAt(f, l), l)).toBeCloseTo(f, 10);
  });

  it("does not divide by zero before layout", () => {
    expect(fractionAt(50, { start: 0, length: 0, size: 0, reversed: false })).toBe(0);
  });
});

describe("pressAt", () => {
  it("grabs the single thumb under the pointer", () => {
    expect(pressAt(105, [100, 200], 12, false)).toEqual({ kind: "thumb", index: 0 });
    expect(pressAt(190, [100, 200], 12, false)).toEqual({ kind: "thumb", index: 1 });
  });

  it("reports a stack when thumbs overlap under the pointer", () => {
    expect(pressAt(151, [150, 152.76], 12, false)).toEqual({ kind: "stack", indices: [0, 1] });
    expect(pressAt(150, [150, 150], 12, false)).toEqual({ kind: "stack", indices: [0, 1] });
  });

  it("on the bare track, picks the nearest thumb", () => {
    expect(pressAt(40, [100, 200], 12, false)).toEqual({ kind: "track", index: 0 });
    expect(pressAt(160, [100, 200], 12, false)).toEqual({ kind: "track", index: 1 });
  });

  it("on the bare track next to stacked thumbs, picks the one on the press side", () => {
    expect(pressAt(40, [150, 150], 12, false)).toEqual({ kind: "track", index: 0 });
    expect(pressAt(260, [150, 150], 12, false)).toEqual({ kind: "track", index: 1 });
    expect(pressAt(40, [150, 150], 12, true)).toEqual({ kind: "track", index: 1 });
    expect(pressAt(260, [150, 150], 12, true)).toEqual({ kind: "track", index: 0 });
  });
});

describe("pickFromStack", () => {
  it("takes the thumb that can move in the drag direction", () => {
    expect(pickFromStack([0, 1], false)).toBe(0);
    expect(pickFromStack([0, 1], true)).toBe(1);
    expect(pickFromStack([1, 2, 3], true)).toBe(3);
  });
});

describe("keyCommand", () => {
  const plain = { shift: false, large: 10, flipLeftRight: false, flipUpDown: false };

  it("follows the WAI-ARIA slider keys", () => {
    expect(keyCommand("ArrowRight", plain)).toEqual({ steps: 1 });
    expect(keyCommand("ArrowUp", plain)).toEqual({ steps: 1 });
    expect(keyCommand("ArrowLeft", plain)).toEqual({ steps: -1 });
    expect(keyCommand("ArrowDown", plain)).toEqual({ steps: -1 });
    expect(keyCommand("PageUp", plain)).toEqual({ steps: 10 });
    expect(keyCommand("PageDown", plain)).toEqual({ steps: -10 });
    expect(keyCommand("Home", plain)).toEqual({ to: "min" });
    expect(keyCommand("End", plain)).toEqual({ to: "max" });
    expect(keyCommand("Tab", plain)).toBeNull();
  });

  it("Shift makes arrows take large steps", () => {
    expect(keyCommand("ArrowRight", { ...plain, shift: true })).toEqual({ steps: 10 });
  });

  it("flips Left/Right for RTL or inverted sliders, Up/Down for inverted vertical ones", () => {
    expect(keyCommand("ArrowRight", { ...plain, flipLeftRight: true })).toEqual({ steps: -1 });
    expect(keyCommand("ArrowLeft", { ...plain, flipLeftRight: true })).toEqual({ steps: 1 });
    expect(keyCommand("ArrowUp", { ...plain, flipLeftRight: true })).toEqual({ steps: 1 });
    expect(keyCommand("ArrowUp", { ...plain, flipUpDown: true })).toEqual({ steps: -1 });
  });
});
