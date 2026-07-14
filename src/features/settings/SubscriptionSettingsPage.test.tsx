import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppProviders } from "@/app/AppProviders";
import { demoAuthValue } from "@/features/auth/demo-auth";
import type { WorkspaceContextValue } from "@/features/workspace/WorkspaceProvider";
import { SubscriptionSettingsPage } from "./SubscriptionSettingsPage";
import {
  createPaymentRequestWithProof,
  fetchSubscriptionSummary,
} from "./settings-api";

vi.mock("./settings-api", () => ({
  attachPaymentProof: vi.fn(),
  createPaymentRequestWithProof: vi.fn(),
  fetchSubscriptionSummary: vi.fn(),
  validatePaymentProof: vi.fn(() => null),
}));

const workspaceValue: WorkspaceContextValue = {
  membership: {
    workspaceId: "workspace-1",
    workspaceName: "مساحة محمد",
    currency: "LYD",
    role: "owner",
    brand: {
      legalName: null,
      phone: null,
      address: null,
      taxId: null,
      invoiceFooter: null,
      logoPath: null,
      logoUrl: null,
    },
  },
  workspaceId: "workspace-1",
  currency: "LYD",
  isLoading: false,
  error: null,
  refresh: async () => undefined,
};

describe("SubscriptionSettingsPage", () => {
  beforeEach(() => {
    vi.mocked(fetchSubscriptionSummary).mockReset();
    vi.mocked(createPaymentRequestWithProof).mockReset();
    vi.mocked(fetchSubscriptionSummary).mockResolvedValue({
      subscription: {
        id: "subscription-1",
        workspace_id: "workspace-1",
        plan_id: "trial-plan",
        status: "trialing",
        starts_at: "2026-07-13T00:00:00.000Z",
        trial_ends_at: "2026-07-27T00:00:00.000Z",
        current_period_ends_at: null,
        grace_ends_at: null,
        frozen_at: null,
        expired_at: null,
        cancelled_at: null,
        created_at: "2026-07-13T00:00:00.000Z",
        updated_at: "2026-07-13T00:00:00.000Z",
      },
      currentPlan: null,
      availablePlans: [
        {
          id: "monthly-plan",
          code: "monthly",
          name: "Monthly",
          price_minor: 15_000,
          currency_code: "LYD",
          billing_interval: "monthly",
          interval_count: 1,
          features: {},
        },
      ],
      requests: [],
    });
    vi.mocked(createPaymentRequestWithProof).mockResolvedValue("request-1");
  });

  it("shows the real subscription state and submits proof with a request", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppProviders
          authValue={demoAuthValue}
          workspaceValue={workspaceValue}
        >
          <SubscriptionSettingsPage />
        </AppProviders>
      </MemoryRouter>,
    );

    expect(await screen.findByText("الفترة التجريبية")).toBeInTheDocument();
    expect(screen.getByText("تجريبي")).toBeInTheDocument();
    expect(screen.getByText(/خطة شهرية/)).toBeInTheDocument();

    const proof = new File(["proof"], "proof.png", { type: "image/png" });
    await user.upload(screen.getByLabelText(/اختيار JPG/), proof);
    const submit = screen.getByRole("button", {
      name: "إرسال الطلب للمراجعة",
    });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    await waitFor(() =>
      expect(createPaymentRequestWithProof).toHaveBeenCalledWith({
        workspaceId: "workspace-1",
        planId: "monthly-plan",
        periodCount: 1,
        note: "",
        file: proof,
      }),
    );
  });
});
