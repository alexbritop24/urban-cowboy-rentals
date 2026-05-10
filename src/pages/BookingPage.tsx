import MainLayout from "../components/layout/MainLayout";
import BookingForm from "../components/forms/BookingForm";
import PageTransition from "../components/ui/PageTransition";
import SEO from "../components/seo/SEO";


const BookingPage = () => {
  return (
    <PageTransition>
       <SEO title="Urban Cowboy Rentals | Premium Equipment Rentals"
      description="Rent heavy equipment, trailers, tools, and motorcycles from Urban Cowboy Rentals, LLC."
      />
    <MainLayout>
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
              Rental Request
            </p>

            <h1 className="mt-5 text-5xl font-black tracking-tight text-[#fff7ed] md:text-7xl">
              Tell us what you need and when you need it.
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-[#b8a99a]">
              Submit a rental request and Urban Cowboy Rentals will confirm
              availability, pricing, pickup or delivery, and next steps.
            </p>
          </div>

          <BookingForm />
        </div>
      </section>
    </MainLayout>
    </PageTransition>
  );
};

export default BookingPage;