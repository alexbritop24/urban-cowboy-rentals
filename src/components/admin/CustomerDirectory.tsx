import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { formatDocumentDate } from "../../utils/documentPresentation";

interface CustomerRental {
  id: string;
  customer_id?: string | null;
  customer_user_id?: string | null;
  full_name: string;
  business_name?: string | null;
  phone: string;
  email: string;
  equipment_requested: string;
  status: string;
  rental_start_date: string;
  rental_end_date: string;
}
function AccountLink({ customerId, email, linked, onLinked }: { customerId: string; email: string; linked: boolean; onLinked: () => void }) {
  const [accountEmail, setAccountEmail] = useState(email);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (linked) return <p className="mt-4 text-sm text-[#d3c6b8]">Rental history is linked to a customer account.</p>;
  return <form className="mt-5 space-y-3 rounded-lg border border-[#514337] p-4" onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { error } = await supabase.rpc("link_rental_customer_account", { customer_key: customerId, account_email: accountEmail.trim() });
      if (error) throw error;
      setMessage("Account linked. This customer can view these rentals and their finalized documents.");
      onLinked();
    } catch (error) { setError(error && typeof error === "object" && "message" in error ? String(error.message) : "Could not link account."); }
    finally { setBusy(false); }
  }}>
    <label className="block text-sm">Verified customer account email
      <input type="email" required value={accountEmail} onChange={event => setAccountEmail(event.target.value)} className="mt-1 block w-full rounded-lg border border-[#786655] bg-[#14120f] px-3 py-2" />
    </label>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" required className="mt-1" />I verified this account belongs to this customer and may access this rental history.</label>
    <button disabled={busy} className="rounded-lg border border-[#7c6238] px-3 py-2 text-sm font-semibold text-[#ffd98a]">{busy ? "Linking…" : "Link customer account"}</button>
    {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </form>;
}
export default function CustomerDirectory({ requests, onChanged }: { requests: readonly CustomerRental[]; onChanged: () => void }) {
  const [search, setSearch] = useState("");
  const customers = useMemo(() => {
    const groups = new Map<string, CustomerRental[]>();
    for (const request of requests) {
      const key = request.customer_id || JSON.stringify([request.full_name, request.email, request.phone, request.business_name]);
      groups.set(key, [...(groups.get(key) ?? []), request]);
    }
    return [...groups.entries()].filter(([, rentals]) => [rentals[0].full_name, rentals[0].email, rentals[0].phone, rentals[0].business_name].join(" ").toLowerCase().includes(search.trim().toLowerCase()));
  }, [requests, search]);
  return <section className="mt-6 space-y-4 text-[#fff7ed]">
    <h1 className="text-2xl font-bold">Customers</h1>
    <input type="search" aria-label="Search customers" placeholder="Search name, company, email or phone" value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-lg border border-[#786655] bg-[#14120f] px-3 py-3" />
    {!customers.length && <p>No customers match this search.</p>}
    {customers.map(([key, rentals]) => {
      const customer = rentals[0];
      return <details key={key} className="rounded-xl border border-[#514337] bg-[#1c1915] p-5">
        <summary className="cursor-pointer"><strong>{customer.business_name || customer.full_name}</strong><span className="ml-3 text-sm text-[#d3c6b8]">{rentals.length} {rentals.length === 1 ? "request" : "requests"} · {rentals.filter(rental => rental.status === "completed").length} completed rentals</span></summary>
        <p className="mt-3 break-words text-sm">{customer.full_name} · {customer.phone} · {customer.email}</p>
        <ul className="mt-4 space-y-3">
          {rentals.map(rental => <li key={rental.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#514337] pt-3 text-sm">
            <div><p>{rental.equipment_requested}</p><p className="text-[#d3c6b8]">{formatDocumentDate(rental.rental_start_date)} – {formatDocumentDate(rental.rental_end_date)} · {rental.status.replaceAll("_", " ")}</p></div>
            <Link to={`/admin?request=${rental.id}`} className="text-[#ffd98a] underline">Open request</Link>
          </li>)}
        </ul>
        {customer.customer_id && <AccountLink customerId={customer.customer_id} email={customer.email} linked={rentals.every(rental => Boolean(rental.customer_user_id))} onLinked={onChanged} />}
      </details>;
    })}
  </section>;
}
