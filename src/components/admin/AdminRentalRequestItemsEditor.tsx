import { useEffect, useState } from "react";

import { getBookableEquipment } from "../../data/equipmentSelectors";
import { rentalRequestItemsToDrafts } from "../../domain/adapters/rentalRequestDraftAdapters";
import {
  DomainValidationError,
  type DomainValidationIssue,
} from "../../domain/errors/DomainValidationError";
import type { RentalRequestItemDraft } from "../../domain/models/rentalRequestWorkflow";
import {
  adminRentalRequestItemService,
  adminRentalRequestWorkflowService,
} from "../../services/multiItemRentalRequestService";
import RentalItemEditorList from "../rentalItems/RentalItemEditorList";
import RentalPricingSummary from "../rentalItems/RentalPricingSummary";
import RentalValidationSummary from "../rentalItems/RentalValidationSummary";

interface AdminRentalRequestItemsEditorProps {
  rentalRequestId: string;
  equipmentRequested: string;
  rentalStartDate: string;
  rentalEndDate: string;
  pickupDate: string | null;
  returnDate: string | null;
  quoteAmount: number | null;
  onSaved: () => void;
}

const equipmentOptions = getBookableEquipment();

const createClientId = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createEmptyItem = (
  previousItem?: RentalRequestItemDraft
): RentalRequestItemDraft => ({
  clientId: createClientId(),
  equipmentId: "",
  equipmentName: "",
  startDate: previousItem?.startDate ?? "",
  endDate: previousItem?.endDate ?? "",
  quantity: 1,
  dailyRate: 0,
  serialNumber: null,
  notes: "",
});

export default function AdminRentalRequestItemsEditor({
  rentalRequestId,
  equipmentRequested,
  rentalStartDate,
  rentalEndDate,
  pickupDate,
  returnDate,
  quoteAmount,
  onSaved,
}: AdminRentalRequestItemsEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [items, setItems] = useState<RentalRequestItemDraft[]>([]);
  const [issues, setIssues] = useState<DomainValidationIssue[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isOpen || hasLoaded) return;

    let active = true;

    adminRentalRequestItemService
      .resolveItems({
        rentalRequestId,
        legacyFields: {
          equipment_requested: equipmentRequested,
          rental_start_date: pickupDate ?? rentalStartDate,
          rental_end_date: returnDate ?? rentalEndDate,
        },
        legacyDefaults: {
          dailyRate: quoteAmount ?? 0,
        },
      })
      .then((resolution) => {
        if (!active) return;
        setItems(rentalRequestItemsToDrafts(resolution.items));
        setHasLoaded(true);
      })
      .catch((error) => {
        if (!active) return;
        console.error("LOAD RENTAL REQUEST ITEMS ERROR:", error);
        setNotice("Could not load rental request items.");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    equipmentRequested,
    hasLoaded,
    isOpen,
    pickupDate,
    quoteAmount,
    rentalEndDate,
    rentalRequestId,
    rentalStartDate,
    returnDate,
  ]);

  const updateItems = (updatedItems: RentalRequestItemDraft[]) => {
    setItems(updatedItems);
    setIssues([]);
    setNotice("");
  };

  const toggleEditor = () => {
    if (!isOpen && !hasLoaded) {
      setIsLoading(true);
      setNotice("");
    }
    setIsOpen((open) => !open);
  };

  const saveItems = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setIssues([]);
    setNotice("");

    try {
      await adminRentalRequestWorkflowService.replaceItems(
        rentalRequestId,
        items
      );
      setNotice("Equipment items saved. Availability now requires review.");
      onSaved();
    } catch (error) {
      if (error instanceof DomainValidationError) {
        setIssues([...error.issues]);
        setNotice(error.message);
      } else {
        console.error("SAVE RENTAL REQUEST ITEMS ERROR:", error);
        setNotice("Could not save equipment items.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="mt-6 rounded-3xl border border-yellow-500/10 bg-black/20 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#f4b000]">
            Multi-item request
          </p>
          <p className="mt-1 text-sm text-[#b8a99a]">
            Edit equipment schedules, rates, serials, quantities, and notes.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleEditor}
          className="w-fit rounded-full border border-yellow-500/20 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#fff7ed] transition hover:border-yellow-500/50"
        >
          {isOpen ? "Close item editor" : "Edit equipment items"}
        </button>
      </div>

      {isOpen && (
        <div className="mt-6 border-t border-yellow-500/10 pt-6">
          {isLoading ? (
            <p className="text-[#b8a99a]">Loading equipment items...</p>
          ) : (
            <>
              <RentalItemEditorList
                items={items}
                equipmentOptions={equipmentOptions}
                issues={issues}
                allowRateEditing
                showSerialNumber
                onItemsChange={updateItems}
                onAdd={() => updateItems([...items, createEmptyItem(items.at(-1))])}
              />

              <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
                <div className="space-y-4">
                  <RentalValidationSummary issues={issues} />
                  {notice && (
                    <p className="rounded-2xl border border-yellow-500/10 bg-black/30 px-5 py-4 text-sm font-bold text-[#fff7ed]">
                      {notice}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={saveItems}
                    disabled={isSaving}
                    className="rounded-full bg-[#f4b000] px-6 py-3 text-sm font-black uppercase tracking-[0.08em] text-black transition hover:bg-[#f59e0b] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? "Saving items..." : "Save equipment items"}
                  </button>
                </div>

                <RentalPricingSummary items={items} showPendingFees={false} />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
