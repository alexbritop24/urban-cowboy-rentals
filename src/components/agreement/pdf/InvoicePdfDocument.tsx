import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { Invoice } from "../../../types/invoice";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", lineHeight: 1.45 },
  title: { fontSize: 25, fontWeight: "bold", marginBottom: 3 },
  subtitle: { fontSize: 12, marginBottom: 20, color: "#555" },
  section: { marginBottom: 18 },
  heading: { fontSize: 14, fontWeight: "bold", marginBottom: 8 },
  detailGrid: { flexDirection: "row", gap: 24 },
  detailColumn: { flexGrow: 1, flexBasis: 0 },
  muted: { color: "#666" },
  warning: { padding: 8, marginBottom: 10, backgroundColor: "#fff7df", color: "#6b4b00" },
  table: { borderWidth: 1, borderColor: "#d8d0c6" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f3eee8", fontWeight: "bold" },
  tableRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#e5ded6" },
  equipmentCell: { width: "26%", padding: 5 },
  periodCell: { width: "20%", padding: 5 },
  serialCell: { width: "16%", padding: 5 },
  numberCell: { width: "9.5%", padding: 5, textAlign: "right" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  total: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#aaa", fontSize: 15, fontWeight: "bold" },
  footer: { marginTop: 24, fontSize: 8, color: "#777" },
});

const money = (value: number, currency: string) =>
  `${currency || "USD"} ${Number(value).toFixed(2)}`;

const date = (value: string): string => {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
};

export default function InvoicePdfDocument({ invoice }: { invoice: Invoice }) {
  const legacy = invoice.item_source !== "normalized";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Urban Cowboy Rentals</Text>
        <Text style={styles.subtitle}>Equipment Rental Invoice</Text>

        <View style={[styles.section, styles.detailGrid]}>
          <View style={styles.detailColumn}>
            <Text style={styles.heading}>Invoice</Text>
            <Text>Invoice #: {invoice.invoice_number}</Text>
            <Text>Status: {invoice.status.replaceAll("_", " ")}</Text>
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
              serial numbers, and dates have not been reconstructed.
            </Text>
          )}
          {invoice.items.length === 0 ? (
            <Text style={styles.muted}>Historical item details are unavailable.</Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.equipmentCell}>Equipment</Text>
                <Text style={styles.serialCell}>Serial</Text>
                <Text style={styles.periodCell}>Rental period</Text>
                <Text style={styles.numberCell}>Qty</Text>
                <Text style={styles.numberCell}>Rate</Text>
                <Text style={styles.numberCell}>Days</Text>
                <Text style={styles.numberCell}>Amount</Text>
              </View>
              {invoice.items.map((item) => (
                <View key={item.id} style={styles.tableRow} wrap={false}>
                  <View style={styles.equipmentCell}>
                    <Text>{item.equipmentName}</Text>
                    {item.notes && <Text style={styles.muted}>{item.notes}</Text>}
                  </View>
                  <Text style={styles.serialCell}>{item.serialNumber || "Not recorded"}</Text>
                  <Text style={styles.periodCell}>{date(item.startDate)} - {date(item.endDate)}</Text>
                  <Text style={styles.numberCell}>{item.quantity || "-"}</Text>
                  <Text style={styles.numberCell}>{legacy ? "-" : money(item.dailyRate, invoice.currency)}</Text>
                  <Text style={styles.numberCell}>{legacy ? "-" : item.billableDays}</Text>
                  <Text style={styles.numberCell}>{money(item.lineTotal, invoice.currency)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Charges</Text>
          <View style={styles.row}><Text>Rental subtotal</Text><Text>{money(invoice.subtotal, invoice.currency)}</Text></View>
          <View style={styles.row}><Text>Deposit / credit</Text><Text>{money(invoice.deposit_amount, invoice.currency)}</Text></View>
          <View style={styles.row}><Text>Delivery</Text><Text>{money(invoice.delivery_fee, invoice.currency)}</Text></View>
          <View style={styles.row}><Text>Sales tax</Text><Text>{money(invoice.tax_amount, invoice.currency)}</Text></View>
          {invoice.other_charges_amount > 0 && (
            <View style={styles.row}><Text>Other approved charges</Text><Text>{money(invoice.other_charges_amount, invoice.currency)}</Text></View>
          )}
          <View style={[styles.row, styles.total]}><Text>Total</Text><Text>{money(invoice.total_amount, invoice.currency)}</Text></View>
          <View style={styles.row}><Text>Paid</Text><Text>{money(invoice.amount_paid, invoice.currency)}</Text></View>
          <View style={styles.row}><Text>Balance due</Text><Text>{money(invoice.balance_due, invoice.currency)}</Text></View>
        </View>

        <View style={styles.footer}>
          <Text>Source Agreement: {invoice.rental_agreement_id || "Not recorded"}</Text>
          <Text>Thank you for choosing Urban Cowboy Rentals.</Text>
        </View>
      </Page>
    </Document>
  );
}
