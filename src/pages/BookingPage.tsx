import MainLayout from "../components/layout/MainLayout";
import BookingForm from "../components/forms/BookingForm";
import PageTransition from "../components/ui/PageTransition";
import SEO from "../components/seo/SEO";
import { Link } from "react-router-dom";


const BookingPage = () => {
  return (
    <PageTransition>
       <SEO title="Request an Equipment Rental | Urban Cowboy Rentals"
      description="Submit an equipment rental request with your preferred dates to Urban Cowboy Rentals."
      />
    <MainLayout>
      <section className="px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <div className="mb-5">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
              Rental Request
            </p>

            <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#fff7ed] sm:text-5xl">
              Request equipment
            </h1>

            <p className="mt-3 text-base leading-relaxed text-[#b8a99a]">
              Submit a rental request and Urban Cowboy Rentals will confirm
              availability, pricing, pickup or delivery, and next steps.
            </p>
          </div>

          <p className="mb-6 text-sm leading-relaxed text-[#b8a99a]">
            Submitting a request does not reserve equipment. Review{" "}
            <Link
              to="/rental-requirements"
              className="font-bold text-[#f4b000] underline decoration-[#f4b000]/50 underline-offset-4 transition hover:text-[#fff7ed]"
            >
              Rental Requirements
            </Link>
            .
          </p>

          <BookingForm />
        </div>
      </section>
    </MainLayout>
    </PageTransition>
  );
};

export default BookingPage;
