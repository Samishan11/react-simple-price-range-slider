import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import MultiRangeSlider from "../src";

describe("MultiRangeSlider (v1 baseline)", () => {
  it("renders two range inputs and the initial values", () => {
    render(<MultiRangeSlider min={0} max={100} onChange={() => {}} />);
    expect(screen.getAllByRole("slider")).toHaveLength(2);
    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.getByText("$100")).toBeInTheDocument();
  });

  it("calls onChange when the min thumb moves", () => {
    const onChange = vi.fn();
    render(<MultiRangeSlider min={0} max={100} onChange={onChange} />);
    fireEvent.change(screen.getAllByRole("slider")[0], { target: { value: "20" } });
    expect(onChange).toHaveBeenLastCalledWith({ min: 20, max: 100 });
  });

  it("never lets min cross max", () => {
    const onChange = vi.fn();
    render(<MultiRangeSlider min={0} max={100} onChange={onChange} />);
    fireEvent.change(screen.getAllByRole("slider")[0], { target: { value: "100" } });
    expect(onChange).toHaveBeenLastCalledWith({ min: 99, max: 100 });
  });
});
