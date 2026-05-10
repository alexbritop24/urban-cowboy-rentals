import MainLayout from "../components/layout/MainLayout";
import PageTransition from "../components/ui/PageTransition";
import SEO from "../components/seo/SEO";
import CTASection from "../components/ui/CTASection";

import { rentalPolicies } from "../data/policyData";

const PoliciesPage = () => {
  return (
    <PageTransition>
      <SEO
        title="Rental Policies | Urban Cowboy Rentals"
        description="Review rental request, payment, deposit, pickup, delivery, and equipment responsibility information for Urban Cowboy Rentals."
      />

      <MainLayout>
        <section className="px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
              Rental Policies
            </p>

            <h1 className="mt-5 max-w-5xl text-5xl font-black tracking-tight text-[#fff7ed] md:text-7xl">
              Clear rental expectations before approval.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#b8a99a]">
              These policy sections are placeholders and should be finalized
              with Urban Cowboy Rentals before accepting live payments or
              confirmed bookings.
            </p>

            <div className="mt-14 grid gap-5 md:grid-cols-2">
              {rentalPolicies.map((policy) => (
                <div
                  key={policy.title}
                  className="industrial-card rounded-[2rem] p-7"
                >
                  <h2 className="text-2xl font-black text-[#fff7ed]">
                    {policy.title}
                  </h2>

                  <p className="mt-4 leading-relaxed text-[#b8a99a]">
                    {policy.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CTASection
          eyebrow="Need confirmation?"
          title="Submit your rental request and confirm final terms."
          description="Urban Cowboy Rentals will review your equipment, dates, pickup or delivery needs, and payment requirements before approval."
        />
      </MainLayout>
    </PageTransition>
  );
};

export default PoliciesPage;