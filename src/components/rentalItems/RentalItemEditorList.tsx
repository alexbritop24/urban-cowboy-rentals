import type { DomainValidationIssue } from "../../domain/errors/DomainValidationError";
import type { RentalRequestItemDraft } from "../../domain/models/rentalRequestWorkflow";
import type { EquipmentItem } from "../../types/equipment";
import RentalItemEditor from "./RentalItemEditor";

interface RentalItemEditorListProps {
  items: readonly RentalRequestItemDraft[];
  equipmentOptions: readonly EquipmentItem[];
  issues?: readonly DomainValidationIssue[];
  onItemsChange: (items: RentalRequestItemDraft[]) => void;
  onAdd: () => void;
}

export default function RentalItemEditorList({
  items,
  equipmentOptions,
  issues = [],
  onItemsChange,
  onAdd,
}: RentalItemEditorListProps) {
  const updateItem = (index: number, updatedItem: RentalRequestItemDraft) => {
    onItemsChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? updatedItem : item
      )
    );
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4b000]">
            Equipment
          </p>
          <h2 className="mt-2 text-2xl font-black text-[#fff7ed]">
            Rental items ({items.length})
          </h2>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="w-fit rounded-full bg-[#f4b000] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-black transition hover:bg-[#f59e0b]"
        >
          + Add equipment
        </button>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-3xl border border-dashed border-yellow-500/20 bg-black/20 p-8 text-center text-[#b8a99a]">
          Add at least one equipment item to continue.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {items.map((item, index) => (
            <RentalItemEditor
              key={item.clientId}
              item={item}
              index={index}
              equipmentOptions={equipmentOptions}
              issues={issues.filter((issue) =>
                issue.path.startsWith(`items[${index}]`)
              )}
              onChange={(updatedItem) => updateItem(index, updatedItem)}
              onRemove={() => removeItem(index)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
