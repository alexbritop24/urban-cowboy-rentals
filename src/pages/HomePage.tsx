import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import MainLayout from "../components/layout/MainLayout";

import EquipmentGrid from "../components/equipment/EquipmentGrid";

import CTASection from "../components/ui/CTASection";
import ContactSection from "../components/ui/ContactSection";
import PageReveal from "../components/ui/PageReveal";

import { equipmentData } from "../data/equipmentData";

const categories = [
  "Heavy Equipment",
  "Trailers",
  "Tools",
  "Motorcycles",
];

const steps = [
  {
    number: "01",
    title: "Choose Equipment",
    description:
      "Browse premium heavy equipment, trailers, tools, and motorcycles.",
  },
  {
    number: "02",
    title: "Select Dates",
    description:
      "Choose rental duration, pickup, or delivery preferences.",
  },
  {
    number: "03",
    title: "Submit Request",
    description:
      "Send your rental inquiry through the online request flow.",
  },
  {
    number: "04",
    title: "Confirm Rental",
    description:
      "Urban Cowboy Rentals confirms availability and next steps.",
  },
];

const featuredEquipment = equipmentData.filter(
  (item) => item.featured
);

const HomePage = () => {
  return (
    <MainLayout>
      {/* HERO */}

      <section className="relative overflow-hidden px-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(244,176,0,0.14),transparent_30%)]" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(127,29,29,0.12),transparent_32%)]" />

        <div className="mx-auto grid min-h-screen max-w-7xl gap-20 py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <PageReveal>
            <div>
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 1, scaleX: 1 }}
                transition={{ duration: 1 }}
                className="gold-line mb-10 origin-left"
              />

              <p className="text-sm font-black uppercase tracking-[0.5em] text-[#f4b000]">
                Urban Cowboy Rentals
              </p>

              <h1 className="mt-8 max-w-5xl text-6xl font-black leading-[0.95] tracking-[-0.04em] text-[#fff7ed] md:text-8xl">
                Rugged Equipment.
                <span className="text-industrial-gradient">
                  {" "}
                  Modern Rental Experience.
                </span>
              </h1>

              <p className="mt-8 max-w-2xl text-xl leading-relaxed text-[#b8a99a]">
                Premium equipment rentals built for construction,
                hauling, demolition, transport, and open-road adventure.
              </p>

              <div className="mt-12 flex flex-col gap-4 sm:flex-row">
                <Link
                  to="/equipment"
                  className="rounded-full bg-[#f4b000] px-9 py-5 text-center text-sm font-black uppercase tracking-[0.12em] text-black transition duration-300 hover:scale-[1.03] hover:bg-[#f59e0b] hover:shadow-2xl hover:shadow-yellow-500/20"
                >
                  View Equipment
                </Link>

                <Link
                  to="/book"
                  className="rounded-full border border-yellow-500/20 bg-[#11100d]/70 px-9 py-5 text-center text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed] transition duration-300 hover:border-yellow-500/50 hover:bg-[#1a1612]"
                >
                  Request Rental
                </Link>
              </div>

              <div className="mt-16 grid grid-cols-2 gap-5 md:grid-cols-4">
                {[
                  "Fast Approval",
                  "Flexible Rates",
                  "Delivery Available",
                  "Reliable Fleet",
                ].map((item, index) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.2 + index * 0.08,
                      duration: 0.5,
                    }}
                    className="industrial-card rounded-2xl p-5"
                  >
                    <p className="text-sm font-black uppercase tracking-[0.08em] text-[#fff7ed]">
                      {item}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </PageReveal>

          {/* RIGHT HERO PANEL */}

          <PageReveal delay={0.15}>
            <div className="relative">
              <div className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-[#f4b000]/10 blur-3xl" />

              <div className="absolute -bottom-12 -right-10 h-64 w-64 rounded-full bg-[#7f1d1d]/10 blur-3xl" />

              <div className="industrial-card relative overflow-hidden rounded-[2.5rem] p-8">
                <div className="flex h-[540px] items-center justify-center rounded-[2rem] border border-yellow-500/10 bg-gradient-to-br from-[#1a1612] to-[#070604]">
                  <div className="text-center">
                    <p className="text-sm font-black uppercase tracking-[0.4em] text-[#f4b000]/70">
                      Premium Fleet
                    </p>

                    <h3 className="mt-6 text-4xl font-black text-[#fff7ed]">
                      Equipment Images
                      <br />
                      Coming Soon
                    </h3>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4">
                  {categories.map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-yellow-500/10 bg-[#1a1612] p-5 transition duration-300 hover:border-yellow-500/40"
                    >
                      <p className="text-sm font-black uppercase tracking-[0.08em] text-[#fff7ed]">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PageReveal>
        </div>
      </section>

      {/* FEATURED EQUIPMENT */}

      <section className="px-6 py-32">
        <div className="mx-auto max-w-7xl">
          <PageReveal>
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
                Featured Equipment
              </p>

              <h2 className="mt-6 text-5xl font-black tracking-tight text-[#fff7ed] md:text-6xl">
                Fleet inventory ready for serious work.
              </h2>

              <p className="mt-6 text-lg leading-relaxed text-[#b8a99a]">
                Browse heavy equipment, trailers, and premium rentals
                available through Urban Cowboy Rentals.
              </p>
            </div>
          </PageReveal>

          <div className="mt-16">
            <EquipmentGrid equipment={featuredEquipment} />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}

      <section className="px-6 py-32">
        <div className="mx-auto max-w-7xl">
          <PageReveal>
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
                Rental Process
              </p>

              <h2 className="mt-6 text-5xl font-black tracking-tight text-[#fff7ed] md:text-6xl">
                Built for fast approvals and reliable rentals.
              </h2>
            </div>
          </PageReveal>

          <div className="mt-20 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  delay: index * 0.08,
                  duration: 0.55,
                }}
                className="industrial-card rounded-[2rem] p-8"
              >
                <p className="text-5xl font-black text-[#f4b000]/40">
                  {step.number}
                </p>

                <h3 className="mt-8 text-2xl font-black text-[#fff7ed]">
                  {step.title}
                </h3>

                <p className="mt-4 leading-relaxed text-[#b8a99a]">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <ContactSection />

      <CTASection
        eyebrow="Ready to rent?"
        title="Power your next project with premium equipment."
        description="Browse the fleet, review rental rates, and submit a request online through Urban Cowboy Rentals."
      />
    </MainLayout>
  );
};

export default HomePage;