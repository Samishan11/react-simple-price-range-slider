import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import MultiRangeSlider, { RangeValues } from "../src";

const sliders = () => screen.getAllByRole("slider") as HTMLInputElement[];
const change = (i: number, v: number) =>
  fireEvent.change(sliders()[i], { target: { value: String(v) } });

describe("rendering & legacy props", () => {
  it("renders two sliders with default values and $ prefix", () => {
    render(<MultiRangeSlider min={0} max={100} />);
    expect(sliders()).toHaveLength(2);
    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.getByText("$100")).toBeInTheDocument();
  });

  it("maps trackColor / rangeColor / width onto CSS variables", () => {
    const { container } = render(
      <MultiRangeSlider min={0} max={10} trackColor="red" rangeColor="blue" width="400px" />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--rs-track-color")).toBe("red");
    expect(root.style.getPropertyValue("--rs-range-color")).toBe("blue");
    expect(root.style.getPropertyValue("--rs-width")).toBe("400px");
  });

  it("honors currencyText and formatValue", () => {
    const { rerender } = render(<MultiRangeSlider min={0} max={100} currencyText="€" />);
    expect(screen.getByText("€100")).toBeInTheDocument();
    rerender(<MultiRangeSlider min={0} max={100} formatValue={(n) => `${n} kg`} />);
    expect(screen.getByText("100 kg")).toBeInTheDocument();
    expect(sliders()[1]).toHaveAttribute("aria-valuetext", "100 kg");
  });

  it("can hide values", () => {
    render(<MultiRangeSlider min={0} max={100} showValues={false} />);
    expect(screen.queryByText("$100")).not.toBeInTheDocument();
  });
});

