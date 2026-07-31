import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";

vi.mock("@/features/auth/use-auth", () => ({
  useAuth: () => ({ profile: null }),
}));

describe("CommandPalette", () => {
  it("renders when open and filters items by search query", async () => {
    const handleOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CommandPalette open={true} onOpenChange={handleOpenChange} />
      </MemoryRouter>,
    );

    expect(
      screen.getByPlaceholderText(/ابحث عن قسم أو إجراء/i),
    ).toBeInTheDocument();
    expect(screen.getByText("لوحة الملخص الرئيسية")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/ابحث عن قسم أو إجراء/i), "محافظ");

    expect(screen.getByText("المحافظ والحسابات")).toBeInTheDocument();
    expect(screen.queryByText("لوحة الملخص الرئيسية")).not.toBeInTheDocument();
  });

  it("closes when Esc key is pressed", async () => {
    const handleOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CommandPalette open={true} onOpenChange={handleOpenChange} />
      </MemoryRouter>,
    );

    await user.keyboard("{Escape}");
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
