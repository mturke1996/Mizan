import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoAuthValue } from "@/features/auth/demo-auth";
import { AppProviders } from "@/app/AppProviders";
import { demoWorkspaceValue } from "@/features/workspace/demo-workspace";
import { demoProjects } from "./project-data";
import { projectStore } from "./project-store";
import { ProjectsPage } from "./ProjectsPage";

describe("ProjectsPage", () => {
  beforeEach(() => {
    projectStore.getState().replaceProjects(demoProjects);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("summarizes active projects and their profit", () => {
    render(
      <MemoryRouter>
        <AppProviders
          authValue={demoAuthValue}
          workspaceValue={demoWorkspaceValue}
        >
          <ProjectsPage />
        </AppProviders>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "المشاريع" }),
    ).toBeInTheDocument();
    expect(screen.getByText("تجارة الصقور")).toBeInTheDocument();
    expect(screen.getByText("مشروع القهوة")).toBeInTheDocument();
    expect(screen.getByText("تربية طيور وعصافير")).toBeInTheDocument();
    expect(screen.getByText("مطعم ومقهى")).toBeInTheDocument();
    expect(screen.getByText("6,380.000")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "إضافة مشروع" }),
    ).toHaveAttribute("href", "/projects/new");
  });

  it("hides worker counts for projects with the workers module disabled", () => {
    projectStore.getState().replaceProjects([
      {
        ...demoProjects[0]!,
        modules: {
          ...demoProjects[0]!.modules,
          workers: false,
        },
        activeWorkers: 5,
        outstandingLaborMinor: 12_000n,
      },
    ]);

    render(
      <MemoryRouter>
        <AppProviders
          authValue={demoAuthValue}
          workspaceValue={demoWorkspaceValue}
        >
          <ProjectsPage />
        </AppProviders>
      </MemoryRouter>,
    );

    expect(screen.queryByText(/عمال/)).not.toBeInTheDocument();
    expect(screen.queryByText("مستحقات عمال معلّقة")).not.toBeInTheDocument();
  });

  it("archives a project from the list after confirmation", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AppProviders
          authValue={demoAuthValue}
          workspaceValue={demoWorkspaceValue}
        >
          <ProjectsPage />
        </AppProviders>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "حذف تجارة الصقور" }));

    expect(window.confirm).toHaveBeenCalledWith(
      "حذف مشروع «تجارة الصقور»؟ سيُزال من القائمة النشطة.",
    );
    expect(screen.queryByText("تجارة الصقور")).not.toBeInTheDocument();
    expect(
      projectStore.getState().projects.find((p) => p.id === "falcon-store")
        ?.status,
    ).toBe("archived");
  });

  it("keeps the project when delete is cancelled", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <MemoryRouter>
        <AppProviders
          authValue={demoAuthValue}
          workspaceValue={demoWorkspaceValue}
        >
          <ProjectsPage />
        </AppProviders>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "حذف تجارة الصقور" }));

    expect(screen.getByText("تجارة الصقور")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list")).getByText("تجارة الصقور"),
    ).toBeInTheDocument();
  });
});
