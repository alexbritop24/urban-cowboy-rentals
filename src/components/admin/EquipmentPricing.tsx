import { useState } from "react";
import { loadRentalPrices, useRentalPrices } from "../../hooks/useRentalPrices";
import type { RentalPrices } from "../../hooks/useRentalPrices";
import { supabase } from "../../lib/supabase";

function EquipmentPriceEditor({ item, onPublished }: { item: RentalPrices; onPublished: (name: string) => void }) {
  const [amounts, setAmounts] = useState(item.rates.map(rate => String(rate.price)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form className="rounded-xl border border-[#514337] bg-[#1c1915] p-5" onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      setError("");
      if (amounts.some(value => !/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 99999999.99)) {
        setError("Enter a price with up to two decimal places for each duration."); return;
      }
      setBusy(true);
      try {
        const { error } = await supabase.rpc("save_rental_rates", {
          equipment_key: item.equipment_id, expected_rates: item.rates,
          next_rates: item.rates.map((rate, index) => ({ ...rate, price: Number(amounts[index]) })),
        });
        if (error) throw error;
        onPublished(item.equipment_name);
        await loadRentalPrices();
      } catch (error) {
        setError(error instanceof Error ? error.message : "Could not save. Reload prices and try again.");
      } finally { setBusy(false); }
    }}>
      <h2 className="text-lg font-bold">{item.equipment_name}</h2>
      <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {item.rates.map((rate, index) => <label key={rate.label} className="text-sm">{rate.label} (USD)
          <input required inputMode="decimal" disabled={busy} value={amounts[index]} onChange={event => setAmounts(current => current.map((value, position) => position === index ? event.target.value : value))} className="mt-1 w-full rounded-lg border border-[#786655] bg-[#14120f] px-3 py-2" />
        </label>)}
      </div>
      <button disabled={busy} className="rounded-lg bg-[#f4b000] px-4 py-2 font-semibold text-black">{busy ? "Saving…" : "Publish prices"}</button>
      {error && <p role="alert" className="mt-3 text-red-200">{error}</p>}
    </form>
  );
}
export default function EquipmentPricing() {
  const [published, setPublished] = useState("");
  const { rows, loading, error } = useRentalPrices();
  return <section className="mt-6 space-y-4 text-[#fff7ed]">
    <h1 className="text-2xl font-bold">Equipment and pricing</h1>
    <p className="text-sm text-[#d3c6b8]">Publish prices for new rentals. Existing agreements and invoices keep their saved prices.</p>
    <button onClick={() => void loadRentalPrices()} className="rounded-lg border border-[#786655] px-3 py-2">Reload prices</button>
    {published && <p role="status">Prices published for {published}.</p>}
    {loading && <p role="status">Loading prices…</p>}
    {error && <p role="alert">{error}</p>}
    {rows.map(item => <EquipmentPriceEditor key={item.equipment_id + JSON.stringify(item.rates)} item={item} onPublished={setPublished} />)}
  </section>;
}
