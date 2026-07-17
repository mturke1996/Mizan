import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsPage } from "./NotificationsPage";

const updateEq = vi.fn();
const deleteEq = vi.fn();
const confirm = vi.fn();

vi.mock("@/features/auth/use-auth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/shared/ui/confirm-dialog", () => ({
  useConfirm: () => confirm,
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () =>
              Promise.resolve({
                data: [
                  {
                    id: "n1",
                    title: "السلام عليكم",
                    body: "يوم جديد",
                    kind: "system",
                    read_at: null,
                    created_at: "2026-07-17T08:00:00.000Z",
                  },
                  {
                    id: "n2",
                    title: "مقروء سابقًا",
                    body: "نص قديم",
                    kind: "billing",
                    read_at: "2026-07-16T10:00:00.000Z",
                    created_at: "2026-07-16T10:00:00.000Z",
                  },
                ],
                error: null,
              }),
          }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: updateEq,
          is: () => Promise.resolve({ error: null }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          eq: deleteEq,
        }),
      }),
    }),
  }),
}));

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NotificationsPage", () => {
  beforeEach(() => {
    updateEq.mockResolvedValue({ error: null });
    deleteEq.mockResolvedValue({ error: null });
    confirm.mockResolvedValue(true);
  });

  it("marks a notification as read when قراءة is pressed", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("السلام عليكم")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "قراءة" }));

    await waitFor(() => {
      expect(updateEq).toHaveBeenCalled();
    });
  });

  it("deletes a notification after confirm", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("السلام عليكم")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "حذف السلام عليكم" }));

    await waitFor(() => {
      expect(confirm).toHaveBeenCalled();
      expect(deleteEq).toHaveBeenCalled();
    });
  });
});
