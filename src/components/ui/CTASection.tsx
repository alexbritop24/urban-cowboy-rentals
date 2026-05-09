import { Link } from "react-router-dom";

interface CTASectionProps {
  eyebrow?: string;
  title: string;
  description: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}

const CTASection = ({
  eyebrow = "Ready to rent?",
  title,
  description,
  primaryLabel = "Request Rental",
  primaryHref = "/book",
  secondaryLabel = "View Equipment",
  secondaryHref = "/equipment",
}: CTASectionProps) => {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-yellow-500/10 bg-[#11100d]/90 p-8 shadow-2xl shadow-black/30 md:p-14">
        <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
          {eyebrow}
        </p>

        <div className="mt-5 grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <h2 className="max-w-4xl text-4xl font-black tracking-tight text-[#fff7ed] md:text-6xl">
              {title}
            </h2>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#b8a99a]">
              {description}
            </p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row lg:justify-end">
            <Link
              to={primaryHref}
              className="rounded-full bg-[#f4b000] px-7 py-4 text-center font-black uppercase tracking-[0.08em] text-black transition hover:bg-[#f59e0b]"
            >
              {primaryLabel}
            </Link>

            <Link
              to={secondaryHref}
              className="rounded-full border border-yellow-500/20 bg-[#1a1612] px-7 py-4 text-center font-black uppercase tracking-[0.08em] text-[#fff7ed] transition hover:border-yellow-500/50"
            >
              {secondaryLabel}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;