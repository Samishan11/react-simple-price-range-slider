import {
  applyMove,
  centerAt,
  containShift,
  decimalsOf,
  groupOverlapping,
  fractionAt,
  fromValues,
  keyCommand,
  largeStepCount,
  moveThumb,
  normalize,
  pickFromStack,
  pressAt,
  pushThumb,
  roundLike,
  settle,
  shapeOf,
  shiftAll,
  snapToStop,
  stepFrom,
  swapThumb,
  toValues,
  type Layout,
} from "../src/engine";

describe("listed stops (snapToMarks)", () => {
  const marks = [0, 10, 25, 50, 100];

  it("snaps to the nearest listed value only", () => {
    expect(snapToStop(18, 0, 100, marks)).toBe(25);
    expect(snapToStop(17, 0, 100, marks)).toBe(10);
    expect(snapToStop(80, 0, 100, marks)).toBe(100);
  });

  it("steps along the list, landing on the neighbour from between stops", () => {
    expect(stepFrom(25, 1, 0, 100, marks)).toBe(50);
    expect(stepFrom(25, -1, 0, 100, marks)).toBe(10);
    expect(stepFrom(30, 1, 0, 100, marks)).toBe(50);
    expect(stepFrom(30, -1, 0, 100, marks)).toBe(25);
    expect(stepFrom(50, 9, 0, 100, marks)).toBe(100);
    expect(stepFrom(10, -9, 0, 100, marks)).toBe(0);
  });

  it("assistive-technology nudges move one listed stop", () => {
    expect(settle(26, 25, 0, 100, marks)).toBe(50);
    expect(settle(24, 25, 0, 100, marks)).toBe(10);
  });

  it("ignores listed values outside the range, and duplicates", () => {
    expect(stepFrom(10, 1, 0, 50, [10, 10, 40, 200])).toBe(40);
    expect(stepFrom(40, 1, 0, 50, [10, 10, 40, 200])).toBe(40);
  });

  it("a large step is ~10% of the list", () => {
    expect(largeStepCount(0, 100, marks)).toBe(1);
    expect(largeStepCount(0, 100, Array.from({ length: 41 }, (_, i) => i * 2.5))).toBe(4);
  });
});

describe("collisions", () => {
  const b = { min: 0, max: 100, step: 1, gap: 0 };

  it("push moves the neighbours it runs into, keeping the gap", () => {
    expect(pushThumb([20, 50, 80], 0, 60, b)).toEqual([60, 60, 80]);
    expect(pushThumb([20, 50, 80], 0, 90, { ...b, gap: 5 })).toEqual([90, 95, 100]);
    expect(pushThumb([20, 50, 80], 2, 10, b)).toEqual([10, 10, 10]);
  });

  it("push stops when the chain reaches an end", () => {
    expect(pushThumb([20, 50, 80], 0, 100, { ...b, gap: 10 })).toEqual([80, 90, 100]);
  });

  it("push can't move a locked thumb", () => {
    expect(pushThumb([20, 50, 80], 0, 90, b, [false, false, true])).toEqual([80, 80, 80]);
    expect(pushThumb([20, 50, 80], 0, 90, b, [false, true, false])).toEqual([50, 50, 80]);
  });

  it("swap passes the neighbours and reports the thumb's new index", () => {
    expect(swapThumb([20, 50, 80], 0, 60, b)).toEqual({ values: [50, 60, 80], index: 1 });
    expect(swapThumb([20, 50, 80], 0, 95, b)).toEqual({ values: [50, 80, 95], index: 2 });
    expect(swapThumb([20, 50, 80], 2, 10, b)).toEqual({ values: [10, 20, 50], index: 0 });
  });

  it("swap stays on its own side of a tie", () => {
    expect(swapThumb([20, 50], 0, 50, b)).toEqual({ values: [50, 50], index: 1 });
    expect(swapThumb([20, 50], 1, 20, b)).toEqual({ values: [20, 20], index: 0 });
  });

  it("swap can't pass a locked thumb", () => {
    expect(swapThumb([20, 50, 80], 0, 90, b, [false, true, false])).toEqual({ values: [50, 50, 80], index: 0 });
  });

  it("applyMove dispatches on the collision rule (block by default)", () => {
    expect(applyMove([20, 50], 0, 70, b)).toEqual({ values: [50, 50], index: 0 });
    expect(applyMove([20, 50], 0, 70, b, "push")).toEqual({ values: [70, 70], index: 0 });
    expect(applyMove([20, 50], 0, 70, b, "swap")).toEqual({ values: [50, 70], index: 1 });
  });
});

