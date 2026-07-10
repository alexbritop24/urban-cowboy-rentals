import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import MainLayout from "../components/layout/MainLayout";
import PageTransition from "../components/ui/PageTransition";
import SEO from "../components/seo/SEO";
import { supabase } from "../lib/supabase";

export default function AgreementPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [agreement, setAgreement] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAgreement = async () => {
      if (!id) return;

      const { data, error } = await supabase
        .from("rental_agreements")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
      }

      setAgreement(data);
      setLoading(false);
    };

    loadAgreement();
  }, [id]);

  if (loading) {
    return <p className="p-10 text-white">Loading agreement...</p>;
  }

  if (!agreement) {
    return <p className="p-10 text-red-400">Agreement not found.</p>;
  }

  return (
    <PageTransition>
      <SEO
        title={`Agreement ${agreement.agreement_number}`}
        description="Rental agreement"
      />

      <MainLayout>
        <section className="mx-auto max-w-6xl px-6 py-20">

          <button
            onClick={() => navigate("/admin")}
            className="mb-8 rounded-xl border border-yellow-500/30 px-5 py-3 text-white"
          >
            ← Back to Dashboard
          </button>

          <div className="rounded-3xl border border-yellow-500/20 bg-[#15110d] p-8">

            <h1 className="text-4xl font-black text-white">
              {agreement.agreement_number}
            </h1>

            <p className="mt-2 text-yellow-400 uppercase">
              {agreement.status}
            </p>

            <div className="mt-10 grid gap-8 md:grid-cols-2">

              <div>
                <h2 className="mb-4 text-xl font-bold text-white">
                  Customer
                </h2>

                <p>{agreement.customer_name}</p>
                <p>{agreement.customer_email}</p>
                <p>{agreement.customer_phone}</p>
              </div>

              <div>
                <h2 className="mb-4 text-xl font-bold text-white">
                  Rental
                </h2>

                <p>{agreement.equipment_requested}</p>
                <p>
                  {agreement.rental_start_date} →{" "}
                  {agreement.rental_end_date}
                </p>

                <p>{agreement.rental_duration}</p>
              </div>

            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2">

              <div>
                Quote
              </div>

              <div>
                ${agreement.quote_amount}
              </div>

              <div>
                Deposit
              </div>

              <div>
                ${agreement.deposit_amount}
              </div>

              <div>
                Delivery
              </div>

              <div>
                ${agreement.delivery_fee}
              </div>

              <div>
                Tax
              </div>

              <div>
                ${agreement.tax_amount}
              </div>

              <div className="font-bold text-xl">
                Total
              </div>

              <div className="font-bold text-xl">
                ${agreement.total_amount}
              </div>

            </div>

          </div>

        </section>
      </MainLayout>
    </PageTransition>
  );
}