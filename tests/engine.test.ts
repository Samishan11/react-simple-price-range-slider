import {
  centerAt,
  decimalsOf,
  fractionAt,
  moveThumb,
  pickFromStack,
  pressAt,
  roundLike,
  snapToStep,
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

describe("snapToStep", () => {
  it("snaps to the grid that starts at min", () => {
    expect(snapToStep(14, 0, 100, 10)).toBe(10);
    expect(snapToStep(15, 0, 100, 10)).toBe(20);
    expect(snapToStep(7, 5, 100, 10)).toBe(5);
    expect(snapToStep(-37, -50, 50, 25)).toBe(-25);
  });

  it("returns clean decimals", () => {
    expect(snapToStep(0.3, 0, 1, 0.1)).toBe(0.3);
    expect(snapToStep(0.72, 0, 1, 0.1)).toBe(0.7);
    expect(snapToStep(1, 0, 0.3, 0.1)).toBe(0.3); // 0.3 / 0.1 = 2.9999999999999996
  });

  it("stays on the grid inside [min, max], like a native range input", () => {
    expect(snapToStep(100, 0, 100, 30)).toBe(90);
    expect(snapToStep(-5, 0, 100, 30)).toBe(0);
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
});

describe("geometry", () => {
  const ltr: Layout = { left: 100, width: 300, size: 24, rtl: false };
  const rtl: Layout = { ...ltr, rtl: true };

  it("maps pointer x to a track fraction, thumbs staying inside the control", () => {
    expect(fractionAt(112, ltr)).toBe(0);
    expect(fractionAt(388, ltr)).toBe(1);
    expect(fractionAt(250, ltr)).toBe(0.5);
    expect(fractionAt(0, ltr)).toBe(0);
    expect(fractionAt(999, ltr)).toBe(1);
  });

  it("mirrors in RTL", () => {
    expect(fractionAt(112, rtl)).toBe(1);
    expect(fractionAt(388, rtl)).toBe(0);
  });

  it("centerAt is the inverse of fractionAt", () => {
    for (const l of [ltr, rtl]) for (const f of [0, 0.2, 0.5, 1]) expect(fractionAt(centerAt(f, l), l)).toBeCloseTo(f, 10);
  });

  it("does not divide by zero before layout", () => {
    expect(fractionAt(50, { left: 0, width: 0, size: 0, rtl: false })).toBe(0);
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
    // RTL: higher values are to the left
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
