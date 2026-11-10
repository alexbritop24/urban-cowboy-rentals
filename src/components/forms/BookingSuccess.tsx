import { CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";

const BookingSuccess = ({ equipmentName }: { equipmentName?: string }) => {
  return (
    <div role="status" className="rounded-[2rem] border border-yellow-500/10 bg-[#11100d]/90 p-5 text-center sm:p-10 shadow-2xl shadow-black/30">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#f4b000]">
        <CheckCircle className="h-10 w-10 text-black" />
      </div>

      <h2 className="mt-8 text-4xl font-black text-[#fff7ed]">
        Rental request received
      </h2>

      <p className="mx-auto mt-5 max-w-xl leading-relaxed text-[#b8a99a]">
        We received your request{equipmentName ? <> for <strong>{equipmentName}</strong></> : ""}.
        Urban Cowboy Rentals will contact you to confirm availability, pricing, and next steps.
        Your rental is pending review.
      </p>

      <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
        <Link
          to="/equipment"
          className="rounded-full border border-yellow-500/20 bg-[#1a1612] px-7 py-4 font-black uppercase tracking-[0.08em] text-[#fff7ed] transition hover:border-yellow-500/50"
        >
          View Equipment
        </Link>

        <Link
          to="/contact"
          className="rounded-full bg-[#f4b000] px-7 py-4 font-black uppercase tracking-[0.08em] text-black transition hover:bg-[#f59e0b]"
        >
          Contact Us
        </Link>
      </div>
    </div>
  );
};

export default BookingSuccess;