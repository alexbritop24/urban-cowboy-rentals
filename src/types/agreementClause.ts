export interface AgreementClause {
  id: string;
  title: string;
  body: string;
  display_order: number;
  enabled: boolean;
  category: string;
  equipment_category: string | null;
  state_code: string;
  version: number;
  created_at: string;
  updated_at: string;
}