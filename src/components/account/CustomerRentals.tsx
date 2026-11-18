import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { formatDocumentCurrency, formatDocumentDate } from "../../utils/documentPresentation";

interface CustomerRental {
  id: string;
  equipment: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  quote_amount: number | null;
  agreements: { id: string; number: string }[];
  invoices: { id: string; number: string }[];
}
export default function CustomerRentals({ userId }: { userId: string }) {
  const [rentals, setRentals] = useState<CustomerRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("get_my_rentals");
        if (error || !Array.isArray(data)) throw new Error("Could not load your rentals. Please try again.");
        if (active) { setRentals(data); setError(""); }
      } catch { if (active) setError("Could not load your rentals. Please try again."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [userId, revision]);
  const download = async (type: "agreement" | "invoice", id: string) => {
    if (busy) return;
    setBusy(id); setError("");
    try {
      let blob: Blob;
      let filename: string;
      if (type === "invoice") {
        const { getInvoiceById } = await import("../../services/invoiceService");
        const { createInvoicePdfBlob } = await import("../../utils/generateInvoicePdf");
        const invoice = await getInvoiceById(id);
        if (!invoice) throw new Error("Invoice unavailable");
        blob = await createInvoicePdfBlob(invoice);
        filename = invoice.invoice_number;
      } else {
        const { getRentalAgreementById } = await import("../../services/agreementService");
        const agreement = await getRentalAgreementById(id);
        if (!agreement || agreement.snapshot_availability.status !== "verified") throw new Error("Agreement unavailable");
        const { pdf } = await import("@react-pdf/renderer");
        const { default: AgreementPdfDocument } = await import("../agreement/pdf/AgreementPdfDocument");
        blob = await pdf(<AgreementPdfDocument agreement={agreement} />).toBlob();
        filename = agreement.agreement_number;
      }
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement("a");
        link.href = url; link.download = `${filename.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
        document.body.appendChild(link); link.click(); link.remove();
      } finally { window.setTimeout(() => URL.revokeObjectURL(url), 60_000); }
    } catch { setError("Could not download this document. Please try again or contact Urban Cowboy Rentals."); }
    finally { setBusy(null); }
  };
  return <section className="mt-6 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">My rentals</h2><Link to="/book" className="rounded-lg bg-[#f4b000] px-4 py-2 font-semibold text-black">Request equipment</Link></div>
    <button onClick={() => setRevision(value => value + 1)} className="text-sm underline">Refresh rentals</button>
    {loading && <p role="status">Loading rentals…</p>}
    {error && <p role="alert" className="text-red-200">{error}</p>}
    {!loading && !error && !rentals.length && <p>Requests you submit while signed in will appear here. Contact Urban Cowboy Rentals to link earlier rentals.</p>}
    {rentals.map(rental => <article key={rental.id} className="rounded-xl border border-[#514337] bg-[#1c1915] p-5">
      <h3 className="font-bold">{rental.equipment}</h3>
      <p className="mt-2 text-sm">{formatDocumentDate(rental.start_date)} – {formatDocumentDate(rental.end_date)} · {rental.status.replaceAll("_", " ")}</p>
      {rental.quote_amount !== null && <p className="mt-2">Quoted amount {formatDocumentCurrency(rental.quote_amount)}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {rental.agreements.map(doc => <button key={doc.id} disabled={busy !== null} className="rounded-lg border border-[#7c6238] px-3 py-2 text-sm" onClick={() => void download("agreement", doc.id)}>{busy === doc.id ? "Preparing…" : `Agreement ${doc.number}`}</button>)}
        {rental.invoices.map(doc => <button key={doc.id} disabled={busy !== null} className="rounded-lg border border-[#7c6238] px-3 py-2 text-sm" onClick={() => void download("invoice", doc.id)}>{busy === doc.id ? "Preparing…" : `Invoice ${doc.number}`}</button>)}
      </div>
    </article>)}
  </section>;
}
