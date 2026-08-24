import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { RentalAgreement } from "../../../types/agreement";
import {
  agreementEvidenceLimitation,
  formatDocumentCurrency,
  formatDocumentDate,
  formatDocumentDateTime,
  formatDocumentSerial,
  formatDocumentStatus,
  getAgreementEvidenceRows,
} from "../../../utils/documentPresentation";
import {
  PdfBrandFooter,
  PdfBrandHeader,
} from "../../document/pdf/DocumentPdfChrome";

interface Props {
  agreement: RentalAgreement;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingRight: 32,
    paddingBottom: 48,
    paddingLeft: 32,
    fontSize: 8.2,
    color: "#211d18",
    fontFamily: "Helvetica",
    lineHeight: 1.35,
  },
  section: { marginBottom: 14 },
  sectionTitle: {
    marginBottom: 7,
    paddingBottom: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: "#b7791f",
    color: "#211d18",
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
  financials: { width: 270, alignSelf: "flex-end" },
  financialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  financialLabel: { flexGrow: 1, paddingRight: 12 },
  financialValue: { width: 90, textAlign: "right" },
  totalRow: {
    marginTop: 5,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#b7791f",
    fontSize: 12,
    fontWeight: "bold",
  },
  evidenceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  evidence: {
    width: "31.8%",
    padding: 7,
    borderWidth: 0.5,
    borderColor: "#ded6cc",
    backgroundColor: "#faf7f2",
  },
  evidenceLabel: { color: "#776b60", fontSize: 6.5, fontWeight: "bold" },
  evidenceValue: { marginTop: 2, fontSize: 7.5 },
  snapshot: { marginTop: 6, fontSize: 6.2, color: "#5f574f" },
  clause: { marginBottom: 7 },
  clauseTitle: { marginBottom: 2, fontSize: 8.6, fontWeight: "bold" },
  clauseBody: { fontSize: 7.4, lineHeight: 1.35 },
  signatureRow: { flexDirection: "row", justifyContent: "space-between", gap: 20 },
  signatureBox: { width: "48%" },
  signatureLine: { marginTop: 18, borderTopWidth: 0.75, paddingTop: 4 },
  legalNotice: {
    marginTop: 8,
    padding: 7,
    backgroundColor: "#faf7f2",
    color: "#5f574f",
    fontSize: 6.8,
  },
});

export default function AgreementPdfDocument({ agreement }: Props) {
  const evidence = getAgreementEvidenceRows(agreement);

  return (
    <Document
      title={`Equipment Rental Agreement ${agreement.agreement_number}`}
      author="Urban Cowboy Rentals LLC"
      subject="Immutable equipment rental Agreement snapshot"
      keywords="Urban Cowboy Rentals, equipment rental, agreement"
      creator="Urban Cowboy Rentals application"
      language="en-US"
    >
      <Page size="LETTER" style={styles.page} wrap>
        <PdfBrandFooter
          documentType="Agreement"
          documentNumber={agreement.agreement_number}
        />

        <PdfBrandHeader
          documentType="Equipment Rental Agreement"
          documentNumber={agreement.agreement_number}
          status={agreement.status}
          dateLabel="Effective"
          dateValue={agreement.effective_at}
        />

        <View style={[styles.section, styles.twoColumn]}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Customer</Text>
            <Detail label="Customer type" value={formatDocumentStatus(agreement.customer_type)} />
            <Detail label="Legal name" value={agreement.customer_name} />
            {agreement.business_name && (
              <Detail label="Business" value={agreement.business_name} />
            )}
            <Detail label="Email" value={agreement.customer_email} />
            <Detail label="Phone" value={agreement.customer_phone} />
            <Detail label="Billing address" value={agreement.billing_address || "Not provided"} />
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Rental Details</Text>
            <Detail label="Rental request" value={agreement.rental_request_id} />
            <Detail label="Fulfillment" value={agreement.fulfillment_type || "Not provided"} />
            {agreement.service_address && (
              <Detail label="Service / delivery address" value={agreement.service_address} />
            )}
            <Detail label="Rental start" value={formatDocumentDate(agreement.rental_start_date)} />
            <Detail label="Rental end" value={formatDocumentDate(agreement.rental_end_date)} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equipment</Text>
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
            {agreement.items.map((item) => (
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
                <Text style={[styles.cell, styles.quantityCell]}>{item.quantity}</Text>
                <Text style={[styles.cell, styles.rateCell]}>
                  {formatDocumentCurrency(item.dailyRate)}
                </Text>
                <Text style={[styles.cell, styles.daysCell]}>{item.billableDays}</Text>
                <Text style={[styles.cell, styles.amountCell]}>
                  {formatDocumentCurrency(item.lineTotal)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Financial Summary</Text>
          <View style={styles.financials}>
            <FinancialRow label="Rental subtotal" value={agreement.quote_amount} />
            <FinancialRow label="Deposit required" value={agreement.deposit_amount} />
            <FinancialRow label="Delivery" value={agreement.delivery_fee} />
            <FinancialRow label="Sales tax" value={agreement.tax_amount} />
            <FinancialRow label="Total" value={agreement.total_amount} total />
          </View>
        </View>

        <View style={styles.section} break wrap={false}>
          <Text style={styles.sectionTitle}>Persisted Agreement Evidence</Text>
          <View style={styles.evidenceGrid}>
            {evidence.map((item) => (
              <Evidence key={item.label} label={item.label} value={item.value} />
            ))}
          </View>
          {agreement.credit_card_authorization_terms && (
            <Text style={styles.legalNotice}>
              {agreement.credit_card_authorization_terms}
            </Text>
          )}
          <Text style={styles.snapshot}>
            Current clause snapshot: {agreement.terms_version || "Not recorded"}
          </Text>
          <Text style={styles.snapshot}>
            Accepted clause snapshot: {agreement.accepted_terms_version || "Not recorded"}
          </Text>
          <Text style={styles.snapshot}>
            Current material snapshot: {agreement.current_snapshot_hash || "Not recorded"}
          </Text>
          <Text style={styles.snapshot}>
            Accepted material snapshot: {agreement.accepted_snapshot_hash || "Not recorded"}
          </Text>
          <Text style={styles.legalNotice}>{agreementEvidenceLimitation}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Terms and Conditions</Text>
          {agreement.clause_snapshot.map((clause) => (
            <View key={clause.id} style={styles.clause}>
              <Text style={styles.clauseTitle} minPresenceAhead={18}>{clause.title}</Text>
              <Text style={styles.clauseBody}>{clause.body}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.section, styles.signatureRow]} wrap={false}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLine}>Customer / Authorized Signer</Text>
            <Text>{agreement.authorized_signer_name || agreement.customer_name}</Text>
            {agreement.authorized_signer_title && <Text>{agreement.authorized_signer_title}</Text>}
            <Text>
              {formatDocumentDateTime(agreement.signed_at, "Timestamp not recorded")}
            </Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLine}>Urban Cowboy Rentals Representative</Text>
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

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.evidence}>
      <Text style={styles.evidenceLabel}>{label}</Text>
      <Text style={styles.evidenceValue}>{value}</Text>
    </View>
  );
}

function FinancialRow({
  label,
  value,
  total = false,
}: {
  label: string;
  value: number;
  total?: boolean;
}) {
  return (
    <View
      style={total ? [styles.financialRow, styles.totalRow] : styles.financialRow}
    >
      <Text style={styles.financialLabel}>{label}</Text>
      <Text style={styles.financialValue}>{formatDocumentCurrency(value)}</Text>
    </View>
  );
}
