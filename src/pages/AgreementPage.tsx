import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import AgreementHeader from "../components/agreement/AgreementHeader";
import CustomerSection from "../components/agreement/CustomerSection";
import EquipmentSection from "../components/agreement/EquipmentSection";
import MainLayout from "../components/layout/MainLayout";
import SEO from "../components/seo/SEO";
import PageTransition from "../components/ui/PageTransition";
import { supabase } from "../lib/supabase";
import type { RentalAgreement } from "../types/agreement";
import PricingSummary from "../components/agreement/PricingSummary";
import TermsSection from "../components/agreement/TermsSection";

export default function AgreementPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [agreement, setAgreement] = useState<RentalAgreement | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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

      setAgreement(data);
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
    } else {
      setNotice("Agreement saved.");
    }

    setIsSaving(false);
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

                <TermsSection /> 

        
                </div>
                 </div>
               </section>
              </MainLayout>
             </PageTransition>
  );
  
}