import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("announces an actionable Arabic empty state with a primary action", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    render(
      <EmptyState
        action={
          <button type="button" onClick={onCreate}>
            إضافة أول محفظة
          </button>
        }
        className="custom-empty"
        description="أضف محفظتك لتبدأ متابعة الرصيد والحركات."
        icon={<svg data-testid="empty-icon" />}
        title="لا توجد محافظ بعد"
      />,
    );

    const region = screen.getByRole("region", {
      name: "لا توجد محافظ بعد",
    });

    expect(region).toHaveClass("rounded-sm", "border-dashed", "custom-empty");
    expect(
      screen.getByRole("heading", { name: "لا توجد محافظ بعد" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("أضف محفظتك لتبدأ متابعة الرصيد والحركات."),
    ).toBeInTheDocument();
    expect(
      within(region).getByTestId("empty-icon").parentElement,
    ).toHaveAttribute("aria-hidden", "true");

    await user.click(screen.getByRole("button", { name: "إضافة أول محفظة" }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("renders a numeric zero action node", () => {
    render(
      <EmptyState
        action={0}
        description="يمكن إضافة السجلات لاحقًا."
        icon={<svg />}
        title="لا توجد سجلات"
      />,
    );

    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
