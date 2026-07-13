import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StatCard } from "./StatCard";

describe("StatCard", () => {
  it("presents a structured metric with optional context and action", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    render(
      <StatCard
        action={
          <button type="button" onClick={onOpen}>
            عرض التفاصيل
          </button>
        }
        className="custom-stat"
        hint="محدّث اليوم"
        icon={<svg data-testid="stat-icon" />}
        label="الرصيد المتاح"
        tone="success"
        trend={<span>+8%</span>}
        value={<span>1,250 د.ل</span>}
        valueDir="auto"
      />,
    );

    const card = screen.getByRole("region", { name: "الرصيد المتاح" });
    const value = screen.getByText("1,250 د.ل").parentElement;

    expect(card).toHaveClass("rounded-md", "border-line", "custom-stat");
    expect(card.querySelector("section")).not.toBeInTheDocument();
    expect(value).toHaveAttribute("dir", "auto");
    expect(value).toHaveClass("tabular-nums", "[unicode-bidi:isolate]");
    expect(screen.getByText("+8%")).toBeInTheDocument();
    expect(screen.getByText("محدّث اليوم")).toBeInTheDocument();
    expect(
      within(card).getByTestId("stat-icon").parentElement,
    ).toHaveClass("bg-success-soft", "text-success");

    await user.click(screen.getByRole("button", { name: "عرض التفاصيل" }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("renders numeric zero in trend, hint, and action slots", () => {
    render(
      <StatCard
        action={0}
        hint={0}
        icon={<svg />}
        label="مؤشر الصفوف"
        trend={0}
        value="12"
      />,
    );

    const card = screen.getByRole("region", { name: "مؤشر الصفوف" });
    expect(within(card).getAllByText("0")).toHaveLength(3);
  });
});
