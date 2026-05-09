import EquipmentCard from "./EquipmentCard";

import type { EquipmentItem } from "../../types/equipment";

interface EquipmentGridProps {
  equipment: EquipmentItem[];
}

const EquipmentGrid = ({ equipment }: EquipmentGridProps) => {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {equipment.map((item) => (
        <EquipmentCard key={item.id} equipment={item} />
      ))}
    </div>
  );
};

export default EquipmentGrid;