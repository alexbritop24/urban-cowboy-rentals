import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import InvoiceDetails from "../components/invoice/InvoiceDetails";
import InvoiceFinancialSummary from "../components/invoice/InvoiceFinancialSummary";
import InvoiceHeader from "../components/invoice/InvoiceHeader";
import MainLayout from "../components/layout/MainLayout";
import SEO from "../components/seo/SEO";
import PageTransition from "../components/ui/PageTransition";
import { supabase } from "../lib/supabase";
import { issueInvoice } from "../services/issueInvoiceService";
import { updateInvoiceField } from "../services/updateInvoiceService";
import type { Invoice } from "../types/invoice";
import PaymentSection from "../components/invoice/PaymentSection";
import PaymentHistory from "../components/invoice/PaymentHistory";

type EditableInvoiceField =
  | "subtotal"
  | "deposit_amount"
  | "delivery_fee"
  | "tax_amount";

export default function InvoicePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const loadInvoice = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("LOAD INVOICE ERROR:", error);
        setInvoice(null);
        setLoading(false);
        return;
      }

      setInvoice(data as Invoice);
      setLoading(false);
    };

    loadInvoice();
  }, [id]);

  const handleFieldChange = async (
    field: EditableInvoiceField,
    value: number
  ) => {
    if (!invoice) return;

    if (invoice.status !== "draft") {
      setNotice("Issued invoices cannot be edited.");
      return;
    }

    const optimisticInvoice: Invoice = {
      ...invoice,
      [field]: value,
    };

    const totalAmount =
      Number(optimisticInvoice.subtotal || 0) +
      Number(optimisticInvoice.deposit_amount || 0) +
      Number(optimisticInvoice.delivery_fee || 0) +
      Number(optimisticInvoice.tax_amount || 0);

    const balanceDue =
      totalAmount - Number(optimisticInvoice.amount_paid || 0);

    setInvoice({
      ...optimisticInvoice,
      total_amount: totalAmount,
      balance_due: balanceDue,
    });

    setIsSaving(true);
    setNotice("");

    try {
      const result = await updateInvoiceField(invoice.id, field, value);

      setInvoice((currentInvoice) =>
        currentInvoice
          ? {
              ...currentInvoice,
              total_amount: result.total,
              balance_due: result.balanceDue,
            }
          : currentInvoice
      );

      setNotice("Invoice saved.");
    } catch (error) {
      console.error("UPDATE INVOICE ERROR:", error);
      setNotice("Could not save the invoice.");
    } finally {
      setIsSaving(false);
    }
  };

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

  const isDraft = invoice.status === "draft";

  return (
    <PageTransition>
      <SEO
        title={`${invoice.invoice_number} | Urban Cowboy Rentals`}
        description="Review and manage the Urban Cowboy Rentals invoice."
      />

      <MainLayout>
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-8 rounded-xl border border-yellow-500/30 px-5 py-3 font-bold text-[#fff7ed] transition hover:border-yellow-500/60 hover:bg-yellow-500/10"
          >
            ← Back
          </button>

          <div className="rounded-[2rem] border border-yellow-500/20 bg-[#15110d] p-5 shadow-2xl shadow-black/30 sm:p-8">
            <div className="space-y-8">
              <InvoiceHeader invoice={invoice} />

              <InvoiceDetails invoice={invoice} />

              <InvoiceFinancialSummary
                invoice={invoice}
                isSaving={isSaving}
                notice={notice}
                onFieldChange={handleFieldChange}
              />

              <PaymentSection
               invoice={invoice}
               onInvoiceUpdated={setInvoice}
               onPaymentRecorded={() =>
               setPaymentRefreshKey((current) => current + 1)
               }
              />

              <PaymentHistory
               invoiceId={invoice.id}
               refreshKey={paymentRefreshKey}
                  />

              <section className="flex flex-col gap-4 rounded-3xl border border-yellow-500/10 bg-black/25 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4b000]">
                    Invoice Status
                  </p>

                  <p className="mt-2 text-sm text-[#b8a99a]">
                    {isDraft
                      ? "Review the charges, then issue the invoice to lock it."
                      : invoice.issued_at
                      ? `Issued on ${new Date(
                          invoice.issued_at
                        ).toLocaleString()}`
                      : "This invoice has been issued."}
                  </p>

                  {notice && (
                    <p className="mt-2 text-sm font-bold text-[#fff7ed]">
                      {notice}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleIssueInvoice}
                    disabled={!isDraft || isIssuing || isSaving}
                    className="rounded-full bg-[#f4b000] px-6 py-4 text-sm font-black uppercase tracking-[0.1em] text-black transition hover:bg-[#f59e0b] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {!isDraft
                      ? "Invoice Issued"
                      : isIssuing
                      ? "Issuing..."
                      : "Issue Invoice"}
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const { generateInvoicePdf } = await import(
                        "../utils/generateInvoicePdf"
                      );

                      await generateInvoicePdf(invoice);
                    }}
                    className="rounded-full border border-yellow-500 px-6 py-4 text-sm font-black uppercase tracking-[0.1em] text-[#f4b000] transition hover:bg-yellow-500/10"
                  >
                    Download Invoice PDF
                  </button>
                </div>
              </section>
            </div>
          </div>
        </section>
      </MainLayout>
    </PageTransition>
  );
}