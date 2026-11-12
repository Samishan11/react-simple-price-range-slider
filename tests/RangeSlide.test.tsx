import React, { useState } from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";
import MultiRangeSlider, { RangeSlider, RangeValues, type RangeSliderHandle } from "../src";

const sliders = () => screen.getAllByRole("slider") as HTMLInputElement[];
const values = () => sliders().map((s) => Number(s.value));
/** A value set directly on a thumb's input, as assistive technology or autofill does. */
const change = (i: number, v: number) =>
  fireEvent.change(sliders()[i], { target: { value: String(v) } });
const key = (i: number, k: string, init: { shiftKey?: boolean } = {}) => {
  fireEvent.keyDown(sliders()[i], { key: k, ...init });
  fireEvent.keyUp(sliders()[i], { key: k, ...init });
};
const input = (thumb: number) => ({ thumb, source: "input" });
const keyboard = (thumb: number) => ({ thumb, source: "keyboard" });

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
  it("uses defaultValue and calls onChange with the value and what moved it", () => {
    const onChange = vi.fn();
    render(<MultiRangeSlider min={0} max={100} defaultValue={{ min: 10, max: 90 }} onChange={onChange} />);
    expect(sliders()[0].value).toBe("10");
    change(0, 20);
    expect(onChange).toHaveBeenLastCalledWith({ min: 20, max: 90 }, input(0));
    expect(sliders()[0].value).toBe("20");
  });

  it("does not call onChange on mount", () => {
    const onChange = vi.fn();
    render(<MultiRangeSlider min={0} max={100} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("never lets min cross max, respecting minGap", () => {
    const onChange = vi.fn();
    render(<MultiRangeSlider min={0} max={100} minGap={10} onChange={onChange} />);
    change(0, 100);
    expect(onChange).toHaveBeenLastCalledWith({ min: 90, max: 100 }, input(0));
    change(1, 0);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("gap defaults to 0, so the thumbs can meet (but never cross)", () => {
    const onChange = vi.fn();
    render(<MultiRangeSlider min={0} max={100} step={5} defaultValue={{ min: 20, max: 60 }} onChange={onChange} />);
    change(0, 100);
    expect(onChange).toHaveBeenLastCalledWith({ min: 60, max: 60 }, input(0));
    change(1, 0);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("never emits floating-point noise with decimal steps", () => {
    const onChange = vi.fn();
    render(<MultiRangeSlider min={0} max={1} step={0.1} minGap={0.1} defaultValue={{ min: 0.2, max: 0.4 }} onChange={onChange} />);
    change(0, 0.9); // lower thumb runs into the upper one: 0.4 - 0.1
    expect(onChange).toHaveBeenLastCalledWith({ min: 0.3, max: 0.4 }, input(0));
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
    expect(onChange).toHaveBeenCalledWith({ min: 30, max: 50 }, input(0));
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
    expect(values()).toEqual([25, 75]);
  });

  it("clamps out-of-range values and follows min/max prop changes", () => {
    const { rerender } = render(<MultiRangeSlider min={0} max={100} value={{ min: -50, max: 500 }} />);
    expect(values()).toEqual([0, 100]);
    rerender(<MultiRangeSlider min={0} max={50} value={{ min: 10, max: 100 }} />);
    expect(values()).toEqual([10, 50]);
  });
});

describe("value shapes", () => {
  it("a number makes a single thumb, and onChange reports a number", () => {
    const onChange = vi.fn();
    render(<RangeSlider defaultValue={30} onChange={onChange} ariaLabel="Volume" />);
    expect(sliders()).toHaveLength(1);
    expect(screen.getByRole("slider", { name: "Volume" })).toHaveValue("30");
    expect(screen.queryByRole("group")).toBeNull();
    key(0, "ArrowRight");
    expect(onChange).toHaveBeenLastCalledWith(31, keyboard(0));
  });

  it("an array gives one thumb per entry, and onChange reports an array", () => {
    const onChange = vi.fn();
    render(<RangeSlider defaultValue={[10, 40, 70]} onChange={onChange} />);
    expect(sliders().map((s) => s.getAttribute("aria-label"))).toEqual(["Value 1 of 3", "Value 2 of 3", "Value 3 of 3"]);
    key(1, "End"); // the middle thumb stops at its upper neighbour
    expect(onChange).toHaveBeenLastCalledWith([10, 70, 70], keyboard(1));
  });

  it("without a value, RangeSlider reports arrays and MultiRangeSlider keeps { min, max }", () => {
    const a = vi.fn();
    const b = vi.fn();
    render(
      <>
        <RangeSlider onChange={a} />
        <MultiRangeSlider onChange={b} />
      </>
    );
    key(0, "ArrowRight");
    key(2, "ArrowRight");
    expect(a).toHaveBeenLastCalledWith([1, 100], keyboard(0));
    expect(b).toHaveBeenLastCalledWith({ min: 1, max: 100 }, keyboard(0));
  });

  it("names form fields by thumb count", () => {
    const { unmount } = render(<RangeSlider defaultValue={5} name="qty" />);
    expect(sliders()[0]).toHaveAttribute("name", "qty");
    unmount();
    render(<MultiRangeSlider min={0} max={100} name="price" />);
    expect(sliders().map((s) => s.getAttribute("name"))).toEqual(["price-min", "price-max"]);
  });
});

describe("keyboard", () => {
  it("arrows step; Shift+arrows and PageUp/PageDown take ~10%; Home/End go to the limits", () => {
    render(<RangeSlider defaultValue={50} />);
    key(0, "ArrowUp");
    expect(values()).toEqual([51]);
    key(0, "ArrowLeft");
    expect(values()).toEqual([50]);
    key(0, "ArrowRight", { shiftKey: true });
    expect(values()).toEqual([60]);
    key(0, "PageDown");
    expect(values()).toEqual([50]);
    key(0, "End");
    expect(values()).toEqual([100]);
    key(0, "Home");
    expect(values()).toEqual([0]);
  });

  it("follows largeStep", () => {
    render(<RangeSlider defaultValue={50} largeStep={25} />);
    key(0, "PageUp");
    expect(values()).toEqual([75]);
  });

  it("flips Left/Right in RTL and on inverted sliders", () => {
    const { unmount } = render(<RangeSlider defaultValue={50} dir="rtl" />);
    key(0, "ArrowLeft");
    expect(values()).toEqual([51]);
    unmount();
    render(<RangeSlider defaultValue={50} inverted />);
    key(0, "ArrowRight");
    expect(values()).toEqual([49]);
  });

  it("reaches an off-grid max and steps back onto the grid", () => {
    render(<RangeSlider defaultValue={90} max={100} step={30} />);
    key(0, "ArrowRight");
    expect(values()).toEqual([100]);
    key(0, "ArrowLeft");
    expect(values()).toEqual([90]);
  });

  it("fires onChangeEnd when a key is released", () => {
    const onChangeEnd = vi.fn();
    render(<MultiRangeSlider min={0} max={100} onChangeEnd={onChangeEnd} />);
    fireEvent.keyDown(sliders()[0], { key: "ArrowRight" });
    expect(onChangeEnd).not.toHaveBeenCalled();
    fireEvent.keyUp(sliders()[0], { key: "ArrowRight" });
    expect(onChangeEnd).toHaveBeenLastCalledWith({ min: 1, max: 100 }, keyboard(0));
    fireEvent.keyUp(sliders()[1], { key: "Tab" });
    expect(onChangeEnd).toHaveBeenCalledTimes(1);
  });
});

describe("assistive technology", () => {
  it("a small nudge on the input moves at least one stop", () => {
    render(<RangeSlider defaultValue={50} step={50} />);
    change(0, 51);
    expect(values()).toEqual([100]);
    change(0, 99);
    expect(values()).toEqual([50]);
  });

  it("fires onChangeEnd when the input's value is committed", () => {
    const onChangeEnd = vi.fn();
    render(<MultiRangeSlider min={0} max={100} onChangeEnd={onChangeEnd} />);
    change(1, 70);
    expect(onChangeEnd).toHaveBeenLastCalledWith({ min: 0, max: 70 }, input(1));
  });
});

describe("misc", () => {
  it("disables both inputs", () => {
    const { container } = render(<MultiRangeSlider min={0} max={100} disabled />);
    sliders().forEach((s) => expect(s).toBeDisabled());
    expect(container.firstElementChild).toHaveAttribute("data-disabled");
  });

  // Pointer drags need real layout, so they're covered in e2e/interaction.spec.ts.
  it("ignores pointer presses before the slider is laid out", () => {
    const onChange = vi.fn();
    const { container } = render(<MultiRangeSlider min={0} max={100} onChange={onChange} />);
    const control = container.querySelector(".rs-control")!;
    fireEvent.pointerDown(control, { pointerId: 1, clientX: 10 });
    fireEvent.pointerUp(control, { pointerId: 1, clientX: 10 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("draws the last-used thumb on top", () => {
    const { container } = render(<MultiRangeSlider min={0} max={100} defaultValue={{ min: 50, max: 50 }} />);
    const thumbs = container.querySelectorAll(".rs-thumb");
    expect(thumbs[1]).toHaveAttribute("data-active");
    fireEvent.focus(sliders()[0]);
    expect(thumbs[0]).toHaveAttribute("data-active");
    expect(thumbs[1]).not.toHaveAttribute("data-active");
  });

  it("marks vertical sliders for assistive technology", () => {
    const { container } = render(<RangeSlider defaultValue={[20, 80]} orientation="vertical" />);
    expect(container.firstElementChild).toHaveAttribute("data-orientation", "vertical");
    sliders().forEach((s) => expect(s).toHaveAttribute("aria-orientation", "vertical"));
  });
});

describe("theme, tooltips, marks, slots", () => {
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

  it("a single thumb lights the marks up to its value", () => {
    const { container } = render(<RangeSlider defaultValue={50} marks={4} />);
    const marks = container.querySelectorAll(".rs-mark");
    expect(Array.from(marks).map((m) => m.hasAttribute("data-active"))).toEqual([true, true, true, false, false]);
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

describe("collisions, locks and read-only", () => {
  it("push: a thumb pushes its neighbour along", () => {
    render(<RangeSlider defaultValue={[20, 21]} collision="push" />);
    key(0, "ArrowRight");
    key(0, "ArrowRight");
    expect(values()).toEqual([22, 22]);
  });

  it("block (default): a thumb stops at its neighbour", () => {
    render(<RangeSlider defaultValue={[20, 21]} />);
    key(0, "ArrowRight");
    key(0, "ArrowRight");
    expect(values()).toEqual([21, 21]);
  });

  it("swap: a thumb passes its neighbour, and keyboard focus follows it", () => {
    render(<RangeSlider defaultValue={[20, 21]} collision="swap" />);
    act(() => sliders()[0].focus());
    key(0, "ArrowRight"); // meets the neighbour: now the upper thumb
    expect(sliders()[1]).toHaveFocus();
    key(1, "ArrowRight");
    expect(values()).toEqual([21, 22]);
  });

  it("disabledThumbs locks a thumb: not focusable, and push stops at it", () => {
    const { container } = render(
      <RangeSlider defaultValue={[20, 50, 80]} collision="push" disabledThumbs={[false, true, false]} />
    );
    expect(sliders()[1]).toBeDisabled();
    expect(container.querySelectorAll(".rs-thumb")[1]).toHaveAttribute("data-disabled");
    key(0, "End");
    expect(values()).toEqual([50, 50, 80]);
  });

  it("readOnly shows the value, stays focusable, and ignores input", () => {
    const onChange = vi.fn();
    const { container } = render(<RangeSlider defaultValue={30} readOnly onChange={onChange} />);
    expect(sliders()[0]).not.toBeDisabled();
    expect(sliders()[0]).toHaveAttribute("aria-readonly", "true");
    expect(container.firstElementChild).toHaveAttribute("data-readonly");
    key(0, "ArrowRight");
    change(0, 90);
    expect(values()).toEqual([30]);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("marks and formatting", () => {
  it("snapToMarks: thumbs stop only at mark values", () => {
    const marks = [0, 25, 60, 100].map((value) => ({ value }));
    render(<RangeSlider defaultValue={25} marks={marks} snapToMarks />);
    key(0, "ArrowRight");
    expect(values()).toEqual([60]);
    key(0, "ArrowLeft");
    expect(values()).toEqual([25]);
    change(0, 70); // assistive technology: nearest mark
    expect(values()).toEqual([60]);
  });

  it("format and locale format through Intl.NumberFormat", () => {
    render(
      <RangeSlider defaultValue={1000} max={2000} format={{ style: "currency", currency: "EUR", maximumFractionDigits: 0 }} locale="de-DE" />
    );
    expect(sliders()[0].getAttribute("aria-valuetext")).toMatch(/^1\.000\s€$/);
  });

  it("formatValue still wins over format", () => {
    render(<RangeSlider defaultValue={5} format={{ style: "percent" }} formatValue={(n) => `${n} pts`} />);
    expect(sliders()[0]).toHaveAttribute("aria-valuetext", "5 pts");
  });
});

describe("ref", () => {
  it("reads and sets the value in the slider's shape, focuses thumbs, exposes the root", () => {
    const ref = React.createRef<RangeSliderHandle<number[]>>();
    render(<RangeSlider ref={ref} defaultValue={[20, 80]} />);
    expect(ref.current!.getValue()).toEqual([20, 80]);
    act(() => ref.current!.setValue([30, 70]));
    expect(values()).toEqual([30, 70]);
    act(() => ref.current!.focus(1));
    expect(sliders()[1]).toHaveFocus();
    expect(ref.current!.element).toHaveClass("rs-root");
  });

  it("MultiRangeSlider's handle speaks { min, max }; controlled sliders ignore setValue", () => {
    const ref = React.createRef<RangeSliderHandle<RangeValues>>();
    const { rerender } = render(<MultiRangeSlider ref={ref} min={0} max={100} />);
    expect(ref.current!.getValue()).toEqual({ min: 0, max: 100 });
    rerender(<MultiRangeSlider ref={ref} min={0} max={100} value={{ min: 10, max: 90 }} />);
    act(() => ref.current!.setValue({ min: 40, max: 60 }));
    expect(values()).toEqual([10, 90]);
  });
});

describe("customization", () => {
  it("unstyled leaves out every built-in class, keeps your classes and the inline layout", () => {
    const { container } = render(
      <RangeSlider
        unstyled
        defaultValue={[20, 80]}
        tooltip="always"
        marks={2}
        classNames={{ thumb: "t", tooltipLabel: "tl", markLabel: "ml", separator: "sep" }}
      />
    );
    expect(container.querySelectorAll('[class*="rs-"]')).toHaveLength(0);
    expect(container.querySelectorAll(".t")).toHaveLength(2);
    expect(container.querySelectorAll(".tl")).toHaveLength(2);
    expect(container.querySelectorAll(".ml")).toHaveLength(3);
    expect(container.querySelectorAll(".sep")).toHaveLength(1);
    const anchor = container.querySelector(".tl")!.parentElement!;
    expect(anchor.style.position).toBe("absolute");
    expect(anchor.style.display).toBe("flex");
    expect(sliders()[0].style.opacity).toBe("0"); // the inputs stay hidden without the stylesheet
  });

  it("renderThumb puts content inside each thumb", () => {
    const { container } = render(
      <RangeSlider
        defaultValue={[20, 80]}
        renderThumb={({ index, formatted, active }) => (
          <b data-testid={`grip-${index}`}>
            {formatted}
            {active ? "*" : ""}
          </b>
        )}
      />
    );
    const thumbs = container.querySelectorAll(".rs-thumb");
    expect(thumbs[0]).toContainElement(screen.getByTestId("grip-0"));
    expect(screen.getByTestId("grip-0")).toHaveTextContent("$20");
    expect(screen.getByTestId("grip-1")).toHaveTextContent("$80*"); // the last thumb starts on top
  });

  it("renderTooltip replaces the label content", () => {
    render(<RangeSlider defaultValue={[20, 80]} tooltip="always" renderTooltip={({ value }) => `${value} pts`} />);
    expect(screen.getByText("20 pts")).toBeInTheDocument();
    expect(screen.getByText("80 pts")).toBeInTheDocument();
  });

  // (jsdom never treats focus as :focus-visible, so a key press makes the thumb keyboard-focused here;
  // e2e covers Tab focus in real browsers.)
  it("marks tooltips data-visible: always, or for the keyboard-focused thumb in hover mode", () => {
    const { container, rerender } = render(<RangeSlider defaultValue={[20, 80]} tooltip />);
    const visible = () => container.querySelectorAll(".rs-tooltip[data-visible]");
    expect(visible()).toHaveLength(0);
    act(() => sliders()[1].focus());
    key(1, "ArrowLeft");
    expect(visible()).toHaveLength(1);
    expect(container.querySelectorAll(".rs-tooltip")[1]).toHaveAttribute("data-visible");
    rerender(<RangeSlider defaultValue={[20, 80]} tooltip="always" />);
    expect(visible()).toHaveLength(2);
  });
});

describe("accessibility", () => {
  it("exposes a labelled group and labelled, valuetext-bearing thumbs", () => {
    render(<MultiRangeSlider min={0} max={100} ariaLabel="Price range" minAriaLabel="Min price" maxAriaLabel="Max price" />);
    expect(screen.getByRole("group", { name: "Price range" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Min price" })).toHaveAttribute("aria-valuetext", "$0");
    expect(screen.getByRole("slider", { name: "Max price" })).toHaveAttribute("aria-valuetext", "$100");
  });

  it("getAriaLabel names each thumb", () => {
    render(<RangeSlider defaultValue={[1, 2, 3]} getAriaLabel={(i) => `Stop ${i + 1}`} />);
    expect(screen.getByRole("slider", { name: "Stop 3" })).toBeInTheDocument();
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
