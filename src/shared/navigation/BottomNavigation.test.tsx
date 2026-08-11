import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { BottomNavigation } from "./BottomNavigation";
import { MoreNavProvider } from "./more-nav-context";

function renderBottomNav(initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <MoreNavProvider>
        <BottomNavigation />
      </MoreNavProvider>
    </MemoryRouter>,
  );
}

describe("BottomNavigation", () => {
  it("exposes wallets as a primary tab beside projects", () => {
    renderBottomNav();

    expect(screen.getByRole("link", { name: "المحافظ" })).toHaveAttribute(
      "href",
      "/wallets",
    );
    expect(screen.getByRole("link", { name: "المشاريع" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect(screen.getByRole("link", { name: "المستحقات" })).toHaveAttribute(
      "href",
      "/debts",
    );
    expect(screen.getByRole("button", { name: "المزيد" })).toBeInTheDocument();
  });

  it("highlights the more tab on analytics routes", () => {
    renderBottomNav("/analytics");

    expect(screen.getByRole("button", { name: "المزيد" })).toHaveClass(
      "text-primary",
    );
  });

  it("opens the more navigation sheet from the tab bar", async () => {
    const user = userEvent.setup();
    renderBottomNav();

    await user.click(screen.getByRole("button", { name: "المزيد" }));

    expect(
      await screen.findByRole("link", { name: /التحليلات/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /العملاء/ })).toBeInTheDocument();
  });
});
