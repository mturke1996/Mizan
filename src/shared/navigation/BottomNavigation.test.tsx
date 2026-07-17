import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { BottomNavigation } from "./BottomNavigation";

describe("BottomNavigation", () => {
  it("opens the more sheet with analytics and clients shortcuts", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <BottomNavigation />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "المزيد" }));

    expect(
      screen.getByRole("heading", { name: "المزيد" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /التحليلات/ })).toHaveAttribute(
      "href",
      "/analytics",
    );
    expect(screen.getByRole("link", { name: /^التقارير/ })).toHaveAttribute(
      "href",
      "/reports",
    );
    expect(screen.getByRole("link", { name: /^الميزانيات/ })).toHaveAttribute(
      "href",
      "/budgets",
    );
    expect(screen.getByRole("link", { name: /العملاء/ })).toHaveAttribute(
      "href",
      "/clients",
    );
    expect(screen.queryByRole("link", { name: /المحافظ/ })).not.toBeInTheDocument();
  });
});
