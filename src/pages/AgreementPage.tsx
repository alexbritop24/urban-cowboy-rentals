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

              <section className="rounded-3xl border border-yellow-500/10 bg-black/25 p-6">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
                      Pricing
                    </p>

                    <h2 className="mt-2 text-2xl font-black text-[#fff7ed]">
                      Agreement charges
                    </h2>
                  </div>

                  <p className="text-sm font-bold text-[#8f8577]">
                    {isSaving ? "Saving..." : notice}
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
                      Quote Amount
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={agreement.quote_amount ?? 0}
                      onChange={(event) =>
                        updateFinancialField(
                          "quote_amount",
                          Number(event.target.value) || 0
                        )
                      }
                      className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
                      Deposit
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={agreement.deposit_amount}
                      onChange={(event) =>
                        updateFinancialField(
                          "deposit_amount",
                          Number(event.target.value) || 0
                        )
                      }
                      className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
                      Delivery Fee
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={agreement.delivery_fee}
                      onChange={(event) =>
                        updateFinancialField(
                          "delivery_fee",
                          Number(event.target.value) || 0
                        )
                      }
                      className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
                      Tax
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={agreement.tax_amount}
                      onChange={(event) =>
                        updateFinancialField(
                          "tax_amount",
                          Number(event.target.value) || 0
                        )
                      }
                      className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-yellow-500/20 bg-[#f4b000]/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-lg font-black uppercase tracking-[0.08em] text-[#fff7ed]">
                    Total
                  </span>

                  <span className="text-3xl font-black text-[#f4b000]">
                    ${Number(agreement.total_amount || 0).toFixed(2)}
                  </span>
                </div>
              </section>
            </div>
          </div>
        </section>
      </MainLayout>
    </PageTransition>
  );
}