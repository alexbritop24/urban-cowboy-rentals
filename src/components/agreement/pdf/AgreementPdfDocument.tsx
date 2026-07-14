import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { RentalAgreement } from "../../../types/agreement";
import type { AgreementClause } from "../../../types/agreementClause";

interface Props {
  agreement: RentalAgreement;
  clauses: AgreementClause[];
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    color: "#111827",
    fontFamily: "Helvetica",
    lineHeight: 1.5,
  },

  title: {
    fontSize: 24,
    marginBottom: 6,
    fontWeight: "bold",
  },

  subtitle: {
    color: "#666",
    marginBottom: 22,
  },

  section: {
    marginBottom: 18,
  },

  heading: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    borderBottom: 1,
    paddingBottom: 4,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  label: {
    fontWeight: "bold",
  },

  total: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "bold",
  },

  clauseTitle: {
    marginTop: 10,
    marginBottom: 3,
    fontSize: 12,
    fontWeight: "bold",
  },

  signatureRow: {
    marginTop: 35,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  signatureBox: {
    width: "45%",
  },

  signatureLine: {
    marginTop: 35,
    borderTop: 1,
    paddingTop: 5,
  },
});

export default function AgreementPdfDocument({
  agreement,
  clauses,
}: Props) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>
          Urban Cowboy Rentals
        </Text>

        <Text style={styles.subtitle}>
          Equipment Rental Agreement
        </Text>

        <View style={styles.section}>
          <Text style={styles.heading}>
            Customer Information
          </Text>

          <Text>{agreement.customer_name}</Text>
          <Text>{agreement.customer_email}</Text>
          <Text>{agreement.customer_phone}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>
            Equipment Information
          </Text>

          <Text>{agreement.equipment_requested}</Text>

          <Text>
            {agreement.rental_start_date} → {agreement.rental_end_date}
          </Text>

          <Text>{agreement.rental_duration}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>
            Pricing
          </Text>

          <View style={styles.row}>
            <Text>Rental</Text>
            <Text>${agreement.quote_amount}</Text>
          </View>

          <View style={styles.row}>
            <Text>Deposit</Text>
            <Text>${agreement.deposit_amount}</Text>
          </View>

          <View style={styles.row}>
            <Text>Delivery</Text>
            <Text>${agreement.delivery_fee}</Text>
          </View>

          <View style={styles.row}>
            <Text>Sales Tax</Text>
            <Text>${agreement.tax_amount}</Text>
          </View>

          <Text style={styles.total}>
            Total: ${agreement.total_amount}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>
            Terms & Conditions
          </Text>

          {clauses.map((clause) => (
            <View key={clause.id}>
              <Text style={styles.clauseTitle}>
                {clause.title}
              </Text>

              <Text>{clause.body}</Text>
            </View>
          ))}
        </View>

        <View style={styles.signatureRow}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLine}>
              Customer Signature
            </Text>
          </View>

          <View style={styles.signatureBox}>
            <Text style={styles.signatureLine}>
              Urban Cowboy Rentals
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}