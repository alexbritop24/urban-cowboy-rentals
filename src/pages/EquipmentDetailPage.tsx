import { Link, useParams } from "react-router-dom";

import MainLayout from "../components/layout/MainLayout";
import PricingTable from "../components/equipment/PricingTable";

import { equipmentData } from "../data/equipmentData";

const EquipmentDetailPage = () => {
  const { id } = useParams();

  const equipment = equipmentData.find(
    (item) => item.id === id
  );

  if (!equipment) {
    return (
      <MainLayout>
        <section className="px-6 py-32 text-center">
          <h1 className="text-4xl font-black text-white">
            Equipment Not Found
          </h1>
        </section>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <section className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <div className="flex h-[500px] items-center justify-center rounded-[2rem] border border-yellow-500/10 bg-gradient-to-br from-[#1a1612] to-[#070604]">
                <span className="text-sm font-black uppercase tracking-[0.3em] text-[#f4b000]/70">
                  Equipment Image Coming Soon
                </span>
              </div>
            </div>

            <div>
              <div className="rounded-full border border-yellow-500/20 bg-[#11100d] px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#f4b000] w-fit">
                {equipment.category}
              </div>

              <h1 className="mt-6 text-5xl font-black leading-tight text-[#fff7ed]">
                {equipment.name}
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-[#b8a99a]">
                {equipment.description}
              </p>

              <div className="mt-10 grid gap-4">
                {equipment.specs.map((spec) => (
                  <div
                    key={spec}
                    className="flex items-start gap-3 rounded-2xl border border-yellow-500/10 bg-[#11100d]/70 px-5 py-4"
                  >
                    <span className="mt-2 h-2 w-2 rounded-full bg-[#f4b000]" />

                    <span className="text-[#fff7ed]">
                      {spec}
                    </span>
                  </div>
                ))}
              </div>

              {equipment.addOns && (
                <div className="mt-10">
                  <h3 className="mb-5 text-2xl font-black text-[#fff7ed]">
                    Optional Add-ons
                  </h3>

                  <div className="grid gap-4">
                    {equipment.addOns.map((addon) => (
                      <div
                        key={addon}
                        className="rounded-2xl border border-yellow-500/10 bg-[#11100d]/70 px-5 py-4 text-[#fff7ed]"
                      >
                        {addon}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  to={`/book?equipment=${equipment.id}`}
                  className="rounded-full bg-[#f4b000] px-8 py-4 text-center font-black uppercase tracking-[0.08em] text-black transition hover:bg-[#f59e0b]"
                >
                  Request Rental
                </Link>

                <Link
                  to="/contact"
                  className="rounded-full border border-yellow-500/20 bg-[#11100d] px-8 py-4 text-center font-black uppercase tracking-[0.08em] text-[#fff7ed] transition hover:border-yellow-500/50"
                >
                  Contact Us
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-20">
            <PricingTable rates={equipment.rates} />
          </div>
        </div>
      </section>
    </MainLayout>
  );
};

export default EquipmentDetailPage;