import { useSyncExternalStore } from "react";
import { publicSupabase } from "../lib/supabase";
import type { EquipmentRate } from "../types/equipment";

export interface RentalPrices {
  equipment_id: string;
  equipment_name: string;
  daily_rate: number;
  rates: EquipmentRate[];
}
let state: { rows: RentalPrices[]; loading: boolean; error: string } = { rows: [], loading: true, error: "" };
const listeners = new Set<() => void>();
let pending: Promise<void> | null = null;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const loadRentalPrices = (): Promise<void> => {
  if (pending) return pending;
  pending = (async () => {
    try {
      const { data, error } = await publicSupabase.rpc("get_rental_rates");
      if (error || !Array.isArray(data)) throw new Error("Rental rates are unavailable. Please contact us for pricing.");
      state = { rows: data.map(row => ({ ...row, daily_rate: Number(row.daily_rate) })), loading: false, error: "" };
    } catch {
      state = { rows: [], loading: false, error: "Rental rates are unavailable. Please contact us for pricing." };
    } finally {
      pending = null;
      listeners.forEach(listener => listener());
    }
  })();
  return pending;
};
export const useRentalPrices = () => useSyncExternalStore(subscribe, () => state);
