export interface LegacyItemFields {
  equipment_requested: string | null;
  rental_start_date: string | null;
  rental_end_date: string | null;
}

export type LegacyItemFieldSource = Partial<LegacyItemFields>;
