import { render, screen, within } from "@testing-library/react";

import { ProgressRing } from "./ProgressRing";

describe("ProgressRing", () => {
  it("clamps numeric progress and exposes its value accessibly", () => {
    const { rerender } = render(
      <ProgressRing
        helper="من إجمالي الفواتير"
        label="نسبة التحصيل"
        size={96}
        value={140}
      />,
    );

    const fullRing = screen.getByRole("progressbar", {
      name: "نسبة التحصيل",
    });

    expect(fullRing).toHaveAttribute("aria-valuemin", "0");
    expect(fullRing).toHaveAttribute("aria-valuemax", "100");
    expect(fullRing).toHaveAttribute("aria-valuenow", "100");
    expect(fullRing).toHaveAttribute("aria-valuetext", "100%");
    expect(fullRing).toHaveAttribute("width", "96");
    expect(fullRing).toHaveAttribute("height", "96");
    expect(screen.getByText("100%")).toHaveAttribute("dir", "ltr");
    expect(screen.getByText("من إجمالي الفواتير")).toBeInTheDocument();

    const valueCircle = within(fullRing).getByTestId("progress-ring-value");
    expect(valueCircle).toHaveAttribute("stroke", "currentColor");
    expect(valueCircle).toHaveClass(
      "transition-[stroke-dashoffset]",
      "motion-reduce:transition-none",
    );

    rerender(<ProgressRing label="نسبة التحصيل" value={-15} />);

    expect(
      screen.getByRole("progressbar", { name: "نسبة التحصيل" }),
    ).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("renders null and non-finite values as unavailable with an empty stroke", () => {
    const invalidValues = [null, Number.NaN, Infinity, -Infinity] as const;
    const { rerender } = render(
      <ProgressRing helper={0} label="اكتمال الملف" value={null} />,
    );

    for (const value of invalidValues) {
      rerender(
        <ProgressRing helper={0} label="اكتمال الملف" value={value} />,
      );

      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

      const unavailableRing = screen.getByRole("img", {
        name: "اكتمال الملف: غير متاح",
      });
      const valueCircle =
        within(unavailableRing).getByTestId("progress-ring-value");

      expect(unavailableRing).not.toHaveAttribute("aria-valuenow");
      expect(unavailableRing).not.toHaveAttribute("aria-valuetext");
      expect(valueCircle).toHaveAttribute(
        "stroke-dashoffset",
        valueCircle.getAttribute("stroke-dasharray"),
      );
      expect(screen.getByText("—")).toHaveAttribute("dir", "ltr");
      expect(screen.getByText("0")).toBeInTheDocument();
    }
  });
});
