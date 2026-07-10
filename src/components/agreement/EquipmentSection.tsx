import type { RentalAgreement } from "../../types/agreement";

interface EquipmentSectionProps {
  agreement: RentalAgreement;
}

const EquipmentSection = ({ agreement }: EquipmentSectionProps) => {
  return (
    <section className="rounded-3xl border border-yellow-500/10 bg-black/25 p-6">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
        Equipment Information
      </p>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Equipment
          </p>

          <p className="mt-2 text-lg font-bold text-[#fff7ed]">
            {agreement.equipment_requested}
          </p>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Rental Duration
          </p>

          <p className="mt-2 text-lg text-[#fff7ed]">
            {agreement.rental_duration}
          </p>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Pickup Date
          </p>

          <p className="mt-2 text-[#fff7ed]">
            {agreement.rental_start_date}
          </p>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
            Return Date
          </p>

          <p className="mt-2 text-[#fff7ed]">
            {agreement.rental_end_date}
          </p>
        </div>
      </div>
    </section>
  );
};

export default EquipmentSection;