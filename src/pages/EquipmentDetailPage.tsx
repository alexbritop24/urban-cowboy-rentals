import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle, Phone } from "lucide-react";
import { motion } from "framer-motion";


import MainLayout from "../components/layout/MainLayout";
import PricingTable from "../components/equipment/PricingTable";
import CTASection from "../components/ui/CTASection";
import PageTransition from "../components/ui/PageTransition";
import SEO from "../components/seo/SEO";

import { equipmentData } from "../data/equipmentData";

const EquipmentDetailPage = () => {
  const { id } = useParams();

  const equipment = equipmentData.find((item) => item.id === id);

  if (!equipment) {
    return (
      <PageTransition>
         <SEO title="Urban Cowboy Rentals | Premium Equipment Rentals"
      description="Rent heavy equipment, trailers, tools, and motorcycles from Urban Cowboy Rentals, LLC."
      />
      <MainLayout>
        <section className="px-6 py-32 text-center">
          <h1 className="text-4xl font-black text-[#fff7ed]">
            Equipment Not Found
          </h1>

          <Link
            to="/equipment"
            className="mt-8 inline-block rounded-full bg-[#f4b000] px-7 py-4 font-black uppercase tracking-[0.08em] text-black"
          >
            Back to Equipment
          </Link>
        </section>
      </MainLayout>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
    <MainLayout>
      <section className="relative overflow-hidden px-6 py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(244,176,0,0.12),transparent_30%)]" />

        <div className="mx-auto max-w-7xl">
          <Link
            to="/equipment"
            className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-[#b8a99a] transition hover:text-[#f4b000]"
          >
            <ArrowLeft size={18} />
            Back to Equipment
          </Link>

          <div className="mt-10 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative h-[520px] overflow-hidden rounded-[2rem] border border-yellow-500/10 bg-[#050402]">
  <img
    src={equipment.image}
    alt={equipment.name}
    className={
      equipment.id === "kobalt-hand-tamper"
        ? "h-full w-full object-contain bg-[#050402]"
        : "h-full w-full object-cover"
    }
  />

  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/20" />

  <div className="absolute left-6 top-6 rounded-full bg-black/60 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#f4b000] backdrop-blur-xl">
    {equipment.category}
  </div>
</div>

              <div className="mt-8 grid gap-5 md:grid-cols-2">
                <div className="industrial-card rounded-[2rem] p-7">
                  <p className="text-sm font-black uppercase tracking-[0.25em] text-[#f4b000]">
                    Category
                  </p>

                  <p className="mt-4 text-2xl font-black text-[#fff7ed]">
                    {equipment.category}
                  </p>
                </div>

                <div className="industrial-card rounded-[2rem] p-7">
                  <p className="text-sm font-black uppercase tracking-[0.25em] text-[#f4b000]">
                    Starting At
                  </p>

                  <p className="mt-4 text-4xl font-black text-[#fff7ed]">
                    ${equipment.startingPrice}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.aside
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.12,
                duration: 0.65,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="lg:sticky lg:top-36"
            >
              <div className="industrial-card rounded-[2.5rem] p-8">
                <p className="w-fit rounded-full border border-yellow-500/20 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#f4b000]">
                  {equipment.category}
                </p>

                <h1 className="mt-6 text-5xl font-black leading-[1.02] tracking-tight text-[#fff7ed]">
                  {equipment.name}
                </h1>

                <p className="mt-6 text-lg leading-relaxed text-[#b8a99a]">
                  {equipment.description}
                </p>

                <div className="mt-8 rounded-[2rem] border border-yellow-500/10 bg-black/30 p-6">
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-[#8f8577]">
                    Starting Rental Price
                  </p>

                  <p className="mt-3 text-5xl font-black text-[#f4b000]">
                    ${equipment.startingPrice}
                  </p>

                  <p className="mt-2 text-sm text-[#b8a99a]">
                    Final price depends on selected duration, availability,
                    pickup/delivery, deposits, and confirmed terms.
                  </p>
                </div>

                <div className="mt-8 grid gap-3">
                  <Link
                    to={`/book?equipment=${equipment.id}`}
                    className="rounded-full bg-[#f4b000] px-8 py-5 text-center font-black uppercase tracking-[0.1em] text-black transition hover:scale-[1.02] hover:bg-[#f59e0b]"
                  >
                    Request This Rental
                  </Link>

                  <a
                    href="tel:8019039380"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-yellow-500/20 bg-[#1a1612] px-8 py-5 text-center font-black uppercase tracking-[0.1em] text-[#fff7ed] transition hover:border-yellow-500/50"
                  >
                    <Phone size={18} />
                    Call Now
                  </a>
                </div>
              </div>
            </motion.aside>
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
              Equipment Specs
            </p>

            <h2 className="mt-5 text-5xl font-black tracking-tight text-[#fff7ed]">
              Built details for informed rentals.
            </h2>

            <p className="mt-6 text-lg leading-relaxed text-[#b8a99a]">
              Review core specifications before submitting your rental request.
            </p>
          </div>

          <div className="grid gap-4">
            {equipment.specs.map((spec) => (
              <div
                key={spec}
                className="industrial-card flex items-start gap-4 rounded-2xl p-5"
              >
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#f4b000]" />

                <span className="text-[#fff7ed]">{spec}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {equipment.addOns && (
        <section className="px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
                Optional Add-ons
              </p>

              <h2 className="mt-5 text-5xl font-black tracking-tight text-[#fff7ed]">
                Attachments available for this rental.
              </h2>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {equipment.addOns.map((addon) => (
                <div
                  key={addon}
                  className="industrial-card rounded-[2rem] p-7 text-[#fff7ed]"
                >
                  {addon}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
              Pricing
            </p>

            <h2 className="mt-5 text-5xl font-black tracking-tight text-[#fff7ed]">
              Rental rates by duration.
            </h2>
          </div>

          <PricingTable rates={equipment.rates} />
        </div>
      </section>

      <CTASection
        eyebrow="Request this rental"
        title={`Ready to rent the ${equipment.name}?`}
        description="Submit a request with your preferred dates and Urban Cowboy Rentals will confirm availability, pricing, and next steps."
        primaryLabel="Request Rental"
        primaryHref={`/book?equipment=${equipment.id}`}
        secondaryLabel="View All Equipment"
        secondaryHref="/equipment"
      />
    </MainLayout>
    </PageTransition>
  );
};

export default EquipmentDetailPage;