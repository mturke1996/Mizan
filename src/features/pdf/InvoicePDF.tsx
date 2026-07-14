import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type {
  Invoice,
  InvoiceItem,
  WorkspaceBrand,
} from "@/features/workspace/workspace-types";
import { ar, arDate, arMoney } from "./arabicPdf";
import { getPdfFontFamily } from "./pdfFonts";

const font = getPdfFontFamily();

const colors = {
  ink: "#1B1E3C",
  muted: "#6B7289",
  line: "#E2E5F0",
  primary: "#4B52C7",
  surface: "#F7F8FC",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: font,
    fontSize: 10,
    color: colors.ink,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    direction: "rtl",
    backgroundColor: colors.white,
  },
  headerRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 16,
  },
  brandBlock: {
    alignItems: "flex-end",
  },
  logo: {
    width: 72,
    height: 72,
    objectFit: "contain",
    marginBottom: 8,
  },
  brand: {
    fontSize: 22,
    fontWeight: 700,
    color: colors.primary,
  },
  brandMeta: {
    marginTop: 4,
    fontSize: 9,
    color: colors.muted,
    textAlign: "right",
  },
  brandEn: {
    marginTop: 4,
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.muted,
  },
  invoiceLabel: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.ink,
    textAlign: "left",
  },
  invoiceNumber: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: 700,
    color: colors.primary,
    textAlign: "left",
  },
  metaGrid: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24,
  },
  metaCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
  },
  metaTitle: {
    fontSize: 9,
    color: colors.muted,
    marginBottom: 6,
    textAlign: "right",
  },
  metaValue: {
    fontSize: 11,
    fontWeight: 700,
    textAlign: "right",
  },
  metaMuted: {
    marginTop: 4,
    fontSize: 9,
    color: colors.muted,
    textAlign: "right",
  },
  table: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row-reverse",
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    color: colors.white,
    fontSize: 9,
    fontWeight: 700,
    textAlign: "right",
  },
  tableRow: {
    flexDirection: "row-reverse",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableRowAlt: {
    backgroundColor: colors.surface,
  },
  cellDesc: { width: "40%", textAlign: "right", fontSize: 9 },
  cellQty: { width: "15%", textAlign: "center", fontSize: 9 },
  cellPrice: { width: "22%", textAlign: "left", fontSize: 9 },
  cellTotal: { width: "23%", textAlign: "left", fontSize: 9, fontWeight: 700 },
  totalsBox: {
    marginTop: 20,
    alignSelf: "flex-start",
    width: "48%",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    overflow: "hidden",
  },
  totalRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  totalRowFinal: {
    backgroundColor: colors.primary,
    borderBottomWidth: 0,
  },
  totalLabel: {
    fontSize: 10,
    color: colors.muted,
    textAlign: "right",
  },
  totalLabelFinal: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.white,
    textAlign: "right",
  },
  totalValue: {
    fontSize: 10,
    fontWeight: 700,
    textAlign: "left",
  },
  totalValueFinal: {
    fontSize: 12,
    fontWeight: 700,
    color: colors.white,
    textAlign: "left",
  },
  notesBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  notesTitle: {
    fontSize: 9,
    fontWeight: 700,
    marginBottom: 4,
    textAlign: "right",
    color: colors.muted,
  },
  notesBody: {
    fontSize: 10,
    lineHeight: 1.5,
    textAlign: "right",
  },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
    flexDirection: "row-reverse",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: colors.muted,
    textAlign: "right",
    maxWidth: "70%",
  },
});

export interface InvoicePdfProps {
  invoice: Invoice;
  items?: InvoiceItem[];
  brand?: WorkspaceBrand;
  workspaceName?: string;
  logoDataUri?: string | null;
}

export function InvoicePDF({
  invoice,
  items,
  brand,
  workspaceName = "ميزان",
  logoDataUri,
}: InvoicePdfProps) {
  const lineItems = items ?? invoice.items ?? [];
  const currency = invoice.currencyCode;
  const companyName = brand?.legalName?.trim() || workspaceName;

  return (
    <Document
      title={`فاتورة ${invoice.invoiceNumber}`}
      author={companyName}
      language="ar"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.brandBlock}>
            {logoDataUri ? (
              <Image src={logoDataUri} style={styles.logo} />
            ) : null}
            <Text style={styles.brand}>{ar(companyName)}</Text>
            {brand?.phone ? (
              <Text style={styles.brandMeta}>{ar(brand.phone)}</Text>
            ) : (
              <Text style={styles.brandEn}>MIZAN</Text>
            )}
            {brand?.address ? (
              <Text style={styles.brandMeta}>{ar(brand.address)}</Text>
            ) : null}
            {brand?.taxId ? (
              <Text style={styles.brandMeta}>
                {ar(`الرقم الضريبي: ${brand.taxId}`)}
              </Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.invoiceLabel}>فاتورة / INVOICE</Text>
            <Text style={styles.invoiceNumber}>{ar(invoice.invoiceNumber)}</Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCard}>
            <Text style={styles.metaTitle}>العميل</Text>
            <Text style={styles.metaValue}>{ar(invoice.clientName)}</Text>
            {invoice.clientPhone ? (
              <Text style={styles.metaMuted}>{ar(invoice.clientPhone)}</Text>
            ) : null}
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaTitle}>التواريخ</Text>
            <Text style={styles.metaValue}>
              الإصدار: {arDate(invoice.issueOn)}
            </Text>
            <Text style={styles.metaMuted}>
              الاستحقاق: {arDate(invoice.dueOn)}
            </Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.cellDesc]}>الوصف</Text>
            <Text style={[styles.tableHeaderCell, styles.cellQty]}>الكمية</Text>
            <Text style={[styles.tableHeaderCell, styles.cellPrice]}>
              السعر
            </Text>
            <Text style={[styles.tableHeaderCell, styles.cellTotal]}>
              الإجمالي
            </Text>
          </View>
          {lineItems.map((item, index) => (
            <View
              key={item.id || `${index}`}
              style={[
                styles.tableRow,
                ...(index % 2 === 1 ? [styles.tableRowAlt] : []),
              ]}
            >
              <Text style={styles.cellDesc}>{ar(item.description)}</Text>
              <Text style={styles.cellQty}>
                {new Intl.NumberFormat("ar-LY", {
                  maximumFractionDigits: 3,
                }).format(item.quantity)}
              </Text>
              <Text style={styles.cellPrice}>
                {arMoney(item.unitPriceMinor, currency)}
              </Text>
              <Text style={styles.cellTotal}>
                {arMoney(item.lineTotalMinor, currency)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>المجموع الفرعي</Text>
            <Text style={styles.totalValue}>
              {arMoney(invoice.subtotalMinor, currency)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              الضريبة ({invoice.taxRatePercent}%)
            </Text>
            <Text style={styles.totalValue}>
              {arMoney(invoice.taxMinor, currency)}
            </Text>
          </View>
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={styles.totalLabelFinal}>الإجمالي</Text>
            <Text style={styles.totalValueFinal}>
              {arMoney(invoice.totalMinor, currency)}
            </Text>
          </View>
        </View>

        {invoice.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesTitle}>ملاحظات</Text>
            <Text style={styles.notesBody}>{ar(invoice.notes)}</Text>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {ar(
              brand?.invoiceFooter?.trim() ||
                `${companyName} — إدارة مالية موثوقة`,
            )}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
