import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FinancialCalendarView } from "./FinancialCalendarView";

describe("FinancialCalendarView", () => {
  it("renders calendar view header and weekday headers correctly", () => {
    render(<FinancialCalendarView transactions={[]} currency="LYD" />);

    expect(screen.getByText("التقويم المالي")).toBeInTheDocument();
    expect(screen.getByText("معاينة تدفقات اليوم وحركاتها النقدية")).toBeInTheDocument();
    expect(screen.getByText("أحد")).toBeInTheDocument();
    expect(screen.getByText("جمعة")).toBeInTheDocument();
  });
});
