import Dexie, { type Table } from "dexie";
import type { Invoice } from "@/features/workspace/workspace-types";

interface InvoiceListCacheRow {
  workspaceId: string;
  payloadJson: string;
  updatedAt: string;
}

interface InvoiceDetailCacheRow {
  workspaceId: string;
  invoiceId: string;
  payloadJson: string;
  updatedAt: string;
}

class InvoiceCacheDatabase extends Dexie {
  invoiceLists!: Table<InvoiceListCacheRow, string>;
  invoiceDetails!: Table<InvoiceDetailCacheRow, [string, string]>;

  constructor() {
    super("mizan-invoice-cache");
    this.version(1).stores({
      invoiceLists: "workspaceId, updatedAt",
      invoiceDetails: "[workspaceId+invoiceId], workspaceId, updatedAt",
    });
  }
}

let db: InvoiceCacheDatabase | null = null;

function getInvoiceCacheDb(): InvoiceCacheDatabase {
  if (!db) db = new InvoiceCacheDatabase();
  return db;
}

function serializeInvoices(value: unknown): string {
  return JSON.stringify(value, (_key, current) =>
    typeof current === "bigint" ? current.toString() : current,
  );
}

function reviveBigInts(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reviveBigInts);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      if (
        typeof entry === "string" &&
        /Minor$/.test(key) &&
        /^-?\d+$/.test(entry)
      ) {
        next[key] = BigInt(entry);
      } else {
        next[key] = reviveBigInts(entry);
      }
    }
    return next;
  }
  return value;
}

export async function cacheInvoiceList(
  workspaceId: string,
  invoices: Invoice[],
): Promise<void> {
  await getInvoiceCacheDb().invoiceLists.put({
    workspaceId,
    payloadJson: serializeInvoices(invoices),
    updatedAt: new Date().toISOString(),
  });
}

export async function getCachedInvoiceList(
  workspaceId: string,
): Promise<Invoice[] | null> {
  const row = await getInvoiceCacheDb().invoiceLists.get(workspaceId);
  if (!row) return null;
  try {
    return reviveBigInts(JSON.parse(row.payloadJson)) as Invoice[];
  } catch {
    return null;
  }
}

export async function cacheInvoiceDetail(
  workspaceId: string,
  invoice: Invoice,
): Promise<void> {
  await getInvoiceCacheDb().invoiceDetails.put({
    workspaceId,
    invoiceId: invoice.id,
    payloadJson: serializeInvoices(invoice),
    updatedAt: new Date().toISOString(),
  });
}

export async function getCachedInvoiceDetail(
  workspaceId: string,
  invoiceId: string,
): Promise<Invoice | null> {
  const row = await getInvoiceCacheDb().invoiceDetails.get([
    workspaceId,
    invoiceId,
  ]);
  if (!row) return null;
  try {
    return reviveBigInts(JSON.parse(row.payloadJson)) as Invoice;
  } catch {
    return null;
  }
}

export async function resetInvoiceCacheForTests(): Promise<void> {
  const cache = getInvoiceCacheDb();
  await Promise.all([
    cache.invoiceLists.clear(),
    cache.invoiceDetails.clear(),
  ]);
}