describe("uncontrolled", () => {
  it("uses defaultValue and calls onChange", () => {
    const onChange = vi.fn();
    render(<MultiRangeSlider min={0} max={100} defaultValue={{ min: 10, max: 90 }} onChange={onChange} />);
    expect(sliders()[0].value).toBe("10");
    change(0, 20);
    expect(onChange).toHaveBeenLastCalledWith({ min: 20, max: 90 });
    expect(sliders()[0].value).toBe("20");
  });

  it("does not call onChange on mount or for no-op changes", () => {
    const onChange = vi.fn();
    render(<MultiRangeSlider min={0} max={100} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("never lets min cross max, respecting minGap", () => {
    const onChange = vi.fn();
    render(<MultiRangeSlider min={0} max={100} minGap={10} onChange={onChange} />);
    change(0, 100);
    expect(onChange).toHaveBeenLastCalledWith({ min: 90, max: 100 });
    change(1, 0);
    expect(onChange).toHaveBeenLastCalledWith({ min: 90, max: 100 });
  });

  it("gap defaults to 0, so the thumbs can meet (but never cross)", () => {
    const onChange = vi.fn();
    render(<MultiRangeSlider min={0} max={100} step={5} defaultValue={{ min: 20, max: 60 }} onChange={onChange} />);
    expect(sliders()[0]).toHaveAttribute("step", "5");
    change(0, 100);
    expect(onChange).toHaveBeenLastCalledWith({ min: 60, max: 60 });
    change(1, 0);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("never emits floating-point noise with decimal steps", () => {
    const onChange = vi.fn();
    render(<MultiRangeSlider min={0} max={1} step={0.1} minGap={0.1} defaultValue={{ min: 0.2, max: 0.4 }} onChange={onChange} />);
    change(0, 0.9); // lower thumb runs into the upper one: 0.4 - 0.1
    expect(onChange).toHaveBeenLastCalledWith({ min: 0.3, max: 0.4 });
    expect(screen.getByText("$0.3")).toBeInTheDocument();
    change(1, 0); // upper thumb runs into the lower one: 0.3 + 0.1 is 0.4 again
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe("controlled", () => {
  it("stays put until the parent updates value", () => {
    const onChange = vi.fn();
    render(<MultiRangeSlider min={0} max={100} value={{ min: 10, max: 50 }} onChange={onChange} />);
    change(0, 30);
    expect(onChange).toHaveBeenCalledWith({ min: 30, max: 50 });
    expect(sliders()[0].value).toBe("10");
  });

  it("follows the parent (reset from outside)", () => {
    const Wrapper = () => {
      const [v, setV] = useState<RangeValues>({ min: 0, max: 100 });
      return (
        <>
          <MultiRangeSlider min={0} max={100} value={v} onChange={setV} />
          <button onClick={() => setV({ min: 25, max: 75 })}>reset</button>
        </>
      );
    };
    render(<Wrapper />);
    change(0, 40);
    expect(sliders()[0].value).toBe("40");
    fireEvent.click(screen.getByText("reset"));
    expect(sliders()[0].value).toBe("25");
    expect(sliders()[1].value).toBe("75");
  });

  it("clamps out-of-range values and follows min/max prop changes", () => {
    const { rerender } = render(<MultiRangeSlider min={0} max={100} value={{ min: -50, max: 500 }} />);
    expect(sliders()[0].value).toBe("0");
    expect(sliders()[1].value).toBe("100");
    rerender(<MultiRangeSlider min={0} max={50} value={{ min: 10, max: 100 }} />);
    expect(sliders()[1].value).toBe("50");
  });
});

describe("misc", () => {
  it("disables both inputs", () => {
    const { container } = render(<MultiRangeSlider min={0} max={100} disabled />);
    sliders().forEach((s) => expect(s).toBeDisabled());
    expect(container.firstElementChild).toHaveAttribute("data-disabled");
  });

  it("names inputs for forms", () => {
    render(<MultiRangeSlider min={0} max={100} name="price" />);
    expect(sliders()[0]).toHaveAttribute("name", "price-min");
    expect(sliders()[1]).toHaveAttribute("name", "price-max");
  });

  // Pointer drags need real layout, so they're covered in e2e/interaction.spec.ts.
  it("fires onChangeEnd when a keyboard adjustment ends", () => {
    const onChangeEnd = vi.fn();
    render(<MultiRangeSlider min={0} max={100} onChangeEnd={onChangeEnd} />);
    change(0, 20);
    fireEvent.keyUp(sliders()[0], { key: "ArrowRight" });
    expect(onChangeEnd).toHaveBeenLastCalledWith({ min: 20, max: 100 });
    fireEvent.keyUp(sliders()[1], { key: "Tab" });
    expect(onChangeEnd).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(sliders()[1], { key: "ArrowLeft" });
    expect(onChangeEnd).toHaveBeenCalledTimes(2);
  });

  it("ignores pointer presses before the slider is laid out", () => {
    const onChange = vi.fn();
    const { container } = render(<MultiRangeSlider min={0} max={100} onChange={onChange} />);
    const control = container.querySelector(".rs-control")!;
    fireEvent.pointerDown(control, { pointerId: 1, clientX: 10 });
    fireEvent.pointerUp(control, { pointerId: 1, clientX: 10 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("puts the min thumb on top when both thumbs sit at the max end", () => {
    render(<MultiRangeSlider min={0} max={100} defaultValue={{ min: 100, max: 100 }} />);
    expect(sliders()[0].style.zIndex).toBe("4");
    expect(sliders()[1].style.zIndex).toBe("3");
  });

  it("exposes exact fill position without rounding", () => {
    const { container } = render(
      <MultiRangeSlider min={0} max={3} value={{ min: 1, max: 2 }} />
    );
    const root = container.firstElementChild as HTMLElement;
    expect(parseFloat(root.style.getPropertyValue("--rs-left"))).toBeCloseTo(33.333, 2);
    expect(parseFloat(root.style.getPropertyValue("--rs-right"))).toBeCloseTo(33.333, 2);
  });
});

describe("phase 3 features", () => {
  it("applies theme and dir attributes", () => {
    const { container } = render(<MultiRangeSlider min={0} max={10} theme="dark" dir="rtl" />);
    const root = container.firstElementChild!;
    expect(root).toHaveAttribute("data-theme", "dark");
    expect(root).toHaveAttribute("dir", "rtl");
  });

  it("renders tooltips only when enabled, always-visible on request", () => {
    const { container, rerender } = render(<MultiRangeSlider min={0} max={100} />);
    expect(container.querySelectorAll(".rs-tooltip")).toHaveLength(0);
    rerender(<MultiRangeSlider min={0} max={100} tooltip />);
    expect(container.querySelectorAll(".rs-tooltip")).toHaveLength(2);
    expect(container.querySelector("[data-show='always']")).toBeNull();
    rerender(<MultiRangeSlider min={0} max={100} tooltip="always" />);
    expect(container.querySelectorAll("[data-show='always']")).toHaveLength(2);
  });

  it("generates auto marks and marks active ones", () => {
    const { container } = render(
      <MultiRangeSlider min={0} max={100} marks={4} value={{ min: 25, max: 75 }} />
    );
    const marks = container.querySelectorAll(".rs-mark");
    expect(marks).toHaveLength(5);
    expect(Array.from(marks).map((m) => m.hasAttribute("data-active"))).toEqual([false, true, true, true, false]);
  });

  it("renders custom marks with labels", () => {
    render(<MultiRangeSlider min={0} max={100} marks={[{ value: 0, label: "Low" }, { value: 100, label: "High" }, { value: 500, label: "Gone" }]} />);
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.queryByText("Gone")).not.toBeInTheDocument();
  });

  it("supports classNames and styles slots", () => {
    const { container } = render(
      <MultiRangeSlider min={0} max={100} classNames={{ root: "r", thumb: "t", range: "g" }} styles={{ range: { opacity: 0.5 } }} />
    );
    expect(container.firstElementChild).toHaveClass("rs-root", "r");
    expect(container.querySelectorAll(".rs-thumb.t")).toHaveLength(2);
    expect(container.querySelector(".rs-range.g")).toHaveStyle({ opacity: "0.5" });
  });
});

describe("accessibility", () => {
  it("exposes a labelled group and labelled, valuetext-bearing thumbs", () => {
    render(<MultiRangeSlider min={0} max={100} ariaLabel="Price range" minAriaLabel="Min price" maxAriaLabel="Max price" />);
    expect(screen.getByRole("group", { name: "Price range" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Min price" })).toHaveAttribute("aria-valuetext", "$0");
    expect(screen.getByRole("slider", { name: "Max price" })).toHaveAttribute("aria-valuetext", "$100");
  });

  it("hides decorative parts from assistive tech", () => {
    const { container } = render(<MultiRangeSlider min={0} max={100} tooltip marks />);
    container.querySelectorAll(".rs-tooltip, .rs-marks").forEach((el) => expect(el).toHaveAttribute("aria-hidden", "true"));
  });

  it("keeps thumbs keyboard-focusable unless disabled", () => {
    const { rerender } = render(<MultiRangeSlider min={0} max={100} />);
    sliders()[0].focus();
    expect(sliders()[0]).toHaveFocus();
    rerender(<MultiRangeSlider min={0} max={100} disabled />);
    expect(sliders()[0]).toBeDisabled();
  });
});
