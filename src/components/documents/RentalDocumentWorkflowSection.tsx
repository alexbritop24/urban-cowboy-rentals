import { useEffect, useMemo, useState } from "react";

import type {
  RentalDocumentMetadata,
  RentalDocumentType,
  RentalDocumentWorkflowState,
} from "../../domain/models/rentalDocument";
import {
  createRentalDocumentViewUrl,
  loadRentalDocumentWorkflow,
  reviewRentalInsurance,
  uploadRentalDocument,
} from "../../services/rentalDocumentService";

interface RentalDocumentWorkflowSectionProps {
  rentalRequestId: string;
  locked?: boolean;
  onStateChange?: (state: RentalDocumentWorkflowState) => void;
}

const documentLabels: Record<RentalDocumentType, string> = {
  driver_license: "Driver License",
  insurance: "Insurance",
};

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const formatDateTime = (value: string | null): string =>
  value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Not recorded";

const DocumentMetadata = ({ document }: { document: RentalDocumentMetadata }) => (
  <dl className="mt-4 grid gap-2 text-xs text-[#b8a99a] sm:grid-cols-2">
    <div>
      <dt className="font-black uppercase tracking-[0.08em] text-[#8f8577]">File</dt>
      <dd className="mt-1 break-all text-[#fff7ed]">{document.originalFilename}</dd>
    </div>
    <div>
      <dt className="font-black uppercase tracking-[0.08em] text-[#8f8577]">Type / size</dt>
      <dd className="mt-1 text-[#fff7ed]">{document.mimeType} · {formatBytes(document.sizeBytes)}</dd>
    </div>
    <div>
      <dt className="font-black uppercase tracking-[0.08em] text-[#8f8577]">Uploaded</dt>
      <dd className="mt-1 text-[#fff7ed]">{formatDateTime(document.uploadedAt)}</dd>
    </div>
    <div>
      <dt className="font-black uppercase tracking-[0.08em] text-[#8f8577]">Uploader</dt>
      <dd className="mt-1 break-all text-[#fff7ed]">{document.uploadedBy}</dd>
    </div>
  </dl>
);

