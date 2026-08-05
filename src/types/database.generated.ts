// Generated from the version-controlled Supabase migrations for Sprint 2A.5.
// Regenerate with `supabase gen types typescript --local` when the Supabase CLI
// runtime is available.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      rental_request_items: {
        Row: {
          id: string;
          rental_request_id: string;
          display_order: number;
          equipment_id: string | null;
          equipment_name: string;
          start_date: string;
          end_date: string;
          quantity: number;
          daily_rate: number;
          serial_number: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rental_request_id: string;
          display_order: number;
          equipment_id?: string | null;
          equipment_name: string;
          start_date: string;
          end_date: string;
          quantity?: number;
          daily_rate?: number;
          serial_number?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          rental_request_id?: string;
          display_order?: number;
          equipment_id?: string | null;
          equipment_name?: string;
          start_date?: string;
          end_date?: string;
          quantity?: number;
          daily_rate?: number;
          serial_number?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_request_items_rental_request_fk";
            columns: ["rental_request_id"];
            isOneToOne: false;
            referencedRelation: "rental_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_requests: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          customer_type: string;
          business_name: string | null;
          full_name: string;
          phone: string;
          email: string;
          equipment_requested: string;
          rental_start_date: string | null;
          rental_end_date: string | null;
          pickup_date: string | null;
          return_date: string | null;
          rental_duration: string | null;
          fulfillment_type: string | null;
          project_type: string | null;
          notes: string | null;
          agreement_accepted: boolean;
          status: string;
          source: string;
          assigned_to: string | null;
          internal_notes: string | null;
          priority: string;
          quote_amount: number | null;
          deposit_status: string;
          payment_status: string;
          delivery_status: string;
          availability_status: string;
          availability_notes: string | null;
          payment_link: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          customer_type?: string;
          business_name?: string | null;
          full_name: string;
          phone: string;
          email: string;
          equipment_requested: string;
          rental_start_date?: string | null;
          rental_end_date?: string | null;
          pickup_date?: string | null;
          return_date?: string | null;
          rental_duration?: string | null;
          fulfillment_type?: string | null;
          project_type?: string | null;
          notes?: string | null;
          agreement_accepted?: boolean;
          status?: string;
          source?: string;
          assigned_to?: string | null;
          internal_notes?: string | null;
          priority?: string;
          quote_amount?: number | null;
          deposit_status?: string;
          payment_status?: string;
          delivery_status?: string;
          availability_status?: string;
          availability_notes?: string | null;
          payment_link?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          customer_type?: string;
          business_name?: string | null;
          full_name?: string;
          phone?: string;
          email?: string;
          equipment_requested?: string;
          rental_start_date?: string | null;
          rental_end_date?: string | null;
          pickup_date?: string | null;
          return_date?: string | null;
          rental_duration?: string | null;
          fulfillment_type?: string | null;
          project_type?: string | null;
          notes?: string | null;
          agreement_accepted?: boolean;
          status?: string;
          source?: string;
          assigned_to?: string | null;
          internal_notes?: string | null;
          priority?: string;
          quote_amount?: number | null;
          deposit_status?: string;
          payment_status?: string;
          delivery_status?: string;
          availability_status?: string;
          availability_notes?: string | null;
          payment_link?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_rental_request_with_items: {
        Args: {
          request_payload: Json;
          item_payloads: Json;
        };
        Returns: string;
      };
      replace_rental_request_items: {
        Args: {
          target_rental_request_id: string;
          item_payloads: Json;
          legacy_fields: Json;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
