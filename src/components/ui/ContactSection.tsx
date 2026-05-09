import { Mail, Phone } from "lucide-react";

const ContactSection = () => {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2">
        <div className="rounded-[2rem] border border-yellow-500/10 bg-[#11100d]/90 p-8 shadow-2xl shadow-black/30">
          <Phone className="h-8 w-8 text-[#f4b000]" />

          <h3 className="mt-6 text-3xl font-black text-[#fff7ed]">
            Call Urban Cowboy Rentals
          </h3>

          <p className="mt-4 text-[#b8a99a]">
            Speak directly with the rental team for availability, pickup,
            delivery, and equipment questions.
          </p>

          <a
            href="tel:8019039380"
            className="mt-8 inline-block rounded-full bg-[#f4b000] px-7 py-4 font-black uppercase tracking-[0.08em] text-black transition hover:bg-[#f59e0b]"
          >
            801-903-9380
          </a>
        </div>

        <div className="rounded-[2rem] border border-yellow-500/10 bg-[#11100d]/90 p-8 shadow-2xl shadow-black/30">
          <Mail className="h-8 w-8 text-[#f4b000]" />

          <h3 className="mt-6 text-3xl font-black text-[#fff7ed]">
            Send a Rental Inquiry
          </h3>

          <p className="mt-4 text-[#b8a99a]">
            Email the team with your equipment needs, dates, and project
            details.
          </p>

          <a
            href="mailto:urbancowboyrentals@gmail.com"
            className="mt-8 inline-block rounded-full border border-yellow-500/20 bg-[#1a1612] px-7 py-4 font-black uppercase tracking-[0.08em] text-[#fff7ed] transition hover:border-yellow-500/50"
          >
            Email Us
          </a>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;