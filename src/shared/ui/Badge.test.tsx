import { render, screen, within } from "@testing-library/react";

import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders a labeled semantic badge with an optional icon and tone classes", () => {
    render(
      <Badge
        className="custom-badge"
        icon={<svg data-testid="badge-icon" />}
        tone="success"
      >
        مكتمل
      </Badge>,
    );

    const badge = screen.getByText("مكتمل");

    expect(badge.tagName).toBe("SPAN");
    expect(badge).toHaveClass(
      "bg-success-soft",
      "text-success",
      "custom-badge",
    );
    expect(
      within(badge).getByTestId("badge-icon").parentElement,
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("maps tones to token classes with high-contrast danger and info text", () => {
    const tones = {
      primary: ["bg-primary-soft", "text-primary-ink"],
      success: ["bg-success-soft", "text-success"],
      warning: ["bg-warning-soft", "text-warning"],
      danger: ["bg-danger-soft", "text-ink"],
      info: ["bg-info-soft", "text-ink"],
      neutral: ["bg-surface-subtle", "text-muted", "border-line"],
    } as const;

    render(
      <>
        {Object.keys(tones).map((tone) => (
          <Badge key={tone} tone={tone as keyof typeof tones}>
            {tone}
          </Badge>
        ))}
      </>,
    );

    for (const [tone, classes] of Object.entries(tones)) {
      expect(screen.getByText(tone)).toHaveClass(...classes);
    }
    expect(screen.getByText("danger")).not.toHaveClass("text-danger");
    expect(screen.getByText("info")).not.toHaveClass("text-info");
  });
});
