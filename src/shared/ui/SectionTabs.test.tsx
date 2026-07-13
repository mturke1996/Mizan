import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { SectionTabs } from "./SectionTabs";
import {
  getSectionTabId,
  getSectionTabPanelId,
} from "./section-tabs-ids";
import { resolveActiveTabId } from "./section-tabs-utils";

const items = [
  {
    id: "overview",
    label: "الملخص",
    icon: <svg data-testid="overview-icon" />,
  },
  { id: "payments", label: "المدفوعات", badge: <span>3</span> },
  { id: "history", label: "السجل", disabled: true },
  { id: "settings", label: "الإعدادات" },
] as const;

describe("SectionTabs", () => {
  it("renders linked controlled tabs and selects enabled tabs on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SectionTabs
        activeId="overview"
        ariaLabel="أقسام العميل"
        dir="rtl"
        id="customer-sections"
        items={items}
        onChange={onChange}
      />,
    );

    const tablist = screen.getByRole("tablist", { name: "أقسام العميل" });
    const overview = screen.getByRole("tab", { name: "الملخص" });
    const payments = screen.getByRole("tab", { name: "المدفوعات 3" });
    const history = screen.getByRole("tab", { name: "السجل" });

    expect(tablist).toHaveAttribute("dir", "rtl");
    expect(tablist).toHaveClass("overflow-x-auto");
    expect(overview).toHaveAttribute(
      "id",
      getSectionTabId("customer-sections", "overview"),
    );
    expect(overview).toHaveAttribute(
      "aria-controls",
      getSectionTabPanelId("customer-sections", "overview"),
    );
    expect(overview).toHaveAttribute("aria-selected", "true");
    expect(overview).toHaveAttribute("tabindex", "0");
    expect(overview).toHaveClass("bg-surface", "focus-visible:outline-primary");
    expect(
      within(overview).getByTestId("overview-icon").parentElement,
    ).toHaveAttribute("aria-hidden", "true");
    expect(history).toBeDisabled();
    expect(history).toHaveAttribute("aria-disabled", "true");

    await user.click(payments);
    expect(onChange).toHaveBeenCalledWith("payments");
  });

  it("moves focus and selection in the visual RTL arrow direction", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SectionTabs
        activeId="overview"
        ariaLabel="أقسام العميل"
        dir="rtl"
        id="customer-sections"
        items={items}
        onChange={onChange}
      />,
    );

    const overview = screen.getByRole("tab", { name: "الملخص" });
    const payments = screen.getByRole("tab", { name: "المدفوعات 3" });
    const settings = screen.getByRole("tab", { name: "الإعدادات" });

    overview.focus();
    await user.keyboard("{ArrowLeft}");

    expect(payments).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("payments");

    overview.focus();
    await user.keyboard("{ArrowRight}");

    expect(settings).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("settings");
  });

  it("skips disabled tabs and supports Home and End keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SectionTabs
        activeId="payments"
        ariaLabel="أقسام العميل"
        dir="rtl"
        id="customer-sections"
        items={items}
        onChange={onChange}
      />,
    );

    const overview = screen.getByRole("tab", { name: "الملخص" });
    const payments = screen.getByRole("tab", { name: "المدفوعات 3" });
    const history = screen.getByRole("tab", { name: "السجل" });
    const settings = screen.getByRole("tab", { name: "الإعدادات" });

    payments.focus();
    await user.keyboard("{ArrowLeft}");
    expect(settings).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("settings");

    payments.focus();
    await user.keyboard("{Home}");
    expect(overview).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("overview");

    overview.focus();
    await user.keyboard("{End}");
    expect(settings).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith("settings");

    onChange.mockClear();
    await user.click(history);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders a numeric zero badge", () => {
    render(
      <SectionTabs
        activeId="notifications"
        ariaLabel="أقسام التنبيهات"
        items={[{ id: "notifications", label: "الإشعارات", badge: 0 }]}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("tab", { name: "الإشعارات 0" }),
    ).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("throws for disabled or missing active IDs without notifying onChange", () => {
    for (const activeId of ["history", "missing"]) {
      const onChange = vi.fn();

      expect(() =>
        render(
          <SectionTabs
            activeId={activeId}
            ariaLabel="أقسام العميل"
            items={items}
            onChange={onChange}
          />,
        ),
      ).toThrow(/resolveActiveTabId/);
      expect(onChange).not.toHaveBeenCalled();
    }
  });

  it("does not call unstable no-op callbacks during render or rerender", () => {
    const onChange = vi.fn();

    function Harness({ revision }: { revision: number }) {
      return (
        <SectionTabs
          activeId="overview"
          ariaLabel={`أقسام العميل ${revision}`}
          items={items}
          onChange={() => onChange()}
        />
      );
    }

    const { rerender } = render(<Harness revision={1} />);
    rerender(<Harness revision={2} />);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders an all-disabled list with no selection or tab stop", () => {
    const disabledItems = [
      { id: "one", label: "الأول", disabled: true },
      { id: "two", label: "الثاني", disabled: true },
    ] as const;
    const activeId = resolveActiveTabId(disabledItems, "one");

    render(
      <SectionTabs
        activeId={activeId}
        ariaLabel="أقسام غير متاحة"
        items={disabledItems}
        onChange={vi.fn()}
      />,
    );

    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toBeDisabled();
      expect(tab).toHaveAttribute("aria-selected", "false");
      expect(tab).toHaveAttribute("tabindex", "-1");
    }
  });

  it("keeps controlled tabs and caller-owned panels on the resolved ID", async () => {
    const user = userEvent.setup();

    function StatefulTabsOwner() {
      const [requestedId, setRequestedId] = useState<string>("history");
      const activeId = resolveActiveTabId<string>(items, requestedId);

      return (
        <>
          <SectionTabs
            activeId={activeId}
            ariaLabel="أقسام العميل"
            id="customer-sections"
            items={items}
            onChange={setRequestedId}
          />
          {items
            .filter((item) => !("disabled" in item && item.disabled))
            .map((item) => (
              <section
                aria-labelledby={getSectionTabId("customer-sections", item.id)}
                hidden={item.id !== activeId}
                id={getSectionTabPanelId("customer-sections", item.id)}
                key={item.id}
                role="tabpanel"
              >
                لوحة {item.label}
              </section>
            ))}
        </>
      );
    }

    render(<StatefulTabsOwner />);

    const overview = screen.getByRole("tab", { name: "الملخص" });
    const payments = screen.getByRole("tab", { name: "المدفوعات 3" });
    const overviewPanel = screen.getByRole("tabpanel", { name: "الملخص" });

    expect(overview).toHaveAttribute("aria-selected", "true");
    expect(overview).toHaveAttribute("tabindex", "0");
    expect(overview).toHaveAttribute("aria-controls", overviewPanel.id);

    await user.click(payments);

    const paymentsPanel = screen.getByRole("tabpanel", {
      name: "المدفوعات 3",
    });
    expect(payments).toHaveAttribute("aria-selected", "true");
    expect(payments).toHaveAttribute("tabindex", "0");
    expect(payments).toHaveAttribute("aria-controls", paymentsPanel.id);
    expect(overviewPanel).not.toBeVisible();
  });
});
