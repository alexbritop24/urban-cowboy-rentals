import MainLayout from "../components/layout/MainLayout";
import ContactSection from "../components/ui/ContactSection";
import CTASection from "../components/ui/CTASection";
import PageTransition from "../components/ui/PageTransition";
import SEO from "../components/seo/SEO";

const ContactPage = () => {
  return (
    <PageTransition>
       <SEO title="Urban Cowboy Rentals | Premium Equipment Rentals"
      description="Rent heavy equipment, trailers, tools, and motorcycles from Urban Cowboy Rentals, LLC."
      />
    <MainLayout>
      <section className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
            Contact
          </p>

          <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-tight text-[#fff7ed] md:text-7xl">
            Get equipment availability, pricing, and rental support.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#b8a99a]">
            Contact Urban Cowboy Rentals for heavy equipment, trailers,
            tools, motorcycle rentals, pickup, delivery, and booking questions.
          </p>
        </div>
      </section>

      <ContactSection />

      <CTASection
        title="Need equipment for an upcoming project?"
        description="Submit a rental request and the team will confirm availability, rates, and next steps."
      />
    </MainLayout>
    </PageTransition>
  );
};

export default ContactPage;