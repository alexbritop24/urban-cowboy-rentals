import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { Invoice } from "../../../types/invoice";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 12,
    fontFamily: "Helvetica",
    lineHeight: 1.6,
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 14,
    marginBottom: 30,
    color: "#555",
  },

  section: {
    marginBottom: 24,
  },

  heading: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  total: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: "bold",
  },

  footer: {
    marginTop: 40,
    fontSize: 10,
    color: "#777",
  },
});

type Props = {
  invoice: Invoice;
};

export default function InvoicePdfDocument({ invoice }: Props) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Urban Cowboy Rentals</Text>

        <Text style={styles.subtitle}>
          Equipment Rental Invoice
        </Text>

        <View style={styles.section}>
          <Text style={styles.heading}>Invoice Information</Text>

          <Text>Invoice #: {invoice.invoice_number}</Text>

          <Text>Status: {invoice.status}</Text>

          <Text>
            Date:
            {" "}
            {invoice.issued_at
              ? new Date(invoice.issued_at).toLocaleDateString()
              : "Draft"}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Charges</Text>

          <View style={styles.row}>
            <Text>Rental</Text>
            <Text>${invoice.subtotal}</Text>
          </View>

          <View style={styles.row}>
            <Text>Deposit</Text>
            <Text>${invoice.deposit_amount}</Text>
          </View>

          <View style={styles.row}>
            <Text>Delivery</Text>
            <Text>${invoice.delivery_fee}</Text>
          </View>

          <View style={styles.row}>
            <Text>Sales Tax</Text>
            <Text>${invoice.tax_amount}</Text>
          </View>

          <Text style={styles.total}>
            Total: ${invoice.total_amount}
          </Text>

          <Text>
            Paid: ${invoice.amount_paid}
          </Text>

          <Text>
            Balance Due: ${invoice.balance_due}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text>
            Thank you for choosing Urban Cowboy Rentals.
          </Text>
        </View>
      </Page>
    </Document>
  );
}