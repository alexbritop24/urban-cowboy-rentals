import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { Invoice } from "../../../types/invoice";
import {
  formatDocumentCurrency,
  formatDocumentDate,
  formatDocumentSerial,
  formatDocumentStatus,
} from "../../../utils/documentPresentation";
import {
  PdfBrandFooter,
  PdfBrandHeader,
} from "../../document/pdf/DocumentPdfChrome";

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingRight: 32,
    paddingBottom: 48,
    paddingLeft: 32,
    fontSize: 8.2,
    fontFamily: "Helvetica",
    lineHeight: 1.35,
    color: "#211d18",
  },
  section: { marginBottom: 14 },
  sectionTitle: {
    marginBottom: 7,
    paddingBottom: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: "#b7791f",
    fontSize: 11,
    fontWeight: "bold",
  },
  twoColumn: { flexDirection: "row", gap: 18 },
  column: { flexGrow: 1, flexBasis: 0 },
  detailRow: { marginBottom: 4 },
  detailLabel: {
    color: "#776b60",
    fontSize: 6.8,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  detailValue: { marginTop: 1, fontSize: 8.2 },
  muted: { color: "#6f665c" },
  warning: {
    padding: 8,
    marginBottom: 9,
    borderWidth: 0.5,
    borderColor: "#d6a441",
    backgroundColor: "#fff8e7",
    color: "#6b4b00",
  },
  table: { width: "100%", borderWidth: 0.75, borderColor: "#d8d0c6" },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 23,
    backgroundColor: "#f4eee5",
    fontSize: 6.6,
    fontWeight: "bold",
    lineHeight: 1.1,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderTopWidth: 0.5,
    borderTopColor: "#ded6cc",
    fontSize: 7,
    lineHeight: 1.2,
  },
  cell: { paddingVertical: 5, paddingHorizontal: 3 },
  equipmentCell: { width: "26%" },
  serialCell: { width: "14%" },
  periodCell: { width: "22%" },
  quantityCell: { width: "6%", textAlign: "right" },
  rateCell: { width: "12%", textAlign: "right" },
  daysCell: { width: "6%", textAlign: "right" },
  amountCell: { width: "14%", textAlign: "right" },
  equipmentName: { fontWeight: "bold" },
  equipmentNotes: { marginTop: 2, color: "#6f665c", fontSize: 6.4 },
  closingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 18,
    marginBottom: 14,
  },
  closingColumn: { flexGrow: 1, flexBasis: 0 },
  charges: { width: "100%" },
  chargeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  chargeLabel: { flexGrow: 1, paddingRight: 12 },
  chargeValue: { width: 92, textAlign: "right" },
  totalRow: {
    marginTop: 5,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#b7791f",
    fontSize: 11,
    fontWeight: "bold",
  },
  balanceRow: {
    marginTop: 5,
    padding: 7,
    backgroundColor: "#fff8e7",
    color: "#6b4b00",
    fontSize: 12,
    fontWeight: "bold",
  },
  traceability: {
    padding: 8,
    borderWidth: 0.5,
    borderColor: "#ded6cc",
    backgroundColor: "#faf7f2",
  },
  traceabilityLine: { marginBottom: 3, fontSize: 7.2 },
  hash: { fontSize: 6.2, color: "#5f574f" },
  notes: { marginTop: 7, fontSize: 7.4, color: "#5f574f" },
  continuation: {
    position: "absolute",
    top: 10,
    right: 32,
    color: "#776b60",
    fontSize: 6.8,
    textAlign: "right",
  },
});

