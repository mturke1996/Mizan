import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import { AppProviders } from "@/app/AppProviders";
import { demoAuthValue } from "@/features/auth/demo-auth";
import { demoWorkspaceValue } from "@/features/workspace/demo-workspace";
import type { WorkspaceContextValue } from "@/features/workspace/WorkspaceProvider";
import type { ProjectType } from "@/features/workspace/workspace-types";
import {
  PROJECT_BLUEPRINTS,
  PROJECT_TYPES,
} from "./project-blueprints";
import { projectStore } from "./project-store";
import { ProjectFormPage } from "./ProjectFormPage";

const mocks = vi.hoisted(() => ({
  createProject: {
    isPending: false,
    mutateAsync: vi.fn(),
  },
}));

vi.mock("@/features/workspace/use-finance-data", () => ({
  useCreateProjectMutation: () => mocks.createProject,
}));

const liveWorkspaceValue: WorkspaceContextValue = {
  ...demoWorkspaceValue,
  workspaceId: "workspace-1",
  isDemo: false,
};

function ProjectDestination() {
  const { projectId } = useParams();
  return <p>تفاصيل المشروع: {projectId}</p>;
}

function renderWizard(
  workspaceValue: WorkspaceContextValue = demoWorkspaceValue,
) {
  return render(
    <MemoryRouter initialEntries={["/projects/new"]}>
      <AppProviders
        authValue={demoAuthValue}
        workspaceValue={workspaceValue}
      >
        <Routes>
          <Route path="/projects/new" element={<ProjectFormPage />} />
          <Route path="/projects/:projectId" element={<ProjectDestination />} />
          <Route path="/projects" element={<p>قائمة المشاريع</p>} />
        </Routes>
      </AppProviders>
    </MemoryRouter>,
  );
}

async function selectBlueprint(
  user: ReturnType<typeof userEvent.setup>,
  type: ProjectType,
) {
  await user.click(
    screen.getByRole("radio", {
      name: PROJECT_BLUEPRINTS[type].name,
    }),
  );
}

async function reachModules(
  user: ReturnType<typeof userEvent.setup>,
  type: ProjectType,
) {
  await selectBlueprint(user, type);
  await user.click(
    screen.getByRole("button", { name: "التالي: جهّز مشروعك" }),
  );
}

async function reachDetails(
  user: ReturnType<typeof userEvent.setup>,
  type: ProjectType,
) {
  await reachModules(user, type);
  await user.click(
    screen.getByRole("button", { name: "التالي: تفاصيل المشروع" }),
  );
}

async function fillRequiredDetails(
  user: ReturnType<typeof userEvent.setup>,
  name = "مشروع جديد",
  description = "وصف واضح للمشروع",
) {
  await user.type(screen.getByLabelText("اسم المشروع"), name);
  await user.type(screen.getByLabelText("وصف المشروع"), description);
}

