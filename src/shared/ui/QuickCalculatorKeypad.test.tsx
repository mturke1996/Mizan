import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QuickCalculatorKeypad } from "./QuickCalculatorKeypad";

describe("QuickCalculatorKeypad", () => {
  it("renders keypad and applies mathematical calculations", () => {
    const handleApply = vi.fn();
    render(<QuickCalculatorKeypad initialValue="10" onApply={handleApply} />);

    expect(screen.getByText("حاسبة سريعة")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();

    // Press '+' then '5' then '='
    fireEvent.click(screen.getByText("+"));
    fireEvent.click(screen.getByText("5"));
    fireEvent.click(screen.getByText("="));

    expect(screen.getByText("15")).toBeInTheDocument();

    // Confirm button
    const applyButton = screen.getByTitle("تطبيق المبلغ");
    fireEvent.click(applyButton);

    expect(handleApply).toHaveBeenCalledWith("15");
  });
});
