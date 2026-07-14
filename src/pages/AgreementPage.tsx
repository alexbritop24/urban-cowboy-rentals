import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import AgreementHeader from "../components/agreement/AgreementHeader";
import CustomerSection from "../components/agreement/CustomerSection";
import EquipmentSection from "../components/agreement/EquipmentSection";
import LegalClauses from "../components/agreement/LegalClauses";
import PricingSummary from "../components/agreement/PricingSummary";
import SignatureSection from "../components/agreement/SignatureSection";
import MainLayout from "../components/layout/MainLayout";
import SEO from "../components/seo/SEO";
import PageTransition from "../components/ui/PageTransition";
import { supabase } from "../lib/supabase";
import {
  finalizeAgreement,
  getAgreementClauses,
} from "../services/agreementClauseService";
import type { RentalAgreement } from "../types/agreement";
import type { AgreementClause } from "../types/agreementClause";
import { createInvoiceFromAgreement } from "../services/invoiceService";


export default function AgreementPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [agreement, setAgreement] = useState<RentalAgreement | null>(null);
  const [clauses, setClauses] = useState<AgreementClause[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAgreement = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("rental_agreements")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("LOAD AGREEMENT ERROR:", error);
        setAgreement(null);
        setLoading(false);
        return;
      }

      const loadedAgreement = data as RentalAgreement;

      setAgreement(loadedAgreement);

      const savedSnapshot = Array.isArray(loadedAgreement.clause_snapshot)
  ? loadedAgreement.clause_snapshot
  : [];

     if (savedSnapshot.length > 0) {
       setClauses(savedSnapshot);
        } else {
        try {
          const legalClauses = await getAgreementClauses();
          setClauses(legalClauses);
        } catch (clausesError) {
          console.error("LOAD AGREEMENT CLAUSES ERROR:", clausesError);
          setClauses([]);
        }
      }

      setLoading(false);
    };

    loadAgreement();
  }, [id]);

  const updateFinancialField = async (
    field:
      | "quote_amount"
      | "deposit_amount"
      | "delivery_fee"
      | "tax_amount",
    value: number
  ) => {
    if (!agreement) return;

    if (agreement.locked_at) {
      setNotice("This agreement is finalized and cannot be edited.");
      return;
    }

    const updatedAgreement: RentalAgreement = {
      ...agreement,
      [field]: value,
    };

    const totalAmount =
      Number(updatedAgreement.quote_amount || 0) +
      Number(updatedAgreement.deposit_amount || 0) +
      Number(updatedAgreement.delivery_fee || 0) +
      Number(updatedAgreement.tax_amount || 0);

    setAgreement({
      ...updatedAgreement,
      total_amount: totalAmount,
    });

    setIsSaving(true);
    setNotice("");

    const { error } = await supabase
      .from("rental_agreements")
      .update({
        [field]: value,
        total_amount: totalAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agreement.id);

    if (error) {
      console.error("UPDATE AGREEMENT ERROR:", error);
      setNotice("Could not save the agreement.");
      setIsSaving(false);
      return;
    }

    setNotice("Agreement saved.");
    setIsSaving(false);
  };

 const handleFinalizeAgreement = async () => {
  if (!agreement) {
    setNotice("Agreement could not be found.");
    return;
  }

  if (clauses.length === 0) {
    setNotice("The agreement cannot be finalized without legal clauses.");
    return;
  }

  if (agreement.locked_at) {
    setNotice("This agreement has already been finalized.");
    return;
  }

  const confirmed = window.confirm(
    "Finalize this agreement? Pricing and legal terms will be locked for this agreement."
  );

  if (!confirmed) return;

  setIsFinalizing(true);
  setNotice("");

  try {
    const finalizedAgreement = await finalizeAgreement(
      agreement.id,
      clauses
    );

    const savedSnapshot = Array.isArray(
      finalizedAgreement.clause_snapshot
    )
      ? finalizedAgreement.clause_snapshot
      : clauses;

    setAgreement(finalizedAgreement);
    setClauses(savedSnapshot);
    setNotice("Agreement finalized and locked.");
  } catch (finalizeError) {
    console.error("FINALIZE AGREEMENT ERROR:", finalizeError);
    setNotice("Could not finalize the agreement.");
  } finally {
    setIsFinalizing(false);
  }
};

  const handleCreateInvoice = async () => {
  if (!agreement) return;

  if (!agreement.locked_at) {
    setNotice("Finalize the agreement before creating an invoice.");
    return;
  }

  try {
    const invoice = await createInvoiceFromAgreement(agreement);

    navigate(`/invoice/${invoice.id}`);
  } catch (error) {
    console.error("CREATE INVOICE ERROR:", error);
    setNotice("Could not create invoice.");
  }
};

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070604] p-10 text-[#fff7ed]">
        Loading agreement...
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className="min-h-screen bg-[#070604] p-10 text-red-400">
        Agreement not found.
      </div>
    );
  }

  return (
    <PageTransition>
      <SEO
        title={`Agreement ${agreement.agreement_number} | Urban Cowboy Rentals`}
        description="Review and manage the Urban Cowboy Rentals equipment lease agreement."
      />

      <MainLayout>
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="mb-8 rounded-xl border border-yellow-500/30 px-5 py-3 font-bold text-[#fff7ed] transition hover:border-yellow-500/60 hover:bg-yellow-500/10"
          >
            ← Back to Dashboard
          </button>

          <div className="rounded-[2rem] border border-yellow-500/20 bg-[#15110d] p-5 shadow-2xl shadow-black/30 sm:p-8">
            <div className="space-y-8">
              <AgreementHeader agreement={agreement} />

              <div className="grid gap-8 lg:grid-cols-2">
                <CustomerSection agreement={agreement} />
                <EquipmentSection agreement={agreement} />
              </div>

              <PricingSummary
                agreement={agreement}
                isSaving={isSaving}
                notice={notice}
                updateFinancialField={updateFinancialField}
              />

              <div className="flex flex-col gap-3 rounded-3xl border border-yellow-500/10 bg-black/25 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4b000]">
                    Agreement Status
                  </p>

                  <p className="mt-2 text-sm text-[#b8a99a]">
                    {agreement.locked_at
                      ? "Legal terms and pricing are locked for this agreement."
                      : "Finalize the agreement before sending it to the customer."}
                  </p>

                  {notice && (
                    <p className="mt-2 text-sm font-bold text-[#fff7ed]">
                      {notice}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleFinalizeAgreement}
                  disabled={
                    isFinalizing ||
                    Boolean(agreement.locked_at) ||
                    clauses.length === 0
                  }
                  className="rounded-full bg-[#f4b000] px-6 py-4 text-sm font-black uppercase tracking-[0.1em] text-black transition hover:bg-[#f59e0b] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {agreement.locked_at
                    ? "Agreement Finalized"
                    : isFinalizing
                      ? "Finalizing..."
                      : "Finalize Agreement"}
                </button>
              </div>

              <div className="flex flex-wrap justify-end gap-4">
  <button
    type="button"
    onClick={handleCreateInvoice}
    disabled={!agreement.locked_at}
    className="rounded-full bg-[#f4b000] px-6 py-4 text-sm font-black uppercase tracking-[0.08em] text-black transition hover:bg-[#f59e0b] disabled:cursor-not-allowed disabled:opacity-50"
  >
    Create Invoice
  </button>

  <button
    type="button"
    onClick={async () => {
      const { generateAgreementPdf } = await import(
        "../utils/generateAgreementPdf"
      );

      await generateAgreementPdf(
        agreement,
        agreement.clause_snapshot?.length
          ? agreement.clause_snapshot
          : clauses
      );
    }}
    className="rounded-full border border-yellow-500 px-6 py-4 text-sm font-black uppercase tracking-[0.08em] text-[#f4b000] transition hover:bg-yellow-500/10"
  >
    Download PDF
  </button>
</div>

              <LegalClauses clauses={clauses} />

              <SignatureSection agreement={agreement} />
            </div>
          </div>
        </section>
      </MainLayout>
    </PageTransition>
  );
}