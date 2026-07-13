import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { AdminPlan, CreateCustomerInput } from "./customer-admin-types";
import { CreateCustomerDialog } from "./CreateCustomerDialog";

const PLAN_ID = "11111111-1111-4111-8111-111111111111";

const plans: AdminPlan[] = [
  {
    planId: PLAN_ID,
    code: "trial",
    name: "تجريبي",
    priceMinor: 0,
    currencyCode: "LYD",
    billingInterval: "none",
    intervalCount: null,
    trialDays: 14,
    isPublic: true,
    isActive: true,
    features: { manual_payment: true },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    subscriptionCounts: {
      trialing: 0,
      active: 0,
      grace: 0,
      frozen: 0,
      expired: 0,
      cancelled: 0,
    },
  },
];

function Harness({
  onCreate,
  failOnce = false,
}: {
  onCreate?: (input: CreateCustomerInput) => Promise<{
    userId: string;
    temporaryPassword: string | null;
  }>;
  failOnce?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [attempts, setAttempts] = useState(0);
  const create =
    onCreate ??
    (async (input: CreateCustomerInput) => {
      setAttempts((count) => count + 1);
      if (failOnce && attempts === 0) {
        throw new Error("فشل مؤقت");
      }
      return {
        userId: "user-1",
        temporaryPassword:
          input.deliveryMode === "temporary_password" ? "M!z9-once" : null,
      };
    });

  return (
    <>
      <p data-testid="attempts">{attempts}</p>
      <CreateCustomerDialog
        onCreate={create}
        onOpenChange={setOpen}
        open={open}
        plans={plans}
      />
    </>
  );
}

async function fillThroughReview(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("البريد الإلكتروني"), "a@example.com");
  await user.type(screen.getByLabelText("الاسم الظاهر"), "أحمد");
  await user.click(screen.getByRole("button", { name: "التالي" }));

  await user.type(screen.getByLabelText("اسم المساحة"), "مساحة أحمد");
  await user.click(screen.getByRole("button", { name: "التالي" }));

  expect(screen.getByText(/خطوة 3 من 5: الاشتراك/)).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "التالي" }));

  await user.click(screen.getByLabelText("كلمة مرور مؤقتة"));
  await user.click(screen.getByRole("button", { name: "التالي" }));

  expect(screen.getByText(/خطوة 5 من 5: المراجعة/)).toBeInTheDocument();
  await user.type(screen.getByLabelText("ملاحظة المدير"), "إنشاء حساب تجريبي");
}

describe("CreateCustomerDialog", () => {
  it("walks identity → workspace → subscription → delivery → review", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByText(/خطوة 1 من 5: الهوية/)).toBeInTheDocument();
    await fillThroughReview(user);
    expect(screen.getByText(/خطوة 5 من 5: المراجعة/)).toBeInTheDocument();
    expect(screen.getByText("a@example.com")).toBeInTheDocument();
  });

  it("keeps the same clientId across retry", async () => {
    const user = userEvent.setup();
    const clientIds: string[] = [];

    render(
      <Harness
        failOnce
        onCreate={async (input) => {
          clientIds.push(input.clientId);
          if (clientIds.length === 1) {
            throw new Error("فشل مؤقت");
          }
          return { userId: "user-1", temporaryPassword: "M!z9-once" };
        }}
      />,
    );

    await fillThroughReview(user);
    const firstClientId = screen.getByTestId("client-id").textContent;

    await user.click(screen.getByRole("button", { name: "إنشاء العميل" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("فشل مؤقت");
    });

    expect(screen.getByTestId("client-id").textContent).toBe(firstClientId);

    await user.click(screen.getByRole("button", { name: "إنشاء العميل" }));
    await waitFor(() => {
      expect(screen.getByText("تم إنشاء العميل")).toBeInTheDocument();
    });

    expect(clientIds).toHaveLength(2);
    expect(clientIds[0]).toBe(clientIds[1]);
    expect(clientIds[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("shows temporary password once then clears it on close", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness />);

    await fillThroughReview(user);
    await user.click(screen.getByRole("button", { name: "إنشاء العميل" }));

    await waitFor(() => {
      expect(screen.getByTestId("temporary-password")).toHaveTextContent(
        "M!z9-once",
      );
    });

    await user.click(screen.getByRole("button", { name: "إغلاق" }));

    rerender(
      <CreateCustomerDialog
        onCreate={async () => ({
          userId: "user-2",
          temporaryPassword: null,
        })}
        onOpenChange={() => undefined}
        open
        plans={plans}
      />,
    );

    expect(screen.queryByTestId("temporary-password")).not.toBeInTheDocument();
    expect(screen.getByText(/خطوة 1 من 5: الهوية/)).toBeInTheDocument();
  });
});
