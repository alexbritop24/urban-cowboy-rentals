import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="relative overflow-hidden border-t border-yellow-500/10 bg-[#050402] px-6 py-20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(244,176,0,0.05),transparent_40%)]" />

      <div className="mx-auto grid max-w-7xl gap-14 md:grid-cols-4">
        <div>
          <p className="text-3xl font-black tracking-tight text-[#fff7ed]">
            Urban Cowboy Rentals
          </p>

          <p className="mt-6 max-w-sm leading-relaxed text-[#8f8577]">
            Premium equipment rentals for construction, hauling,
            projects, transport, and open-road adventure.
          </p>
        </div>

        <div>
          <p className="text-sm font-black uppercase tracking-[0.3em] text-[#f4b000]">
            Navigation
          </p>

          <div className="mt-6 flex flex-col gap-4 text-[#d6c7b8]">
            <Link
              to="/"
              className="transition hover:text-[#f4b000]"
            >
              Home
            </Link>

            <Link
              to="/equipment"
              className="transition hover:text-[#f4b000]"
            >
              Equipment
            </Link>

            <Link
              to="/book"
              className="transition hover:text-[#f4b000]"
            >
              Request Rental
            </Link>

            <Link
              to="/policies"
              className="transition hover:text-[#f4b000]"
            >
              Rental Policies
            </Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-black uppercase tracking-[0.3em] text-[#f4b000]">
            Contact
          </p>

          <div className="mt-6 space-y-4 text-[#d6c7b8]">
            <p>801-903-9380</p>
            <p>urbancowboyrentals@gmail.com</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-black uppercase tracking-[0.3em] text-[#f4b000]">
            Future Platform
          </p>

          <p className="mt-6 max-w-sm leading-relaxed text-[#8f8577]">
            Booking system, deposits, admin dashboard,
            automation, notifications, and rental management
            workflows coming soon.
          </p>
        </div>
      </div>

      <div className="mx-auto mt-20 max-w-7xl">
        <div className="gold-line" />

        <div className="mt-8 flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm text-[#6f675e]">
            © 2026 Urban Cowboy Rentals, LLC. All rights reserved.
          </p>

          <p className="text-xs uppercase tracking-[0.25em] text-[#5d554d]">
            Premium Rental Platform
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;