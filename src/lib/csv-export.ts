export function toCsvValue(value: string | number | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function buildCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>,
): string {
  const lines = [
    headers.map(toCsvValue).join(","),
    ...rows.map((row) => row.map(toCsvValue).join(",")),
  ];
  return `\uFEFF${lines.join("\n")}`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportTransactionsCsv(
  rows: ReadonlyArray<{
    occurredAt: string;
    kind: string;
    title: string;
    amountMinor: bigint;
    currency: string;
    projectId?: string;
  }>,
): string {
  return buildCsv(
    ["occurred_at", "kind", "title", "amount_minor", "currency", "project_id"],
    rows.map((row) => [
      row.occurredAt,
      row.kind,
      row.title,
      row.amountMinor.toString(),
      row.currency,
      row.projectId ?? "",
    ]),
  );
}

const KIND_LABELS: Record<string, string> = {
  income: "دخل",
  expense: "مصروف",
  transfer: "تحويل",
  opening_balance: "خزينة",
};

/** Rich register export with wallet, category, and signed amount columns. */
export function exportRegisterCsv(
  rows: ReadonlyArray<{
    occurredAt: string;
    kind: string;
    title: string;
    amountMinor: bigint;
    currency: string;
    walletId: string;
    destinationWalletId?: string;
    categoryId?: string;
    projectId?: string;
    flow?: "in" | "out";
  }>,
  names: {
    wallet: (id: string) => string;
    category: (id: string) => string;
    project: (id: string) => string;
  },
): string {
  return buildCsv(
    [
      "occurred_at",
      "kind",
      "title",
      "wallet",
      "category",
      "project",
      "amount_minor",
      "currency",
    ],
    rows.map((row) => {
      const signed =
        row.kind === "income"
          ? row.amountMinor
          : row.kind === "expense"
            ? -row.amountMinor
            : row.kind === "opening_balance"
              ? row.flow === "out"
                ? -row.amountMinor
                : row.amountMinor
              : 0n;
      const kindLabel =
        row.kind === "opening_balance"
          ? row.flow === "out"
            ? "سحب خزينة"
            : "تمويل خزينة"
          : (KIND_LABELS[row.kind] ?? row.kind);
      return [
        row.occurredAt,
        kindLabel,
        row.title,
        row.walletId ? names.wallet(row.walletId) : "",
        row.categoryId ? names.category(row.categoryId) : "",
        row.projectId ? names.project(row.projectId) : "",
        signed.toString(),
        row.currency,
      ];
    }),
  );
}

export function exportWalletsCsv(
  rows: ReadonlyArray<{
    name: string;
    currency: string;
    balanceMinor: bigint;
  }>,
): string {
  return buildCsv(
    ["name", "currency", "balance_minor"],
    rows.map((row) => [row.name, row.currency, row.balanceMinor.toString()]),
  );
}

export function exportDebtsCsv(
  rows: ReadonlyArray<{
    partyName: string;
    direction: string;
    status: string;
    balanceMinor: bigint;
    currencyCode: string;
    dueOn: string | null;
  }>,
): string {
  return buildCsv(
    ["party", "direction", "status", "balance_minor", "currency", "due_on"],
    rows.map((row) => [
      row.partyName,
      row.direction,
      row.status,
      row.balanceMinor.toString(),
      row.currencyCode,
      row.dueOn ?? "",
    ]),
  );
}

export function exportProjectSummaryCsv(
  rows: ReadonlyArray<{
    name: string;
    incomeMinor: bigint;
    expenseMinor: bigint;
    profitMinor: bigint;
    capitalMinor: bigint;
    outstandingLaborMinor: bigint;
  }>,
): string {
  return buildCsv(
    [
      "name",
      "income_minor",
      "expense_minor",
      "profit_minor",
      "capital_minor",
      "outstanding_labor_minor",
    ],
    rows.map((row) => [
      row.name,
      row.incomeMinor.toString(),
      row.expenseMinor.toString(),
      row.profitMinor.toString(),
      row.capitalMinor.toString(),
      row.outstandingLaborMinor.toString(),
    ]),
  );
}
