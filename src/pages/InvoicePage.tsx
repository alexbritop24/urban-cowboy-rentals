import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import InvoiceDetails from "../components/invoice/InvoiceDetails";
import InvoiceFinancialSummary from "../components/invoice/InvoiceFinancialSummary";
import InvoiceHeader from "../components/invoice/InvoiceHeader";
import InvoiceItemsTable from "../components/invoice/InvoiceItemsTable";
import InvoiceDocumentActions from "../components/invoice/InvoiceDocumentActions";
import MainLayout from "../components/layout/MainLayout";
import SEO from "../components/seo/SEO";
import PageTransition from "../components/ui/PageTransition";
import { getInvoiceById, issueInvoice } from "../services/invoiceService";
import type { Invoice } from "../types/invoice";
import PaymentSection from "../components/invoice/PaymentSection";
import PaymentHistory from "../components/invoice/PaymentHistory";
import DocumentBrandFooter from "../components/document/DocumentBrandFooter";
import DocumentPrintBoundary from "../components/document/DocumentPrintBoundary";
import {
  getInvoicePrintReadiness,
  loadingPaymentHistoryState,
  type PaymentHistoryLoadState,
} from "../utils/documentPresentation";

export default function InvoicePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [isIssuing, setIsIssuing] = useState(false);
  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0);
  const [paymentHistoryState, setPaymentHistoryState] =
    useState<PaymentHistoryLoadState>(loadingPaymentHistoryState);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const loadInvoice = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const data = await getInvoiceById(id);
        setInvoice(data);
      } catch (error) {
        console.error("LOAD INVOICE ERROR:", error);
        setInvoice(null);
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [id]);

  const handleIssueInvoice = async () => {
    if (!invoice) return;

    if (invoice.status !== "draft") {
      setNotice("This invoice has already been issued.");
      return;
    }

    const confirmed = window.confirm(
      "Issue this invoice? Financial fields will become read-only."
    );

    if (!confirmed) return;

    setIsIssuing(true);
    setNotice("");

    try {
      const issuedInvoice = await issueInvoice(invoice.id);

      setInvoice(issuedInvoice as Invoice);
      setNotice("Invoice issued successfully.");
    } catch (error) {
      console.error("ISSUE INVOICE ERROR:", error);
      setNotice("Could not issue the invoice.");
    } finally {
      setIsIssuing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070604] p-10 text-[#fff7ed]">
        Loading invoice...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-[#070604] p-10 text-red-400">
        Invoice not found.
      </div>
    );
  }

  const printReadiness = getInvoicePrintReadiness(paymentHistoryState);

  return (
    <PageTransition>
      <SEO
        title={`${invoice.invoice_number} | Urban Cowboy Rentals`}
        description="Review and manage the Urban Cowboy Rentals invoice."
      />

      <MainLayout>
        <DocumentPrintBoundary
          className="document-route mx-auto max-w-6xl px-4 py-20 sm:px-6"
          documentType="Invoice"
          readiness={printReadiness}
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="document-no-print mb-8 rounded-xl border border-yellow-500/30 px-5 py-3 font-bold text-[#fff7ed] transition hover:border-yellow-500/60 hover:bg-yellow-500/10"
          >
            ← Back
          </button>

          <article className="document-page rounded-[2rem] border border-yellow-500/20 bg-[#15110d] p-5 shadow-2xl shadow-black/30 sm:p-8">
            <div className="space-y-8">
              <InvoiceHeader invoice={invoice} />

              <InvoiceDetails invoice={invoice} />

              <InvoiceItemsTable invoice={invoice} />

              <InvoiceFinancialSummary invoice={invoice} />

              <PaymentSection
                invoice={invoice}
                onInvoiceUpdated={setInvoice}
                onPaymentRecorded={() => {
                  setPaymentHistoryState(loadingPaymentHistoryState);
                  setPaymentRefreshKey((current) => current + 1);
                }}
              />

              <PaymentHistory
                invoiceId={invoice.id}
                refreshKey={paymentRefreshKey}
                onStateChange={setPaymentHistoryState}
              />

              <InvoiceDocumentActions
                invoice={invoice}
                isIssuing={isIssuing}
                notice={notice}
                onDownloadPdf={async () => {
                  const { generateInvoicePdf } = await import(
                    "../utils/generateInvoicePdf"
                  );
                  await generateInvoicePdf(invoice);
                }}
                onIssue={handleIssueInvoice}
                onPrint={() => window.print()}
                paymentHistoryState={paymentHistoryState}
              />

              <DocumentBrandFooter
                documentType="Invoice"
                documentNumber={invoice.invoice_number}
              />
            </div>
          </article>
        </DocumentPrintBoundary>
      </MainLayout>
    </PageTransition>
  );
}
