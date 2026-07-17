import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BottomNavigation } from "./BottomNavigation";

describe("BottomNavigation", () => {
  it("exposes wallets as a primary tab beside projects", () => {
    render(
      <MemoryRouter>
        <BottomNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "المحافظ" })).toHaveAttribute(
      "href",
      "/wallets",
    );
    expect(screen.getByRole("link", { name: "المشاريع" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect(screen.getByRole("link", { name: "أموالي" })).toHaveAttribute(
      "href",
      "/debts",
    );
    expect(
      screen.queryByRole("button", { name: "المزيد" }),
    ).not.toBeInTheDocument();
  });
});
