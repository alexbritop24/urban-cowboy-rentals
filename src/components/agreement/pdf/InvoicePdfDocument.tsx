import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { Invoice } from "../../../types/invoice";

const styles = StyleSheet.create({
  page: {
    paddingTop: 38,
    paddingRight: 32,
    paddingBottom: 42,
    paddingLeft: 32,
    fontSize: 8.5,
    fontFamily: "Helvetica",
    lineHeight: 1.3,
    color: "#211d18",
  },
  documentHeader: { marginBottom: 22 },
  companyName: { fontSize: 24, fontWeight: "bold", lineHeight: 1.15 },
  documentName: {
    marginTop: 9,
    fontSize: 12,
    lineHeight: 1.25,
    color: "#555",
  },
  section: { marginBottom: 16 },
  heading: { fontSize: 13, fontWeight: "bold", marginBottom: 7 },
  detailGrid: { flexDirection: "row", gap: 20 },
  detailColumn: { flexGrow: 1, flexBasis: 0 },
  muted: { color: "#666" },
  warning: {
    padding: 8,
    marginBottom: 10,
    backgroundColor: "#fff7df",
    color: "#6b4b00",
  },
  table: { width: "100%", borderWidth: 1, borderColor: "#d8d0c6" },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 25,
    backgroundColor: "#f3eee8",
    fontSize: 7,
    fontWeight: "bold",
    lineHeight: 1.1,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderTopWidth: 1,
    borderTopColor: "#e5ded6",
    fontSize: 7.4,
    lineHeight: 1.18,
  },
  cell: { paddingVertical: 5, paddingHorizontal: 4 },
  equipmentCell: { width: "26%" },
  serialCell: { width: "16%" },
  periodCell: { width: "19%" },
  quantityCell: { width: "6%", textAlign: "right" },
  rateCell: { width: "11%", textAlign: "right" },
  daysCell: { width: "7%", textAlign: "right" },
  amountCell: { width: "15%", textAlign: "right" },
  equipmentName: { fontSize: 7.7, fontWeight: "bold", lineHeight: 1.18 },
  equipmentNotes: { marginTop: 2, fontSize: 6.6, lineHeight: 1.18, color: "#666" },
  charges: { width: 280, alignSelf: "flex-end" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  chargeLabel: { flexGrow: 1, paddingRight: 12 },
  chargeValue: { width: 90, textAlign: "right" },
  total: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#aaa",
    fontSize: 14,
    fontWeight: "bold",
  },
  footer: { marginTop: 24, fontSize: 8, color: "#777" },
});

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));

const date = (value: string | null, compact = false): string => {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    month: compact ? "numeric" : "short",
    day: "numeric",
    year: compact ? "2-digit" : "numeric",
  }).format(parsed);
};

const statusLabel = (status: Invoice["status"]): string =>
  status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const serial = (value: string | null): string => {
  if (!value) return "Not recorded";
  return value.match(/.{1,6}/g)?.join(" ") ?? value;
};

