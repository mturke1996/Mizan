import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { DesktopHeader } from "./DesktopHeader";

vi.mock("@/features/auth/use-auth", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

vi.mock("@/features/workspace/use-workspace", () => ({
  useWorkspace: () => ({
    membership: { workspaceName: "مساحة التجار" },
    refresh: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            limit: () => Promise.resolve({ data: [{ id: "n1" }], error: null }),
          }),
        }),
      }),
    }),
  }),
}));

function renderHeader(onOpen = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DesktopHeader onOpenCommandPalette={onOpen} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DesktopHeader", () => {
  it("renders workspace badge and opens command palette on click", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();

    renderHeader(onOpen);

    expect(screen.getByText("مساحة التجار")).toBeInTheDocument();

    const searchBtn = screen.getByRole("button", {
      name: /ابحث أو انتقل سريعًا/i,
    });
    await user.click(searchBtn);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