export default function InvoicePdfDocument({ invoice }: { invoice: Invoice }) {
  const legacy = invoice.item_source !== "normalized";
  const issueDate = invoice.issued_at || invoice.issue_date || invoice.created_at;

  return (
    <Document
      title={`Equipment Rental Invoice ${invoice.invoice_number}`}
      author="Urban Cowboy Rentals LLC"
      subject="Immutable equipment rental Invoice snapshot"
      keywords="Urban Cowboy Rentals, equipment rental, invoice"
      creator="Urban Cowboy Rentals application"
      language="en-US"
    >
      <Page size="LETTER" style={styles.page} wrap>
        <Text
          style={styles.continuation}
          fixed
          render={({ pageNumber }) =>
            pageNumber > 1
              ? `Equipment Rental Invoice ${invoice.invoice_number} - Continued`
              : ""
          }
        />
        <PdfBrandFooter
          documentType="Invoice"
          documentNumber={invoice.invoice_number}
        />

        <PdfBrandHeader
          documentType="Equipment Rental Invoice"
          documentNumber={invoice.invoice_number}
          status={invoice.status}
          dateLabel={invoice.issued_at || invoice.issue_date ? "Issued" : "Created"}
          dateValue={issueDate}
        />

        <View style={[styles.section, styles.twoColumn]}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <Detail label="Customer type" value={invoice.customer_type ? formatDocumentStatus(invoice.customer_type) : "Not recorded"} />
            <Detail label="Legal name" value={invoice.customer_name} />
            {invoice.business_name && <Detail label="Business" value={invoice.business_name} />}
            {invoice.customer_email && <Detail label="Email" value={invoice.customer_email} />}
            {invoice.customer_phone && <Detail label="Phone" value={invoice.customer_phone} />}
            <Detail label="Billing address" value={invoice.billing_address || "Not provided"} />
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Invoice Details</Text>
            <Detail label="Payment terms" value={invoice.payment_terms} />
            <Detail label="Payment status" value={formatDocumentStatus(invoice.payment_status || invoice.status)} />
            <Detail label="Due" value={formatDocumentDate(invoice.due_at, "Not set")} />
            <Detail label="Rental request" value={invoice.rental_request_id || "Not recorded"} />
            <Detail label="Source Agreement" value={invoice.rental_agreement_id || "Not recorded"} />
            {invoice.service_address && (
              <Detail label="Service / delivery address" value={invoice.service_address} />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Itemized Rental</Text>
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
                    {item.notes && <Text style={styles.equipmentNotes}>{item.notes}</Text>}
                  </View>
                  <Text style={[styles.cell, styles.serialCell]}>
                    {formatDocumentSerial(item.serialNumber)}
                  </Text>
                  <Text style={[styles.cell, styles.periodCell]}>
                    {formatDocumentDate(item.startDate)} - {formatDocumentDate(item.endDate)}
                  </Text>
                  <Text style={[styles.cell, styles.quantityCell]}>
                    {legacy ? "N/A" : item.quantity}
                  </Text>
                  <Text style={[styles.cell, styles.rateCell]}>
                    {legacy ? "-" : formatDocumentCurrency(item.dailyRate, invoice.currency)}
                  </Text>
                  <Text style={[styles.cell, styles.daysCell]}>
                    {legacy ? "-" : item.billableDays}
                  </Text>
                  <Text style={[styles.cell, styles.amountCell]}>
                    {formatDocumentCurrency(item.lineTotal, invoice.currency)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.closingRow} wrap={false}>
          <View style={styles.closingColumn}>
            <Text style={styles.sectionTitle}>Charges and Balance</Text>
            <View style={styles.charges}>
              <ChargeRow label="Rental subtotal" value={invoice.subtotal} currency={invoice.currency} />
              <ChargeRow label="Deposit required" value={invoice.deposit_amount} currency={invoice.currency} />
              <ChargeRow label="Delivery" value={invoice.delivery_fee} currency={invoice.currency} />
              <ChargeRow label="Sales tax" value={invoice.tax_amount} currency={invoice.currency} />
              {invoice.other_charges_amount > 0 && (
                <ChargeRow label="Other approved charges" value={invoice.other_charges_amount} currency={invoice.currency} />
              )}
              <ChargeRow label="Total" value={invoice.total_amount} currency={invoice.currency} total />
              <ChargeRow label="Amount paid" value={invoice.amount_paid} currency={invoice.currency} />
              <ChargeRow label="Balance due" value={invoice.balance_due} currency={invoice.currency} balance />
            </View>
          </View>
          <View style={styles.closingColumn}>
            <Text style={styles.sectionTitle}>Agreement Traceability</Text>
            <View style={styles.traceability}>
              <Text style={styles.traceabilityLine}>
                Source Agreement: {invoice.rental_agreement_id || "Not recorded"}
              </Text>
              <Text style={styles.traceabilityLine}>
                Rental Request: {invoice.rental_request_id || "Not recorded"}
              </Text>
              {invoice.source_agreement_snapshot_hash && (
                <Text style={styles.hash}>
                  Accepted Agreement snapshot: {invoice.source_agreement_snapshot_hash}
                </Text>
              )}
            </View>
            {invoice.notes && <Text style={styles.notes}>Notes: {invoice.notes}</Text>}
          </View>
        </View>
      </Page>
    </Document>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function ChargeRow({
  label,
  value,
  currency,
  total = false,
  balance = false,
}: {
  label: string;
  value: number;
  currency: string;
  total?: boolean;
  balance?: boolean;
}) {
  const rowStyle = balance
    ? [styles.chargeRow, styles.balanceRow]
    : total
      ? [styles.chargeRow, styles.totalRow]
      : styles.chargeRow;

  return (
    <View style={rowStyle} wrap={false}>
      <Text style={styles.chargeLabel}>{label}</Text>
      <Text style={styles.chargeValue}>
        {formatDocumentCurrency(value, currency)}
      </Text>
    </View>
  );
}