export default function InvoicePdfDocument({ invoice }: { invoice: Invoice }) {
  const legacy = invoice.item_source !== "normalized";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.documentHeader}>
          <Text style={styles.companyName}>Urban Cowboy Rentals</Text>
          <Text style={styles.documentName}>Equipment Rental Invoice</Text>
        </View>

        <View style={[styles.section, styles.detailGrid]}>
          <View style={styles.detailColumn}>
            <Text style={styles.heading}>Invoice</Text>
            <Text>Invoice #: {invoice.invoice_number}</Text>
            <Text>Status: {statusLabel(invoice.status)}</Text>
            <Text>Issued: {invoice.issued_at ? date(invoice.issued_at) : "Draft"}</Text>
            <Text>Due: {invoice.due_at ? date(invoice.due_at) : "Not issued"}</Text>
            <Text>Payment terms: {invoice.payment_terms}</Text>
          </View>
          <View style={styles.detailColumn}>
            <Text style={styles.heading}>Bill To</Text>
            <Text>{invoice.customer_name}</Text>
            {invoice.business_name && <Text>{invoice.business_name}</Text>}
            <Text>{invoice.customer_email || "Email not recorded"}</Text>
            <Text>{invoice.customer_phone || "Phone not recorded"}</Text>
            <Text>{invoice.billing_address || "Billing address not recorded"}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Itemized Rental</Text>
          {legacy && (
            <Text style={styles.warning}>
              Historical Invoice: normalized item snapshots are unavailable. Missing rates,
              quantities, serial numbers, and dates have not been reconstructed.
            </Text>
          )}
          {invoice.items.length === 0 ? (
            <Text style={styles.muted}>Historical item details are unavailable.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader} fixed>
                <Text style={[styles.cell, styles.equipmentCell]}>Equipment</Text>
                <Text style={[styles.cell, styles.serialCell]}>Serial</Text>
                <Text style={[styles.cell, styles.periodCell]}>Rental period</Text>
                <Text style={[styles.cell, styles.quantityCell]}>Qty</Text>
                <Text style={[styles.cell, styles.rateCell]}>Daily rate</Text>
                <Text style={[styles.cell, styles.daysCell]}>Days</Text>
                <Text style={[styles.cell, styles.amountCell]}>Amount</Text>
              </View>
              {invoice.items.map((item) => (
                <View key={item.id} style={styles.tableRow} wrap={false}>
                  <View style={[styles.cell, styles.equipmentCell]}>
                    <Text style={styles.equipmentName}>{item.equipmentName}</Text>
                    {item.notes && (
                      <Text style={styles.equipmentNotes}>{item.notes}</Text>
                    )}
                  </View>
                  <Text style={[styles.cell, styles.serialCell]}>
                    {serial(item.serialNumber)}
                  </Text>
                  <Text style={[styles.cell, styles.periodCell]}>
                    {date(item.startDate, true)} - {date(item.endDate, true)}
                  </Text>
                  <Text style={[styles.cell, styles.quantityCell]}>
                    {legacy ? "N/A" : item.quantity}
                  </Text>
                  <Text style={[styles.cell, styles.rateCell]}>
                    {legacy ? "-" : money(item.dailyRate, invoice.currency)}
                  </Text>
                  <Text style={[styles.cell, styles.daysCell]}>
                    {legacy ? "-" : item.billableDays}
                  </Text>
                  <Text style={[styles.cell, styles.amountCell]}>
                    {money(item.lineTotal, invoice.currency)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Charges</Text>
          <View style={styles.charges}>
            <ChargeRow label="Rental subtotal" value={money(invoice.subtotal, invoice.currency)} />
            <ChargeRow
              label="Deposit required"
              value={money(invoice.deposit_amount, invoice.currency)}
            />
            <ChargeRow label="Delivery" value={money(invoice.delivery_fee, invoice.currency)} />
            <ChargeRow label="Sales tax" value={money(invoice.tax_amount, invoice.currency)} />
            {invoice.other_charges_amount > 0 && (
              <ChargeRow
                label="Other approved charges"
                value={money(invoice.other_charges_amount, invoice.currency)}
              />
            )}
            <ChargeRow
              label="Total"
              value={money(invoice.total_amount, invoice.currency)}
              total
            />
            <ChargeRow label="Paid" value={money(invoice.amount_paid, invoice.currency)} />
            <ChargeRow label="Balance due" value={money(invoice.balance_due, invoice.currency)} />
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Source Agreement: {invoice.rental_agreement_id || "Not recorded"}</Text>
          <Text>Thank you for choosing Urban Cowboy Rentals.</Text>
        </View>
      </Page>
    </Document>
  );
}

function ChargeRow({
  label,
  value,
  total = false,
}: {
  label: string;
  value: string;
  total?: boolean;
}) {
  return (
    <View style={total ? [styles.row, styles.total] : styles.row} wrap={false}>
      <Text style={styles.chargeLabel}>{label}</Text>
      <Text style={styles.chargeValue}>{value}</Text>
    </View>
  );
}
