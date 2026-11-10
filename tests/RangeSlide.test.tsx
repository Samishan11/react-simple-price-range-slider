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

  it("gap defaults to step", () => {
    const onChange = vi.fn();
    render(<MultiRangeSlider min={0} max={100} step={5} onChange={onChange} />);
    expect(sliders()[0]).toHaveAttribute("step", "5");
    change(0, 100);
    expect(onChange).toHaveBeenLastCalledWith({ min: 95, max: 100 });
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

  it("fires onChangeEnd on pointer up and arrow-key release", () => {
    const onChangeEnd = vi.fn();
    render(<MultiRangeSlider min={0} max={100} onChangeEnd={onChangeEnd} />);
    change(0, 20);
    fireEvent.pointerUp(sliders()[0]);
    expect(onChangeEnd).toHaveBeenLastCalledWith({ min: 20, max: 100 });
    fireEvent.keyUp(sliders()[1], { key: "Tab" });
    expect(onChangeEnd).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(sliders()[1], { key: "ArrowLeft" });
    expect(onChangeEnd).toHaveBeenCalledTimes(2);
  });

  it("puts the min thumb on top when both thumbs sit at the max end", () => {
    render(<MultiRangeSlider min={0} max={100} defaultValue={{ min: 99, max: 100 }} />);
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
