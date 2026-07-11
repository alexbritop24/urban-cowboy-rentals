

export default function TermsSection() {
  return (
    <section className="rounded-3xl border border-yellow-500/10 bg-black/25 p-8">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
        Terms & Conditions
      </p>

      <div className="mt-6 space-y-6 text-sm leading-7 text-[#d4c8bb]">
        <div>
          <h3 className="font-black text-[#fff7ed]">
            Rental Responsibility
          </h3>

          <p>
            The renter agrees to operate the equipment safely, only for its
            intended purpose, and only by qualified operators.
          </p>
        </div>

        <div>
          <h3 className="font-black text-[#fff7ed]">
            Damage
          </h3>

          <p>
            Customer accepts responsibility for damage beyond normal wear and
            tear while equipment is in their possession.
          </p>
        </div>

        <div>
          <h3 className="font-black text-[#fff7ed]">
            Fuel & Cleaning
          </h3>

          <p>
            Equipment must be returned in substantially the same condition in
            which it was received. Cleaning or refueling charges may apply.
          </p>
        </div>

        <div>
          <h3 className="font-black text-[#fff7ed]">
            Late Returns
          </h3>

          <p>
            Additional rental charges may apply if equipment is returned after
            the agreed rental period.
          </p>
        </div>

        <div>
          <h3 className="font-black text-[#fff7ed]">
            Liability
          </h3>

          <p>
            Urban Cowboy Rentals is not responsible for injuries, project
            delays, lost profits, or indirect damages resulting from equipment
            use.
          </p>
        </div>
      </div>
    </section>
  );
}