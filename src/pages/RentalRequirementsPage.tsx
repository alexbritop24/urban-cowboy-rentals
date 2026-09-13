import MainLayout from "../components/layout/MainLayout";
import PageTransition from "../components/ui/PageTransition";
import SEO from "../components/seo/SEO";
import { rentalRequirementSections, rentalRequirementsLastUpdated } from "../data/rentalRequirementsData";

const RentalRequirementsPage = () => {
  return (
    <PageTransition>
      <SEO
        title="Rental Requirements | Urban Cowboy Rentals"
        description="Review pre-release rental request and equipment release information for Urban Cowboy Rentals."
      />

      <MainLayout>
        <section className="px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
              Rental Requirements
            </p>

            <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-tight text-[#fff7ed] md:text-7xl">
              Helpful information before you request equipment.
            </h1>

            <div className="mt-6 max-w-3xl space-y-4 text-lg leading-relaxed text-[#b8a99a]">
              <p>
                This page is a pre-release informational disclosure. It is not
                the final binding Rental Agreement, a legal waiver, legal
                advice, or a substitute for the attorney-approved 16-page
                agreement.
              </p>
              <p>
                The final signed Rental Agreement controls the rental
                relationship and contains the complete terms.
              </p>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-2">
              {rentalRequirementSections.map((section) => (
                <article
                  key={section.title}
                  className="industrial-card rounded-[2rem] p-7"
                >
                  <h2 className="text-2xl font-black text-[#fff7ed]">
                    {section.title}
                  </h2>

                  <p className="mt-4 leading-relaxed text-[#b8a99a]">
                    {section.description}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-10 rounded-[2rem] border border-yellow-500/10 bg-[#11100d]/90 p-7">
              <h2 className="text-2xl font-black text-[#fff7ed]">
                Questions?
              </h2>
              <p className="mt-4 leading-relaxed text-[#b8a99a]">
                Contact Urban Cowboy Rentals with any questions before
                submitting a rental request.
              </p>
            </div>

            <p className="mt-8 text-sm text-[#8f8577]">
              Last updated: {rentalRequirementsLastUpdated}
            </p>
          </div>
        </section>
      </MainLayout>
    </PageTransition>
  );
};

export default RentalRequirementsPage;
