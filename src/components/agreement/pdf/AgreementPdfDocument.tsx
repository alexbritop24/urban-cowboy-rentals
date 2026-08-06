import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { RentalAgreement } from "../../../types/agreement";
interface Props {
  agreement: RentalAgreement;
}

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 9,
    color: "#111827",
    fontFamily: "Helvetica",
    lineHeight: 1.45,
  },
  title: { fontSize: 22, marginBottom: 4, fontWeight: "bold" },
  subtitle: { color: "#666", marginBottom: 18 },
  section: { marginBottom: 15 },
  heading: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 6,
    borderBottom: 1,
    paddingBottom: 3,
  },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  label: { fontWeight: "bold" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottom: 1,
    paddingVertical: 4,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: 0.5,
    borderBottomColor: "#d1d5db",
    paddingVertical: 5,
  },
  equipment: { width: "24%", paddingRight: 4 },
  serial: { width: "15%", paddingRight: 4 },
  dates: { width: "23%", paddingRight: 4 },
  numeric: { width: "9%", textAlign: "right", paddingRight: 3 },
  lineTotal: { width: "11%", textAlign: "right" },
  notes: { marginTop: 2, color: "#4b5563", fontSize: 8 },
  total: { marginTop: 8, fontSize: 14, fontWeight: "bold" },
  clauseTitle: { marginTop: 8, marginBottom: 2, fontSize: 10, fontWeight: "bold" },
  evidence: { backgroundColor: "#f9fafb", padding: 8, marginBottom: 4 },
  signatureRow: { marginTop: 22, flexDirection: "row", justifyContent: "space-between" },
  signatureBox: { width: "47%" },
  signatureLine: { marginTop: 26, borderTop: 1, paddingTop: 4 },
  footer: { marginTop: 12, color: "#6b7280", fontSize: 7 },
});

const money = (value: number) => `$${Number(value || 0).toFixed(2)}`;

export default function AgreementPdfDocument({ agreement }: Props) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        <Text style={styles.title}>Urban Cowboy Rentals</Text>
        <Text style={styles.subtitle}>
          Equipment Rental Agreement · {agreement.agreement_number} · {agreement.status}
        </Text>

        <View style={styles.section}>
          <Text style={styles.heading}>Customer Information</Text>
          <View style={styles.row}><Text style={styles.label}>Type</Text><Text>{agreement.customer_type}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Legal name</Text><Text>{agreement.customer_name}</Text></View>
          {agreement.business_name && <View style={styles.row}><Text style={styles.label}>Business</Text><Text>{agreement.business_name}</Text></View>}
          <View style={styles.row}><Text style={styles.label}>Email</Text><Text>{agreement.customer_email}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Phone</Text><Text>{agreement.customer_phone}</Text></View>
          {agreement.billing_address && <View style={styles.row}><Text style={styles.label}>Billing address</Text><Text>{agreement.billing_address}</Text></View>}
          {agreement.service_address && <View style={styles.row}><Text style={styles.label}>Service address</Text><Text>{agreement.service_address}</Text></View>}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Agreement Items</Text>
          <View style={styles.tableHeader} fixed>
            <Text style={styles.equipment}>Equipment</Text>
            <Text style={styles.serial}>Serial</Text>
            <Text style={styles.dates}>Rental period</Text>
            <Text style={styles.numeric}>Qty</Text>
            <Text style={styles.numeric}>Rate</Text>
            <Text style={styles.numeric}>Days</Text>
            <Text style={styles.lineTotal}>Total</Text>
          </View>
          {agreement.items.map((item) => (
            <View key={item.id} style={styles.tableRow} wrap={false}>
              <View style={styles.equipment}>
                <Text>{item.equipmentName}</Text>
                {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
              </View>
              <Text style={styles.serial}>{item.serialNumber || "—"}</Text>
              <Text style={styles.dates}>{item.startDate} – {item.endDate}</Text>
              <Text style={styles.numeric}>{item.quantity}</Text>
              <Text style={styles.numeric}>{money(item.dailyRate)}</Text>
              <Text style={styles.numeric}>{item.billableDays}</Text>
              <Text style={styles.lineTotal}>{money(item.lineTotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.heading}>Pricing</Text>
          <View style={styles.row}><Text>Item subtotal</Text><Text>{money(agreement.quote_amount)}</Text></View>
          <View style={styles.row}><Text>Deposit</Text><Text>{money(agreement.deposit_amount)}</Text></View>
          <View style={styles.row}><Text>Delivery</Text><Text>{money(agreement.delivery_fee)}</Text></View>
          <View style={styles.row}><Text>Sales tax</Text><Text>{money(agreement.tax_amount)}</Text></View>
          <Text style={styles.total}>Total: {money(agreement.total_amount)}</Text>
        </View>

        <View style={styles.section} wrap={false}>
          <Text style={styles.heading}>Verification and Acceptance</Text>
          <Text style={styles.evidence}>Insurance verification: {agreement.insurance_verification_status}</Text>
          <Text style={styles.evidence}>Availability confirmation: {agreement.availability_confirmation_status}</Text>
          <Text style={styles.evidence}>Credit-card authorization acknowledgment: {agreement.credit_card_authorization_acknowledged ? "Acknowledged" : "Pending"}</Text>
          <Text style={styles.evidence}>Credit-card authorization terms: {agreement.credit_card_authorization_terms}</Text>
          <Text style={styles.evidence}>Signature evidence: {agreement.signature_status}</Text>
          <Text style={styles.evidence}>Signer: {agreement.authorized_signer_name || "Not recorded"}</Text>
          <Text style={styles.evidence}>Clause snapshot: {agreement.terms_version}</Text>
          <Text style={styles.evidence}>Material snapshot: {agreement.accepted_snapshot_hash || agreement.current_snapshot_hash}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Terms &amp; Conditions</Text>
          {agreement.clause_snapshot.map((clause) => (
            <View key={clause.id} wrap={false}>
              <Text style={styles.clauseTitle}>{clause.title}</Text>
              <Text>{clause.body}</Text>
            </View>
          ))}
        </View>

        <View style={styles.signatureRow} wrap={false}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLine}>Customer / Authorized Signer</Text>
            <Text>{agreement.authorized_signer_name || agreement.customer_name}</Text>
            <Text>{agreement.signed_at ? new Date(agreement.signed_at).toLocaleString() : "Date: __________"}</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLine}>Urban Cowboy Rentals Representative</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          This PDF renders from the Agreement’s stored legal and item snapshots. Browser-generated PDFs remain an interim Release 1 artifact.
        </Text>
      </Page>
    </Document>
  );
}