export default function RentalDocumentWorkflowSection({
  rentalRequestId,
  locked = false,
  onStateChange,
}: RentalDocumentWorkflowSectionProps) {
  const [state, setState] = useState<RentalDocumentWorkflowState | null>(null);
  const [busy, setBusy] = useState<RentalDocumentType | "view" | "review" | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [notice, setNotice] = useState("");

  const applyState = (next: RentalDocumentWorkflowState) => {
    setState(next);
    onStateChange?.(next);
  };

  useEffect(() => {
    let active = true;

    loadRentalDocumentWorkflow(rentalRequestId)
      .then((next) => {
        if (active) applyState(next);
      })
      .catch((error) => {
        if (active) setNotice(errorMessage(error, "Could not load rental documents."));
      });

    return () => {
      active = false;
    };
    // The callback is intentionally notification-only and does not own loading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rentalRequestId]);

  const currentDocuments = useMemo(() => {
    const current = new Map<RentalDocumentType, RentalDocumentMetadata>();
    for (const document of state?.documents ?? []) {
      if (document.isCurrent) current.set(document.documentType, document);
    }
    return current;
  }, [state]);

  const upload = async (documentType: RentalDocumentType, file: File | undefined) => {
    if (!file || locked) return;
    setBusy(documentType);
    setNotice("");
    try {
      applyState(await uploadRentalDocument(rentalRequestId, documentType, file));
      setNotice(`${documentLabels[documentType]} uploaded securely.`);
    } catch (error) {
      setNotice(errorMessage(error, `Could not upload ${documentLabels[documentType].toLowerCase()}.`));
    } finally {
      setBusy(null);
    }
  };

  const view = async (documentId: string) => {
    setBusy("view");
    setNotice("");
    try {
      const url = await createRentalDocumentViewUrl(documentId);
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) setNotice("Allow pop-ups to open the temporary document link.");
    } catch (error) {
      setNotice(errorMessage(error, "Could not open the rental document."));
    } finally {
      setBusy(null);
    }
  };

  const review = async (status: "verified" | "rejected") => {
    if (locked) return;
    setBusy("review");
    setNotice("");
    try {
      applyState(
        await reviewRentalInsurance(rentalRequestId, status, reviewNote || null)
      );
      setNotice(`Insurance marked ${status}.`);
    } catch (error) {
      setNotice(errorMessage(error, "Could not record the insurance review."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-3xl border border-yellow-500/10 bg-black/25 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
            Private Rental Documents
          </p>
          <p className="mt-2 text-sm text-[#b8a99a]">
            Staff-only files. Viewing uses a new short-lived link each time.
          </p>
        </div>
        {locked && (
          <span className="rounded-full border border-[#8f8577]/30 px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-[#b8a99a]">
            Locked after finalization
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {(["driver_license", "insurance"] as const).map((documentType) => {
          const current = currentDocuments.get(documentType);
          const history = (state?.documents ?? []).filter(
            (document) => document.documentType === documentType && !document.isCurrent
          );
          return (
            <article key={documentType} className="rounded-2xl border border-yellow-500/10 bg-black/30 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-black text-[#fff7ed]">{documentLabels[documentType]}</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.08em] ${current ? "bg-green-500/15 text-green-300" : "bg-amber-500/15 text-amber-200"}`}>
                  {current ? "Uploaded" : "Missing"}
                </span>
              </div>

              {current ? <DocumentMetadata document={current} /> : (
                <p className="mt-4 text-sm text-[#b8a99a]">No current document is registered.</p>
              )}

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {current && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void view(current.id)}
                    className="rounded-full border border-yellow-500/30 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#fff7ed] disabled:opacity-50"
                  >
                    {busy === "view" ? "Opening..." : "Open current"}
                  </button>
                )}
                <label className={`rounded-full bg-[#f4b000] px-4 py-2 text-center text-xs font-black uppercase tracking-[0.08em] text-black ${locked || busy !== null ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                  {busy === documentType ? "Uploading..." : current ? "Replace" : "Upload"}
                  <input
                    type="file"
                    className="sr-only"
                    disabled={locked || busy !== null}
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      void upload(documentType, file);
                    }}
                  />
                </label>
              </div>

              {history.length > 0 && (
                <details className="mt-5 border-t border-yellow-500/10 pt-4 text-xs text-[#b8a99a]">
                  <summary className="cursor-pointer font-black uppercase tracking-[0.08em] text-[#d8cfc4]">
                    Replacement history ({history.length})
                  </summary>
                  <div className="mt-3 space-y-3">
                    {history.map((document) => (
                      <div key={document.id} className="rounded-xl border border-yellow-500/10 p-3">
                        <p className="break-all text-[#fff7ed]">{document.originalFilename}</p>
                        <p className="mt-1">Replaced {formatDateTime(document.replacedAt)}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </article>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-yellow-500/10 bg-black/30 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8f8577]">Insurance verification</p>
            <p className="mt-1 font-black uppercase tracking-[0.08em] text-[#fff7ed]">
              {state?.insuranceVerificationStatus.replaceAll("_", " ") ?? "Loading"}
            </p>
            {state?.insuranceReviewedAt && (
              <p className="mt-1 text-xs text-[#b8a99a]">
                Reviewed {formatDateTime(state.insuranceReviewedAt)} by {state.insuranceReviewedBy}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={locked || busy !== null || !currentDocuments.get("insurance")}
              onClick={() => void review("verified")}
              className="rounded-full bg-green-500 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-black disabled:opacity-50"
            >
              Verify
            </button>
            <button
              type="button"
              disabled={locked || busy !== null || !currentDocuments.get("insurance")}
              onClick={() => void review("rejected")}
              className="rounded-full border border-red-500/40 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-red-300 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
        <label className="mt-4 block text-xs font-black uppercase tracking-[0.1em] text-[#8f8577]">
          Optional review note
          <textarea
            rows={2}
            maxLength={2000}
            disabled={locked || busy !== null}
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 font-normal normal-case tracking-normal text-[#fff7ed] outline-none focus:border-yellow-500/40 disabled:opacity-50"
          />
        </label>
      </div>

      {notice && <p className="mt-4 text-sm font-bold text-[#fff7ed]">{notice}</p>}
    </section>
  );
}
