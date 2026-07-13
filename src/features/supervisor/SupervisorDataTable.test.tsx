import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { SupervisorDataTable } from "./SupervisorDataTable";

type Row = { id: string; name: string; status: string };

const rows: Row[] = [
  { id: "1", name: "أحمد", status: "نشط" },
  { id: "2", name: "سارة", status: "موقوف" },
];

function Harness({
  isLoading = false,
  empty = false,
  pageCount = 3,
}: {
  isLoading?: boolean;
  empty?: boolean;
  pageCount?: number;
}) {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | undefined>("1");

  return (
    <SupervisorDataTable
      columns={[
        {
          id: "name",
          header: "العميل",
          cell: (row) => row.name,
        },
        {
          id: "status",
          header: "الحساب",
          cell: (row) => row.status,
        },
      ]}
      emptyTitle="لا عملاء"
      isLoading={isLoading}
      onPageChange={setPage}
      onRowSelect={(row) => setSelectedId(row.id)}
      page={page}
      pageCount={pageCount}
      renderMobileRow={(row) => (
        <div>
          <p>{row.name}</p>
          <p>{row.status}</p>
        </div>
      )}
      rowKey={(row) => row.id}
      rows={empty ? [] : rows}
      selectedId={selectedId}
    />
  );
}

describe("SupervisorDataTable", () => {
  it("renders column headers and selected row", () => {
    render(<Harness />);

    expect(screen.getByRole("columnheader", { name: "العميل" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "الحساب" })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /أحمد/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("paginates and selects rows", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByText("صفحة 1 من 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "الصفحة التالية" }));
    expect(screen.getByText("صفحة 2 من 3")).toBeInTheDocument();

    await user.click(screen.getByRole("row", { name: /سارة/ }));
    expect(screen.getByRole("row", { name: /سارة/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("shows loading and empty states", () => {
    const { rerender } = render(<Harness isLoading />);
    expect(screen.getByLabelText("جارٍ التحميل")).toBeInTheDocument();

    rerender(<Harness empty />);
    expect(screen.getByText("لا عملاء")).toBeInTheDocument();
  });

  it("renders a mobile row list", () => {
    render(<Harness />);
    const mobileButtons = screen.getAllByRole("button", { pressed: true });
    expect(mobileButtons.length).toBeGreaterThan(0);
    expect(screen.getAllByText("أحمد").length).toBeGreaterThan(1);
  });
});
