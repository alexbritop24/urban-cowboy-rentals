import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";

import logo from "../../../assets/urban-cowboy-logo.jpeg";
import {
  formatDocumentDate,
  formatDocumentStatus,
  urbanCowboyDocumentBrand,
} from "../../../utils/documentPresentation";

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1.5,
    borderBottomColor: "#b7791f",
    paddingBottom: 12,
    marginBottom: 16,
  },
  identity: { flexDirection: "row", alignItems: "flex-start", width: "62%" },
  logo: { width: 58, height: 58, objectFit: "contain", marginRight: 10 },
  company: { flexGrow: 1 },
  companyName: { fontSize: 13, fontWeight: "bold", color: "#211d18" },
  contact: { marginTop: 3, fontSize: 7.5, lineHeight: 1.35, color: "#5f574f" },
  metadata: { width: "37%", alignItems: "flex-end" },
  documentType: {
    fontSize: 13.5,
    lineHeight: 1.15,
    fontWeight: "bold",
    textAlign: "right",
  },
  documentNumber: { marginTop: 3, fontSize: 9.5, fontWeight: "bold" },
  status: {
    marginTop: 6,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderWidth: 0.75,
    borderColor: "#b7791f",
    backgroundColor: "#fff8e7",
    color: "#7a4d00",
    fontSize: 7.5,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  date: { marginTop: 5, fontSize: 7.5, color: "#5f574f" },
  footer: {
    position: "absolute",
    left: 32,
    right: 88,
    top: 752,
    height: 18,
    paddingTop: 6,
    borderTopWidth: 0.75,
    borderTopColor: "#d7c9b8",
    fontSize: 6.2,
    color: "#6f665c",
  },
  pageNumber: {
    position: "absolute",
    right: 32,
    top: 759,
    width: 56,
    fontSize: 6.8,
    color: "#6f665c",
    textAlign: "right",
  },
});

interface PdfBrandHeaderProps {
  documentType: string;
  documentNumber: string;
  status: string;
  dateLabel: string;
  dateValue: string | null | undefined;
}

export function PdfBrandHeader({
  documentType,
  documentNumber,
  status,
  dateLabel,
  dateValue,
}: PdfBrandHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.identity}>
        <Image src={logo} style={styles.logo} />
        <View style={styles.company}>
          <Text style={styles.companyName}>{urbanCowboyDocumentBrand.legalName}</Text>
          <Text style={styles.contact}>{urbanCowboyDocumentBrand.streetAddress}</Text>
          <Text style={styles.contact}>{urbanCowboyDocumentBrand.locality}</Text>
          <Text style={styles.contact}>
            {urbanCowboyDocumentBrand.phone} · {urbanCowboyDocumentBrand.email}
          </Text>
        </View>
      </View>
      <View style={styles.metadata}>
        <Text style={styles.documentType}>{documentType}</Text>
        <Text style={styles.documentNumber}>{documentNumber}</Text>
        <Text style={styles.status}>{formatDocumentStatus(status)}</Text>
        <Text style={styles.date}>
          {dateLabel}: {formatDocumentDate(dateValue)}
        </Text>
      </View>
    </View>
  );
}

interface PdfBrandFooterProps {
  documentType: "Agreement" | "Invoice";
  documentNumber: string;
}

export function PdfBrandFooter({
  documentType,
  documentNumber,
}: PdfBrandFooterProps) {
  return (
    <>
      <Text style={styles.footer} fixed>
        {`${urbanCowboyDocumentBrand.legalName} · ${documentType} ${documentNumber} · ${urbanCowboyDocumentBrand.phone} · ${urbanCowboyDocumentBrand.email}`}
      </Text>
      <Text
        style={styles.pageNumber}
        fixed
        render={({ pageNumber }) => `${pageNumber}`}
      />
    </>
  );
}
