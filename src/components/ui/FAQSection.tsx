import { faqData } from "../../data/faqData";

const FAQSection = () => {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
            FAQ
          </p>

          <h2 className="mt-5 text-5xl font-black tracking-tight text-[#fff7ed] md:text-6xl">
            Clear answers before you rent.
          </h2>

          <p className="mt-6 text-lg leading-relaxed text-[#b8a99a]">
            Common rental questions about availability, deposits, pickup,
            delivery, and rental approval.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {faqData.map((item) => (
            <div
              key={item.question}
              className="industrial-card rounded-[2rem] p-7"
            >
              <h3 className="text-xl font-black text-[#fff7ed]">
                {item.question}
              </h3>

              <p className="mt-4 leading-relaxed text-[#b8a99a]">
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;