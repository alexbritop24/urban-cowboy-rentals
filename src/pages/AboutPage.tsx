import MainLayout from "../components/layout/MainLayout";
import CTASection from "../components/ui/CTASection";

const values = [
  "Reliable equipment for work and hauling",
  "Simple rental request process",
  "Support for pickup and delivery coordination",
  "Built to expand into a full rental operating system",
];

const AboutPage = () => {
  return (
    <MainLayout>
      <section className="px-6 py-24">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.8fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
              About Urban Cowboy Rentals
            </p>

            <h1 className="mt-5 text-5xl font-black tracking-tight text-[#fff7ed] md:text-7xl">
              Rugged rental power with a modern customer experience.
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-[#b8a99a]">
              Urban Cowboy Rentals, LLC rents heavy equipment, trailers,
              tools, and motorcycles for customers who need dependable
              equipment, clear rental options, and reliable support.
            </p>
          </div>

          <div className="rounded-[2rem] border border-yellow-500/10 bg-[#11100d]/90 p-8 shadow-2xl shadow-black/30">
            <h2 className="text-3xl font-black text-[#fff7ed]">
              Built for work, hauling, and adventure.
            </h2>

            <div className="mt-8 space-y-4">
              {values.map((value) => (
                <div
                  key={value}
                  className="rounded-2xl border border-yellow-500/10 bg-[#1a1612] p-5 text-[#b8a99a]"
                >
                  {value}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CTASection
        eyebrow="Rental made simple"
        title="Browse equipment and request the dates you need."
        description="The website is built to support a future booking system, admin dashboard, deposits, automated notifications, and rental management workflows."
      />
    </MainLayout>
  );
};

export default AboutPage;