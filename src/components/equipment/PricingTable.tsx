import type { EquipmentRate } from "../../types/equipment";

interface PricingTableProps {
  rates: EquipmentRate[];
}

const PricingTable = ({ rates }: PricingTableProps) => {
  return (
    <div className="overflow-hidden rounded-3xl border border-yellow-500/10 bg-[#11100d]/90">
      <div className="border-b border-yellow-500/10 px-6 py-5">
        <h3 className="text-xl font-black text-[#fff7ed]">
          Rental Rates
        </h3>
      </div>

      <div className="divide-y divide-yellow-500/10">
        {rates.map((rate) => (
          <div
            key={rate.label}
            className="flex items-center justify-between px-6 py-5"
          >
            <span className="font-semibold text-[#fff7ed]">
              {rate.label}
            </span>

            <span className="text-2xl font-black text-[#f4b000]">
              ${rate.price}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PricingTable;