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

      <div className="mt-6 space-y-5">

        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
            Equipment
          </p>

          <p className="mt-1 text-xl font-bold text-[#fff7ed]">
            {agreement.equipment_requested}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">

          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
              Rental Start
            </p>

            <p className="mt-1 text-[#d8cfc4]">
              {agreement.rental_start_date}
            </p>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
              Rental End
            </p>

            <p className="mt-1 text-[#d8cfc4]">
              {agreement.rental_end_date}
            </p>
          </div>

        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">
            Rental Duration
          </p>

          <p className="mt-1 text-[#d8cfc4]">
            {agreement.rental_duration}
          </p>
        </div>

      </div>
    </section>
  );
};

export default EquipmentSection;