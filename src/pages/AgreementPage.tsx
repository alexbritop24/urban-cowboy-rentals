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
import {
  finalizeRentalAgreement,
  getRentalAgreementById,
  recordRentalAgreementAcceptance,
  updateRentalAgreementFinancialField,
  type EditableAgreementFinancialField,
} from "../services/agreementService";
import { createInvoiceFromAgreement } from "../services/invoiceService";
import type { RentalAgreement } from "../types/agreement";

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export default function AgreementPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [agreement, setAgreement] = useState<RentalAgreement | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerTitle, setSignerTitle] = useState("");
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [cardAuthorizationAcknowledged, setCardAuthorizationAcknowledged] =
    useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAcceptance, setIsSavingAcceptance] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const applyAgreement = (nextAgreement: RentalAgreement) => {
    setAgreement(nextAgreement);
    setSignerName(nextAgreement.authorized_signer_name || nextAgreement.customer_name);
    setSignerTitle(nextAgreement.authorized_signer_title || "");
    setAgreementAccepted(nextAgreement.acceptance_acknowledged);
    setCardAuthorizationAcknowledged(
      nextAgreement.credit_card_authorization_acknowledged
    );
  };

  useEffect(() => {
    const loadAgreement = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const loadedAgreement = await getRentalAgreementById(id);
        if (!loadedAgreement) {
          setAgreement(null);
          return;
        }

        applyAgreement(loadedAgreement);

      } catch (error) {
        console.error("LOAD AGREEMENT ERROR:", error);
        setAgreement(null);
        setNotice(errorMessage(error, "Could not load the Agreement."));
      } finally {
        setLoading(false);
      }
    };

    void loadAgreement();
  }, [id]);

  const updateFinancialField = async (
    field: EditableAgreementFinancialField,
    value: number
  ) => {
    if (!agreement) return;

    setIsSaving(true);
    setNotice("");
    try {
      const updated = await updateRentalAgreementFinancialField(
        agreement,
        field,
        value
      );
      applyAgreement(updated);
      setNotice("Agreement saved.");
    } catch (error) {
      console.error("UPDATE AGREEMENT ERROR:", error);
      setNotice(errorMessage(error, "Could not save the Agreement."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecordAcceptance = async () => {
    if (!agreement) return;

    setIsSavingAcceptance(true);
    setNotice("");
    try {
      const updated = await recordRentalAgreementAcceptance({
        agreementId: agreement.id,
        signerLegalName: signerName,
        signerTitle: signerTitle || null,
        agreementAccepted,
        creditCardAuthorizationAcknowledged: cardAuthorizationAcknowledged,
      });
      applyAgreement(updated);
      setNotice("Agreement acceptance evidence recorded.");
    } catch (error) {
      console.error("RECORD AGREEMENT ACCEPTANCE ERROR:", error);
      setNotice(errorMessage(error, "Could not record Agreement acceptance."));
    } finally {
      setIsSavingAcceptance(false);
    }
  };

  const handleFinalizeAgreement = async () => {
    if (!agreement) return;

    const confirmed = window.confirm(
      "Finalize this Agreement? Its pricing, acceptance evidence, and legal snapshot will be locked."
    );
    if (!confirmed) return;

    setIsFinalizing(true);
    setNotice("");
    try {
      const finalized = await finalizeRentalAgreement(agreement.id);
      applyAgreement(finalized);
      setNotice("Agreement finalized and locked.");
    } catch (error) {
      console.error("FINALIZE AGREEMENT ERROR:", error);
      setNotice(errorMessage(error, "Could not finalize the Agreement."));
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!agreement) return;
    if (!agreement.locked_at) {
      setNotice("Finalize the Agreement before creating an invoice.");
      return;
    }

    setIsCreatingInvoice(true);
    setNotice("");
    try {
      const invoice = await createInvoiceFromAgreement(agreement.id);
      navigate(`/invoice/${invoice.id}`);
    } catch (error) {
      console.error("CREATE OR OPEN INVOICE ERROR:", error);
      setNotice(errorMessage(error, "Could not create or open the invoice."));
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!agreement) return;

    setIsGeneratingPdf(true);
    setNotice("");
    try {
      const { generateAgreementPdf } = await import(
        "../utils/generateAgreementPdf"
      );
      await generateAgreementPdf(agreement);
    } catch (error) {
      console.error("GENERATE AGREEMENT PDF ERROR:", error);
      setNotice(errorMessage(error, "Could not generate the Agreement PDF."));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#070604] p-10 text-[#fff7ed]">Loading agreement...</div>;
  }

  if (!agreement) {
    return <div className="min-h-screen bg-[#070604] p-10 text-red-400">Agreement not found.</div>;
  }

  const isFinalized = Boolean(agreement.locked_at);
  const isAccepted = agreement.signature_status !== "pending";
  const hasVerifiedSnapshot = agreement.snapshot_availability.status === "verified";

  return (
    <PageTransition>
      <SEO
        title={`${agreement.agreement_number} | Urban Cowboy Rentals`}
        description="Review and manage the Urban Cowboy Rentals equipment rental agreement."
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
                <section className="rounded-3xl border border-yellow-500/10 bg-black/25 p-6">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
                    Agreement Preconditions
                  </p>
                  <div className="mt-6 space-y-4 text-sm text-[#d8cfc4]">
                    <StatusRow label="Insurance verification" value={agreement.insurance_verification_status} />
                    <StatusRow label="Availability confirmation" value={agreement.availability_confirmation_status} />
                    <StatusRow label="Signature evidence" value={agreement.signature_status} />
                    <StatusRow label="Card authorization" value={agreement.credit_card_authorization_acknowledged ? "acknowledged" : "pending"} />
                  </div>
                </section>
                <EquipmentSection agreement={agreement} />
              </div>

              <PricingSummary
                agreement={agreement}
                isSaving={isSaving}
                notice={notice}
                isLocked={isFinalized || isAccepted}
                updateFinancialField={updateFinancialField}
              />

              <LegalClauses clauses={agreement.clause_snapshot} />

              {!hasVerifiedSnapshot && (
                <section className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm leading-7 text-amber-100">
                  <p className="font-black uppercase tracking-[0.12em]">
                    Immutable snapshot unavailable
                  </p>
                  <p className="mt-2">
                    {agreement.snapshot_availability.status === "missing"
                      ? agreement.snapshot_availability.reason
                      : ""} PDF generation and
                    acceptance are disabled so current legal terms are never
                    substituted into this historical Agreement.
                  </p>
                </section>
              )}

              <SignatureSection
                agreement={agreement}
                signerName={signerName}
                signerTitle={signerTitle}
                agreementAccepted={agreementAccepted}
                cardAuthorizationAcknowledged={cardAuthorizationAcknowledged}
                isSaving={isSavingAcceptance}
                onSignerNameChange={setSignerName}
                onSignerTitleChange={setSignerTitle}
                onAgreementAcceptedChange={setAgreementAccepted}
                onCardAuthorizationChange={setCardAuthorizationAcknowledged}
                onSave={handleRecordAcceptance}
              />

              <section className="rounded-3xl border border-yellow-500/10 bg-black/25 p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4b000]">Agreement Status</p>
                    <p className="mt-2 text-sm text-[#b8a99a]">
                      {isFinalized
                        ? "The Agreement snapshot is locked. The existing Invoice workflow is available."
                        : "Record acceptance evidence, then finalize the Agreement."}
                    </p>
                    {notice && <p className="mt-2 text-sm font-bold text-[#fff7ed]">{notice}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={handleFinalizeAgreement}
                    disabled={
                      isFinalized ||
                      !hasVerifiedSnapshot ||
                      isFinalizing ||
                      isSaving ||
                      isSavingAcceptance
                    }
                    className="rounded-full bg-[#f4b000] px-6 py-4 text-sm font-black uppercase tracking-[0.1em] text-black transition hover:bg-[#f59e0b] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isFinalized ? "Agreement Finalized" : isFinalizing ? "Finalizing..." : "Finalize Agreement"}
                  </button>
                </div>

                <div className="mt-6 flex flex-col gap-3 border-t border-yellow-500/10 pt-6 sm:flex-row sm:flex-wrap sm:justify-end">
                  <button
                    type="button"
                    onClick={handleCreateInvoice}
                    disabled={!isFinalized || isCreatingInvoice}
                    className="rounded-full bg-green-500 px-6 py-4 text-sm font-black uppercase tracking-[0.08em] text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCreatingInvoice ? "Opening Invoice..." : "Create / Open Invoice"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf || !hasVerifiedSnapshot}
                    className="rounded-full border border-yellow-500 px-6 py-4 text-sm font-black uppercase tracking-[0.08em] text-[#f4b000] transition hover:bg-yellow-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isGeneratingPdf ? "Generating PDF..." : "Download Agreement PDF"}
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

const StatusRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl border border-yellow-500/10 bg-black/30 px-4 py-3">
    <span>{label}</span>
    <strong className="uppercase tracking-[0.08em] text-[#fff7ed]">{value.replaceAll("_", " ")}</strong>
  </div>
);
