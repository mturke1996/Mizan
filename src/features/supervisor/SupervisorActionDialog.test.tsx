import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SupervisorActionDialog } from "./SupervisorActionDialog";

function Harness({
  isPending = false,
  tone = "primary" as const,
  initiallyOpen = true,
}: {
  isPending?: boolean;
  tone?: "primary" | "warning" | "danger";
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  return (
    <>
      <p data-testid="confirmed">{confirmed ?? "none"}</p>
      <p data-testid="open">{open ? "open" : "closed"}</p>
      <SupervisorActionDialog
        confirmLabel="تأكيد الإجراء"
        description="سيُطبّق الإجراء على الحساب المحدد."
        isPending={isPending}
        noteRequired
        onConfirm={(note) => setConfirmed(note)}
        onOpenChange={setOpen}
        open={open}
        title="إجراء إداري"
        tone={tone}
      />
    </>
  );
}

describe("SupervisorActionDialog", () => {
  it("does not submit without a note of at least 3 characters", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "تأكيد الإجراء" }));
    expect(screen.getByTestId("confirmed")).toHaveTextContent("none");
    expect(
      screen.getByText("الملاحظة مطلوبة وبحد أدنى 3 أحرف"),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("ملاحظة المدير"), "تم");
    await user.click(screen.getByRole("button", { name: "تأكيد الإجراء" }));
    expect(screen.getByTestId("confirmed")).toHaveTextContent("none");

    await user.type(screen.getByLabelText("ملاحظة المدير"), "م");
    await user.click(screen.getByRole("button", { name: "تأكيد الإجراء" }));
    expect(screen.getByTestId("confirmed")).toHaveTextContent("تمم");
  });

  it("closes on Escape before pending only", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness isPending={false} />);

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.getByTestId("open")).toHaveTextContent("closed");
    });
    unmount();

    render(<Harness isPending />);
    expect(screen.getByTestId("open")).toHaveTextContent("open");
    await user.keyboard("{Escape}");
    expect(screen.getByTestId("open")).toHaveTextContent("open");
    expect(screen.getByRole("button", { name: "إغلاق" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "جارٍ التنفيذ…" })).toBeDisabled();
  });

  it("shows a destructive warning for danger tone", () => {
    render(<Harness tone="danger" />);
    expect(
      screen.getByText(/تحذير: هذا إجراء حسّاس/),
    ).toBeInTheDocument();
  });
});