describe("ProjectFormPage", () => {
  beforeEach(() => {
    projectStore.getState().replaceProjects([]);
    mocks.createProject.isPending = false;
    mocks.createProject.mutateAsync.mockReset();
    mocks.createProject.mutateAsync.mockResolvedValue({ id: "project-live" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all six catalog blueprints as radios and blocks progress without a choice", () => {
    renderWizard();

    for (const type of PROJECT_TYPES) {
      const blueprint = PROJECT_BLUEPRINTS[type];
      expect(
        screen.getByRole("radio", { name: blueprint.name }),
      ).toBeInTheDocument();
      expect(screen.getByText(blueprint.description)).toBeInTheDocument();
    }

    expect(screen.getAllByRole("radio")).toHaveLength(PROJECT_TYPES.length);
    expect(
      screen.getByRole("button", { name: "التالي: جهّز مشروعك" }),
    ).toBeDisabled();
  });

  it("announces the current and completed steps and keeps route back only on step one", async () => {
    const user = userEvent.setup();
    renderWizard();

    const progress = screen.getByRole("navigation", {
      name: "مراحل إنشاء المشروع",
    });
    expect(
      within(progress).getByRole("listitem", {
        name: "ما نوع مشروعك؟: الحالية",
      }),
    ).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("link", { name: "العودة" })).toHaveAttribute(
      "href",
      "/projects",
    );

    await reachModules(user, "birds");

    expect(
      within(progress).getByRole("listitem", {
        name: "ما نوع مشروعك؟: مكتملة",
      }),
    ).not.toHaveAttribute("aria-current");
    expect(
      within(progress).getByRole("listitem", {
        name: "جهّز مشروعك: الحالية",
      }),
    ).toHaveAttribute("aria-current", "step");
    expect(
      screen.getByRole("button", { name: "الرجوع إلى الخطوة السابقة" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "العودة" })).not.toBeInTheDocument();
  });

  it("focuses each active step heading after navigation without stealing initial focus", async () => {
    const user = userEvent.setup();
    renderWizard();

    const firstHeading = screen.getByRole("heading", {
      name: "ما نوع مشروعك؟",
    });
    expect(firstHeading).toHaveAttribute("tabindex", "-1");
    expect(firstHeading).not.toHaveFocus();
    expect(
      screen.getByRole("region", { name: "ما نوع مشروعك؟" }),
    ).toBeInTheDocument();

    await selectBlueprint(user, "birds");
    await user.click(
      screen.getByRole("button", { name: "التالي: جهّز مشروعك" }),
    );
    const setupHeading = screen.getByRole("heading", {
      name: "جهّز مشروعك",
    });
    await waitFor(() => expect(setupHeading).toHaveFocus());
    expect(
      screen.getByRole("status", {
        name: "حالة تقدم إنشاء المشروع",
      }),
    ).toHaveTextContent("الخطوة 2 من 3: جهّز مشروعك");

    await user.click(
      screen.getByRole("button", { name: "الرجوع إلى الخطوة السابقة" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "ما نوع مشروعك؟" }),
      ).toHaveFocus(),
    );

    await user.click(
      screen.getByRole("button", { name: "التالي: جهّز مشروعك" }),
    );
    await user.click(
      screen.getByRole("button", { name: "التالي: تفاصيل المشروع" }),
    );
    const detailsHeading = screen.getByRole("heading", {
      name: "تفاصيل المشروع",
    });
    await waitFor(() => expect(detailsHeading).toHaveFocus());
    expect(
      screen.getByRole("region", { name: "تفاصيل المشروع" }),
    ).toBeInTheDocument();
  });

  it("applies bird defaults while keeping modules and category chips adjustable", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachModules(user, "birds");

    const transactions = screen.getByRole("checkbox", {
      name: "وحدة المعاملات",
    });
    const goal = screen.getByRole("checkbox", { name: "وحدة الهدف" });
    const workers = screen.getByRole("checkbox", { name: "وحدة العمال" });
    const capital = screen.getByRole("checkbox", {
      name: "وحدة رأس المال",
    });
    const inventory = screen.getByRole("checkbox", {
      name: "وحدة المخزون",
    });

    expect(transactions).toBeChecked();
    expect(transactions).toBeDisabled();
    expect(goal).not.toBeChecked();
    expect(workers).toBeChecked();
    expect(capital).toBeChecked();
    expect(inventory).toBeChecked();

    await user.click(goal);
    await user.click(inventory);
    expect(goal).toBeChecked();
    expect(inventory).not.toBeChecked();

    for (const category of PROJECT_BLUEPRINTS.birds.suggestedCategories) {
      const kind = category.kind === "income" ? "دخل" : "مصروف";
      expect(
        screen.getByRole("checkbox", {
          name: `تصنيف ${kind}: ${category.name}`,
        }),
      ).toBeChecked();
    }

    const feed = screen.getByRole("checkbox", {
      name: "تصنيف مصروف: علف",
    });
    await user.click(feed);
    expect(feed).not.toBeChecked();
    await user.click(feed);
    expect(feed).toBeChecked();
  });

  it("uses inward negative translations for module switch thumbs in RTL", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachModules(user, "birds");

    const thumbFor = (control: HTMLElement) => {
      const thumb =
        control.nextElementSibling?.querySelector<HTMLElement>(
          '[aria-hidden="true"] > span',
        ) ?? null;
      expect(thumb).not.toBeNull();
      return thumb!;
    };
    const transactions = screen.getByRole("checkbox", {
      name: "وحدة المعاملات",
    });
    const goal = screen.getByRole("checkbox", { name: "وحدة الهدف" });

    expect(thumbFor(transactions)).toHaveClass("-translate-x-6");
    expect(thumbFor(transactions)).not.toHaveClass("translate-x-6");
    expect(thumbFor(goal)).toHaveClass("-translate-x-0.5");
    expect(thumbFor(goal)).not.toHaveClass("translate-x-0.5");

    await user.click(goal);
    expect(thumbFor(goal)).toHaveClass("-translate-x-6");
  });

  it("uses the semantic control border without darkening decorative dividers", async () => {
    const user = userEvent.setup();
    renderWizard();

    const progress = screen.getByRole("navigation", {
      name: "مراحل إنشاء المشروع",
    });
    expect(progress).toHaveClass("border-line");
    expect(progress).not.toHaveClass("border-control-border");
    expect(
      screen.getByRole("radio", {
        name: PROJECT_BLUEPRINTS.birds.name,
      }).nextElementSibling,
    ).toHaveClass("border-control-border");

    await reachModules(user, "birds");
    const goal = screen.getByRole("checkbox", { name: "وحدة الهدف" });
    const goalCard = goal.nextElementSibling;
    const goalTrack =
      goalCard?.querySelector<HTMLElement>('[aria-hidden="true"]') ?? null;
    expect(goalCard).toHaveClass("border-control-border");
    expect(goalTrack).toHaveClass("border-control-border");
    const feed = screen.getByRole("checkbox", {
      name: "تصنيف مصروف: علف",
    });
    await user.click(feed);
    expect(feed.nextElementSibling).toHaveClass("border-control-border");

    await user.click(
      screen.getByRole("button", { name: "التالي: تفاصيل المشروع" }),
    );
    expect(screen.getByLabelText("اسم المشروع")).toHaveClass(
      "border-control-border",
    );
    expect(screen.getByLabelText("وصف المشروع")).toHaveClass(
      "border-control-border",
    );
    expect(
      screen.getByRole("radio", { name: "أخضر" }).nextElementSibling,
    ).toHaveClass("border-control-border");
  });

  it("preserves custom modules, categories, and details across back and forward navigation", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachModules(user, "birds");

    await user.click(screen.getByRole("checkbox", { name: "وحدة الهدف" }));
    await user.click(
      screen.getByRole("checkbox", { name: "تصنيف مصروف: علف" }),
    );
    await user.click(
      screen.getByRole("button", { name: "التالي: تفاصيل المشروع" }),
    );
    await user.type(screen.getByLabelText("اسم المشروع"), "طيور الساحل");

    await user.click(
      screen.getByRole("button", { name: "الرجوع إلى الخطوة السابقة" }),
    );
    expect(screen.getByRole("checkbox", { name: "وحدة الهدف" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "تصنيف مصروف: علف" }),
    ).not.toBeChecked();

    await user.click(
      screen.getByRole("button", { name: "الرجوع إلى الخطوة السابقة" }),
    );
    expect(
      screen.getByRole("radio", {
        name: PROJECT_BLUEPRINTS.birds.name,
      }),
    ).toBeChecked();
    await user.click(
      screen.getByRole("button", { name: "التالي: جهّز مشروعك" }),
    );

    expect(screen.getByRole("checkbox", { name: "وحدة الهدف" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "تصنيف مصروف: علف" }),
    ).not.toBeChecked();
    await user.click(
      screen.getByRole("button", { name: "التالي: تفاصيل المشروع" }),
    );
    expect(screen.getByLabelText("اسم المشروع")).toHaveValue("طيور الساحل");
  });

  it("resets configuration to catalog defaults only after selecting another blueprint", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachModules(user, "birds");

    await user.click(screen.getByRole("checkbox", { name: "وحدة الهدف" }));
    await user.click(screen.getByRole("checkbox", { name: "وحدة المخزون" }));
    await user.click(
      screen.getByRole("checkbox", { name: "تصنيف مصروف: علف" }),
    );
    await user.click(
      screen.getByRole("button", { name: "الرجوع إلى الخطوة السابقة" }),
    );
    await selectBlueprint(user, "goods");
    await user.click(
      screen.getByRole("button", { name: "التالي: جهّز مشروعك" }),
    );

    expect(screen.getByRole("checkbox", { name: "وحدة الهدف" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "وحدة المخزون" })).toBeChecked();
    expect(
      screen.queryByRole("checkbox", { name: "تصنيف مصروف: علف" }),
    ).not.toBeInTheDocument();
    for (const category of PROJECT_BLUEPRINTS.goods.suggestedCategories) {
      const kind = category.kind === "income" ? "دخل" : "مصروف";
      expect(
        screen.getByRole("checkbox", {
          name: `تصنيف ${kind}: ${category.name}`,
        }),
      ).toBeChecked();
    }
  });

  it("directs general projects when there are no suggested categories", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachModules(user, "general");

    expect(
      screen.getByRole("heading", {
        name: "لا توجد تصنيفات مقترحة",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/أضف تصنيفات الدخل والمصروف من صفحة المعاملات/),
    ).toBeInTheDocument();
  });

  it("validates required details and only validates enabled financial fields", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachDetails(user, "services");

    expect(screen.getByLabelText("هدف الإيرادات")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("رأس المال الافتتاحي"),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "إنشاء المشروع" }));
    expect(screen.getByLabelText("اسم المشروع")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("وصف المشروع")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    await fillRequiredDetails(user);
    await user.type(screen.getByLabelText("هدف الإيرادات"), "0");
    await user.click(screen.getByRole("button", { name: "إنشاء المشروع" }));
    expect(screen.getByLabelText("هدف الإيرادات")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(projectStore.getState().projects).toHaveLength(0);
  });

  it(
    "enforces backend-aligned name and description boundaries",
    async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachDetails(user, "general");

    const name = screen.getByLabelText("اسم المشروع");
    const description = screen.getByLabelText("وصف المشروع");
    expect(name).toHaveAttribute("maxlength", "160");
    expect(description).toHaveAttribute("maxlength", "500");

    fireEvent.change(name, { target: { value: "م".repeat(161) } });
    fireEvent.change(description, { target: { value: "و".repeat(501) } });
    await user.click(screen.getByRole("button", { name: "إنشاء المشروع" }));

    expect(
      screen.getByText("يجب ألا يتجاوز اسم المشروع 160 حرفًا"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("يجب ألا يتجاوز وصف المشروع 500 حرف"),
    ).toBeInTheDocument();
    expect(projectStore.getState().projects).toHaveLength(0);

    fireEvent.change(name, { target: { value: "م".repeat(160) } });
    fireEvent.change(description, { target: { value: "و".repeat(500) } });
    await user.click(screen.getByRole("button", { name: "إنشاء المشروع" }));

    expect(await screen.findByText(/تفاصيل المشروع:/)).toBeInTheDocument();
    expect(projectStore.getState().projects[0]?.name).toHaveLength(160);
    expect(projectStore.getState().projects[0]?.description).toHaveLength(500);
  },
    15_000,
  );

  it(
    "requires a positive safe opening capital only when capital is enabled",
    async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachDetails(user, "birds");
    await fillRequiredDetails(user);

    expect(screen.getByLabelText("رأس المال الافتتاحي")).toBeInTheDocument();
    expect(screen.queryByLabelText("هدف الإيرادات")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("رأس المال الافتتاحي"), "0");
    await user.click(screen.getByRole("button", { name: "إنشاء المشروع" }));
    expect(screen.getByLabelText("رأس المال الافتتاحي")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    await user.clear(screen.getByLabelText("رأس المال الافتتاحي"));
    await user.type(
      screen.getByLabelText("رأس المال الافتتاحي"),
      "9007199254741.000",
    );
    await user.click(screen.getByRole("button", { name: "إنشاء المشروع" }));
    expect(
      screen.getByText("المبلغ أكبر من الحد الآمن للحفظ"),
    ).toBeInTheDocument();
    expect(projectStore.getState().projects).toHaveLength(0);
  },
    15_000,
  );

  it("excludes stale goal and capital values after their modules are disabled", async () => {
    const user = userEvent.setup();
    renderWizard();
    await reachModules(user, "birds");
    await user.click(screen.getByRole("checkbox", { name: "وحدة الهدف" }));
    await user.click(
      screen.getByRole("button", { name: "التالي: تفاصيل المشروع" }),
    );
    await fillRequiredDetails(user);
    await user.type(screen.getByLabelText("هدف الإيرادات"), "100");
    await user.type(screen.getByLabelText("رأس المال الافتتاحي"), "50");

    await user.click(
      screen.getByRole("button", { name: "الرجوع إلى الخطوة السابقة" }),
    );
    await user.click(screen.getByRole("checkbox", { name: "وحدة الهدف" }));
    await user.click(screen.getByRole("checkbox", { name: "وحدة رأس المال" }));
    await user.click(
      screen.getByRole("button", { name: "التالي: تفاصيل المشروع" }),
    );

    expect(screen.queryByLabelText("هدف الإيرادات")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("رأس المال الافتتاحي"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "إنشاء المشروع" }));

    await screen.findByText(/تفاصيل المشروع:/);
    const created = projectStore.getState().projects[0];
    expect(created?.goalMinor).toBeUndefined();
    expect(created?.capitalMinor).toBe(0n);
    expect(created?.modules.goal).toBe(false);
    expect(created?.modules.capital).toBe(false);
  });

  it("submits the exact enhanced live payload and redirects to the returned project", async () => {
    const user = userEvent.setup();
    const clientId = "00000000-0000-4000-8000-000000000005";
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(clientId);
    mocks.createProject.mutateAsync.mockResolvedValue({ id: "project-55" });
    renderWizard(liveWorkspaceValue);
    await reachModules(user, "birds");

    await user.click(screen.getByRole("checkbox", { name: "وحدة الهدف" }));
    await user.click(screen.getByRole("checkbox", { name: "وحدة المخزون" }));
    await user.click(
      screen.getByRole("checkbox", {
        name: "تصنيف مصروف: أقفاص وتجهيزات",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "التالي: تفاصيل المشروع" }),
    );
    await fillRequiredDetails(user, "طيور الساحل", "متابعة القطيع والتكاليف");
    await user.click(screen.getByRole("radio", { name: "أخضر" }));
    await user.type(screen.getByLabelText("هدف الإيرادات"), "250.000");
    await user.type(screen.getByLabelText("رأس المال الافتتاحي"), "75.500");
    await user.click(screen.getByRole("button", { name: "إنشاء المشروع" }));

    expect(
      await screen.findByText("تفاصيل المشروع: project-55"),
    ).toBeInTheDocument();
    expect(mocks.createProject.mutateAsync).toHaveBeenCalledWith({
      name: "طيور الساحل",
      description: "متابعة القطيع والتكاليف",
      colorToken: "success",
      projectType: "birds",
      modules: {
        transactions: true,
        goal: true,
        workers: true,
        capital: true,
        inventory: false,
        livestock: true,
      },
      seedCategories: PROJECT_BLUEPRINTS.birds.suggestedCategories
        .filter((category) => category.name !== "أقفاص وتجهيزات")
        .map((category) => ({ ...category })),
      goalMinor: 250_000,
      openingCapitalMinor: 75_500,
      clientId,
    });
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(1);
  });

  it("reuses the client id when an identical live payload is retried", async () => {
    const user = userEvent.setup();
    const firstId = "00000000-0000-4000-8000-000000000011";
    const rotatedId = "00000000-0000-4000-8000-000000000012";
    const uuid = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce(firstId)
      .mockReturnValueOnce(rotatedId);
    mocks.createProject.mutateAsync
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ id: "project-retried" });
    renderWizard(liveWorkspaceValue);
    await reachDetails(user, "general");
    await fillRequiredDetails(user);

    await user.click(screen.getByRole("button", { name: "إنشاء المشروع" }));
    await waitFor(() =>
      expect(mocks.createProject.mutateAsync).toHaveBeenCalledTimes(1),
    );
    await screen.findByText(
      "تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة",
    );
    await user.click(screen.getByRole("button", { name: "إنشاء المشروع" }));

    expect(
      await screen.findByText("تفاصيل المشروع: project-retried"),
    ).toBeInTheDocument();
    expect(
      mocks.createProject.mutateAsync.mock.calls.map(
        ([payload]) => payload.clientId,
      ),
    ).toEqual([firstId, firstId]);
    expect(uuid).toHaveBeenCalledTimes(1);
  });

  it("rotates the client id when the failed live payload changes", async () => {
    const user = userEvent.setup();
    const firstId = "00000000-0000-4000-8000-000000000013";
    const secondId = "00000000-0000-4000-8000-000000000014";
    const uuid = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce(firstId)
      .mockReturnValueOnce(secondId);
    mocks.createProject.mutateAsync
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ id: "project-changed" });
    renderWizard(liveWorkspaceValue);
    await reachDetails(user, "general");
    await fillRequiredDetails(user);

    await user.click(screen.getByRole("button", { name: "إنشاء المشروع" }));
    await waitFor(() =>
      expect(mocks.createProject.mutateAsync).toHaveBeenCalledTimes(1),
    );
    await user.type(screen.getByLabelText("اسم المشروع"), " محدث");
    await user.click(screen.getByRole("button", { name: "إنشاء المشروع" }));

    expect(
      await screen.findByText("تفاصيل المشروع: project-changed"),
    ).toBeInTheDocument();
    expect(
      mocks.createProject.mutateAsync.mock.calls.map(
        ([payload]) => payload.clientId,
      ),
    ).toEqual([firstId, secondId]);
    expect(uuid).toHaveBeenCalledTimes(2);
  });

  it("falls back to the projects list when the live response has no id", async () => {
    const user = userEvent.setup();
    mocks.createProject.mutateAsync.mockResolvedValue({ id: null });
    renderWizard(liveWorkspaceValue);
    await reachDetails(user, "general");
    await fillRequiredDetails(user);

    await user.click(screen.getByRole("button", { name: "إنشاء المشروع" }));

    expect(await screen.findByText("قائمة المشاريع")).toBeInTheDocument();
  });

  it("adds a fully populated demo summary and redirects directly to its detail", async () => {
    const user = userEvent.setup();
    const projectId = "00000000-0000-4000-8000-000000000006";
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(projectId);
    renderWizard();
    await reachModules(user, "birds");
    await user.click(screen.getByRole("checkbox", { name: "وحدة الهدف" }));
    await user.click(
      screen.getByRole("button", { name: "التالي: تفاصيل المشروع" }),
    );
    await fillRequiredDetails(user, "مزرعة النورس", "تربية الطيور وبيع الإنتاج");
    await user.click(screen.getByRole("radio", { name: "ذهبي" }));
    await user.type(screen.getByLabelText("هدف الإيرادات"), "100.000");
    await user.type(screen.getByLabelText("رأس المال الافتتاحي"), "50.000");
    await user.click(screen.getByRole("button", { name: "إنشاء المشروع" }));

    expect(
      await screen.findByText(`تفاصيل المشروع: ${projectId}`),
    ).toBeInTheDocument();
    expect(projectStore.getState().projects[0]).toEqual({
      id: projectId,
      name: "مزرعة النورس",
      description: "تربية الطيور وبيع الإنتاج",
      status: "active",
      projectType: "birds",
      modules: {
        transactions: true,
        goal: true,
        workers: true,
        capital: true,
        inventory: true,
        livestock: true,
      },
      incomeMinor: 0n,
      expenseMinor: 0n,
      profitMinor: 0n,
      goalMinor: 100_000n,
      progress: 0,
      mark: "م",
      tone: "bg-warning-soft text-warning",
      colorToken: "warning",
      outstandingLaborMinor: 0n,
      activeWorkers: 0,
      capitalMinor: 50_000n,
      capitalRecoveredRate: 0,
      inventoryValueMinor: 0n,
      inventoryItemCount: 0,
    });
  });

  it("locks one live submit intent and shows a single pending state", async () => {
    const user = userEvent.setup();
    const clientId = "00000000-0000-4000-8000-000000000007";
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(clientId);
    let resolveMutation:
      | ((value: { id: string | null }) => void)
      | undefined;
    mocks.createProject.mutateAsync.mockImplementation(
      () =>
        new Promise<{ id: string | null }>((resolve) => {
          resolveMutation = resolve;
        }),
    );
    renderWizard(liveWorkspaceValue);
    await reachDetails(user, "general");
    await fillRequiredDetails(user);

    const submit = screen.getByRole("button", { name: "إنشاء المشروع" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => {
      expect(mocks.createProject.mutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByRole("button", { name: "جارٍ إنشاء المشروع..." }),
    ).toBeDisabled();
    expect(globalThis.crypto.randomUUID).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveMutation?.({ id: "project-once" });
    });
    expect(
      await screen.findByText("تفاصيل المشروع: project-once"),
    ).toBeInTheDocument();
  });

  it("shows an Arabic toast when live creation fails", async () => {
    const user = userEvent.setup();
    mocks.createProject.mutateAsync.mockRejectedValue(new Error("network down"));
    renderWizard(liveWorkspaceValue);
    await reachDetails(user, "general");
    await fillRequiredDetails(user);

    await user.click(screen.getByRole("button", { name: "إنشاء المشروع" }));

    expect(
      await screen.findByText(
        "تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة",
      ),
    ).toBeInTheDocument();
  });
});
