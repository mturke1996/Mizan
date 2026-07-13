import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PwaUpdatePrompt } from "./PwaUpdatePrompt";

describe("PwaUpdatePrompt", () => {
  it("offers an explicit update action when a new version is ready", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(
      <PwaUpdatePrompt
        needRefresh
        onUpdate={onUpdate}
        onDismiss={() => undefined}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "يتوفر تحديث جديد لميزان",
    );

    await user.click(
      screen.getByRole("button", { name: "تحديث التطبيق الآن" }),
    );

    expect(onUpdate).toHaveBeenCalledOnce();
  });

  it("renders nothing when no update is waiting", () => {
    const { container } = render(
      <PwaUpdatePrompt
        needRefresh={false}
        onUpdate={() => undefined}
        onDismiss={() => undefined}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
