import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SupervisorRevenuePage } from "./SupervisorRevenuePage";

const fetchRevenueSeries = vi.fn();

vi.mock("./supervisor-intelligence-api", async () => {
  const actual = await vi.importActual<
    typeof import("./supervisor-intelligence-api")
  >("./supervisor-intelligence-api");
  return {
    ...actual,
    fetchRevenueSeries: (...args: unknown[]) => fetchRevenueSeries(...args),
  };
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SupervisorRevenuePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SupervisorRevenuePage", () => {
  beforeEach(() => {
    fetchRevenueSeries.mockResolvedValue([
      {
        bucketStart: "2026-06-01",
        currencyCode: "LYD",
        approvedAmountMinor: 50000,
        approvedCount: 2,
      },
      {
        bucketStart: "2026-06-01",
        currencyCode: "USD",
        approvedAmountMinor: 1000,
        approvedCount: 1,
      },
    ]);
  });

  it("labels approved payments and separates currencies", async () => {
    renderPage();
    expect(
      await screen.findByText(/مدفوعات معتمدة · LYD/),
    ).toBeInTheDocument();
    expect(screen.getByText(/مدفوعات معتمدة · USD/)).toBeInTheDocument();
    expect(
      screen.getByText(/وليس إيرادًا مصرفيًا محصّلًا/),
    ).toBeInTheDocument();
  });
});
