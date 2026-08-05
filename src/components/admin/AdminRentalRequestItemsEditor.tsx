import { useEffect, useState } from "react";

import {
  DomainValidationError,
  type DomainValidationIssue,
} from "../../domain/errors/DomainValidationError";
import type { RentalRequestItemDraft } from "../../domain/models/rentalRequestWorkflow";
import {
  adminRentalRequestItemService,
  adminRentalRequestWorkflowService,
} from "../../services/multiItemRentalRequestService";
import {
  addRentalRequestDraftItem,
  getRentalRequestEquipmentOptions,
  isRentalRequestStatusEditable,
  prepareRentalRequestDraftsForEditing,
} from "../../services/rentalRequestFormService";
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
  requestStatus: string;
  onSaved: () => void;
}

const equipmentOptions = getRentalRequestEquipmentOptions();

export default function AdminRentalRequestItemsEditor({
  rentalRequestId,
  equipmentRequested,
  rentalStartDate,
  rentalEndDate,
  pickupDate,
  returnDate,
  requestStatus,
  onSaved,
}: AdminRentalRequestItemsEditorProps) {
  const statusAllowsEditing = isRentalRequestStatusEditable(requestStatus);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [items, setItems] = useState<RentalRequestItemDraft[]>([]);
  const [issues, setIssues] = useState<DomainValidationIssue[]>([]);
  const [notice, setNotice] = useState("");
  const [serverAllowsEditing, setServerAllowsEditing] = useState(false);

  useEffect(() => {
    if (!isOpen || hasLoaded) return;

    let active = true;

    adminRentalRequestWorkflowService
      .getEditability(rentalRequestId)
      .then(async (editability) => {
        if (!active) return null;
        setServerAllowsEditing(editability.editable);

        if (!editability.editable) {
          setNotice(editability.reason);
          setHasLoaded(true);
          return null;
        }

        return adminRentalRequestItemService.resolveItems({
          rentalRequestId,
          legacyFields: {
            equipment_requested: equipmentRequested,
            rental_start_date: pickupDate ?? rentalStartDate,
            rental_end_date: returnDate ?? rentalEndDate,
          },
        });
      })
      .then((resolution) => {
        if (!active || !resolution) return;
        setItems(prepareRentalRequestDraftsForEditing(resolution.items));
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
    if (!statusAllowsEditing) return;

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
      const editability =
        await adminRentalRequestWorkflowService.getEditability(rentalRequestId);

      if (!editability.editable) {
        setServerAllowsEditing(false);
        setNotice(editability.reason);
        return;
      }

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
            Edit equipment schedules, quantities, and notes. Catalog pricing is
            verified by the server when saved.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleEditor}
          disabled={!statusAllowsEditing}
          className="w-fit rounded-full border border-yellow-500/20 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#fff7ed] transition hover:border-yellow-500/50"
        >
          {!statusAllowsEditing
            ? "Equipment items locked"
            : isOpen
              ? "Close item editor"
              : "Edit equipment items"}
        </button>
      </div>

      {!statusAllowsEditing && (
        <p className="mt-4 rounded-2xl border border-yellow-500/10 bg-black/30 px-5 py-4 text-sm text-[#b8a99a]">
          Equipment items are editable only while the request is new.
        </p>
      )}

      {isOpen && statusAllowsEditing && (
        <div className="mt-6 border-t border-yellow-500/10 pt-6">
          {isLoading ? (
            <p className="text-[#b8a99a]">Loading equipment items...</p>
          ) : !serverAllowsEditing ? (
            <p className="rounded-2xl border border-yellow-500/10 bg-black/30 px-5 py-4 text-sm text-[#b8a99a]">
              {notice || "Equipment items are locked by the server."}
            </p>
          ) : (
            <>
              <RentalItemEditorList
                items={items}
                equipmentOptions={equipmentOptions}
                issues={issues}
                onItemsChange={updateItems}
                onAdd={() => updateItems(addRentalRequestDraftItem(items))}
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
