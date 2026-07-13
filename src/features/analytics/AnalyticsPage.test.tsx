import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProviders } from "@/app/AppProviders";
import { demoAuthValue } from "@/features/auth/demo-auth";
import { demoWorkspaceValue } from "@/features/workspace/demo-workspace";
import { AnalyticsPage } from "./AnalyticsPage";

describe("AnalyticsPage", () => {
  it("presents analytics shell with real-data metrics", () => {
    render(
      <MemoryRouter>
        <AppProviders
          authValue={demoAuthValue}
          workspaceValue={demoWorkspaceValue}
        >
          <AnalyticsPage />
        </AppProviders>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "التحليلات" }),
    ).toBeInTheDocument();
    expect(screen.getByText("معدل الادخار")).toBeInTheDocument();
    expect(screen.getByText("0.0%")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "اتجاه الدخل والمصروف" }),
    ).toBeInTheDocument();
    expect(screen.getByText("توزيع المصروفات")).toBeInTheDocument();
  });
});