describe("shiftAll (dragging the range)", () => {
  const b = { min: 0, max: 100, step: 1, gap: 0 };

  it("moves every thumb, keeping the spacing", () => {
    expect(shiftAll([20, 50, 70], 10, b)).toEqual([30, 60, 80]);
  });

  it("stops at either end without squeezing the range", () => {
    expect(shiftAll([20, 50, 70], 50, b)).toEqual([50, 80, 100]);
    expect(shiftAll([20, 50, 70], -40, b)).toEqual([0, 30, 50]);
  });

  it("keeps decimals clean", () => {
    expect(shiftAll([0.1, 0.2], 0.1, { min: 0, max: 1, step: 0.1, gap: 0 })).toEqual([0.2, 0.3]);
  });
});

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
    expect(pressAt(105, [100, 200], 12, { reversed: false })).toEqual({ kind: "thumb", index: 0 });
    expect(pressAt(190, [100, 200], 12, { reversed: false })).toEqual({ kind: "thumb", index: 1 });
  });

  it("reports a stack when thumbs overlap under the pointer", () => {
    expect(pressAt(151, [150, 152.76], 12, { reversed: false })).toEqual({ kind: "stack", indices: [0, 1] });
    expect(pressAt(150, [150, 150], 12, { reversed: false })).toEqual({ kind: "stack", indices: [0, 1] });
  });

  it("on the bare track, picks the nearest thumb", () => {
    expect(pressAt(40, [100, 200], 12, { reversed: false })).toEqual({ kind: "track", index: 0 });
    expect(pressAt(160, [100, 200], 12, { reversed: false })).toEqual({ kind: "track", index: 1 });
  });

  it("on the bare track next to stacked thumbs, picks the one on the press side", () => {
    expect(pressAt(40, [150, 150], 12, { reversed: false })).toEqual({ kind: "track", index: 0 });
    expect(pressAt(260, [150, 150], 12, { reversed: false })).toEqual({ kind: "track", index: 1 });
    expect(pressAt(40, [150, 150], 12, { reversed: true })).toEqual({ kind: "track", index: 1 });
    expect(pressAt(260, [150, 150], 12, { reversed: true })).toEqual({ kind: "track", index: 0 });
  });

  it("with a draggable range, a press between the outer thumbs grabs the range", () => {
    const o = { reversed: false, range: true };
    expect(pressAt(150, [100, 200], 12, o)).toEqual({ kind: "range" });
    expect(pressAt(105, [100, 200], 12, o)).toEqual({ kind: "thumb", index: 0 });
    expect(pressAt(40, [100, 200], 12, o)).toEqual({ kind: "track", index: 0 });
    expect(pressAt(150, [200, 100], 12, { ...o, reversed: true })).toEqual({ kind: "range" });
  });

  it("locked thumbs: pressing one does nothing; free thumbs get the presses around them", () => {
    const o = { reversed: false, locked: [true, false] };
    expect(pressAt(102, [100, 200], 12, o)).toEqual({ kind: "none" });
    expect(pressAt(151, [150, 152], 12, o)).toEqual({ kind: "thumb", index: 1 });
    expect(pressAt(40, [100, 200], 12, o)).toEqual({ kind: "track", index: 1 });
    expect(pressAt(40, [100, 200], 12, { reversed: false, locked: [true, true] })).toEqual({ kind: "none" });
  });
});

describe("fractionAt unclamped", () => {
  it("measures past the ends for drag distances", () => {
    const l: Layout = { start: 100, length: 300, size: 24, reversed: false };
    expect(fractionAt(0, l, true)).toBeCloseTo(-112 / 276, 10);
    expect(fractionAt(500, l, true)).toBeCloseTo(388 / 276, 10);
  });
});

describe("pickFromStack", () => {
  it("takes the thumb that can move in the drag direction", () => {
    expect(pickFromStack([0, 1], false)).toBe(0);
    expect(pickFromStack([0, 1], true)).toBe(1);
    expect(pickFromStack([1, 2, 3], true)).toBe(3);
  });
});

describe("tooltip layout", () => {
  it("keeps apart labels that don't touch", () => {
    expect(groupOverlapping([{ center: 50, size: 40 }, { center: 150, size: 40 }], 4)).toEqual([[0], [1]]);
  });

  it("merges labels that overlap or come closer than the gap", () => {
    expect(groupOverlapping([{ center: 100, size: 40 }, { center: 130, size: 40 }], 4)).toEqual([[0, 1]]);
    expect(groupOverlapping([{ center: 100, size: 40 }, { center: 142, size: 40 }], 4)).toEqual([[0, 1]]);
    expect(groupOverlapping([{ center: 100, size: 40 }, { center: 144, size: 40 }], 4)).toEqual([[0], [1]]);
  });

  it("walks labels in screen order (RTL lists them right to left)", () => {
    const rtl = [{ center: 250, size: 40 }, { center: 230, size: 40 }, { center: 40, size: 40 }];
    expect(groupOverlapping(rtl, 4)).toEqual([[2], [1, 0]]);
  });

  it("chains a run of close labels into one group", () => {
    const run = [10, 40, 70, 200].map((center) => ({ center, size: 36 }));
    expect(groupOverlapping(run, 4)).toEqual([[0, 1, 2], [3]]);
  });

  it("shifts labels inward at the ends, never in the middle", () => {
    expect(containShift(12, 40, 300)).toBe(8);
    expect(containShift(288, 50, 300)).toBe(-13);
    expect(containShift(150, 50, 300)).toBe(0);
  });

  it("lines a label wider than the slider up with its start", () => {
    expect(containShift(50, 400, 300)).toBe(150);
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
