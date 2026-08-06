// Generated from the version-controlled Supabase Release 1 migrations.
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
      agreement_clauses: {
        Row: {
          id: string;
          clause_key: string | null;
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
        };
        Insert: {
          id?: string;
          clause_key?: string | null;
          title: string;
          body: string;
          display_order?: number;
          enabled?: boolean;
          category?: string;
          equipment_category?: string | null;
          state_code?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          clause_key?: string | null;
          title?: string;
          body?: string;
          display_order?: number;
          enabled?: boolean;
          category?: string;
          equipment_category?: string | null;
          state_code?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      agreement_items: {
        Row: {
          id: string;
          rental_agreement_id: string;
          rental_request_item_id: string | null;
          display_order: number;
          equipment_id: string | null;
          equipment_name: string;
          serial_number: string | null;
          start_date: string;
          end_date: string;
          quantity: number;
          daily_rate: number;
          billable_days: number;
          line_total: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          rental_agreement_id: string;
          rental_request_item_id?: string | null;
          display_order: number;
          equipment_id?: string | null;
          equipment_name: string;
          serial_number?: string | null;
          start_date: string;
          end_date: string;
          quantity: number;
          daily_rate: number;
          billable_days: number;
          line_total: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          rental_agreement_id?: string;
          rental_request_item_id?: string | null;
          display_order?: number;
          equipment_id?: string | null;
          equipment_name?: string;
          serial_number?: string | null;
          start_date?: string;
          end_date?: string;
          quantity?: number;
          daily_rate?: number;
          billable_days?: number;
          line_total?: number;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agreement_items_agreement_fk";
            columns: ["rental_agreement_id"];
            isOneToOne: false;
            referencedRelation: "rental_agreements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agreement_items_request_item_fk";
            columns: ["rental_request_item_id"];
            isOneToOne: false;
            referencedRelation: "rental_request_items";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          agreement_item_id: string | null;
          rental_request_item_id: string | null;
          display_order: number;
          equipment_id: string | null;
          equipment_name: string;
          serial_number: string | null;
          start_date: string;
          end_date: string;
          quantity: number;
          daily_rate: number;
          billable_days: number;
          line_total: number;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          agreement_item_id?: string | null;
          rental_request_item_id?: string | null;
          display_order: number;
          equipment_id?: string | null;
          equipment_name: string;
          serial_number?: string | null;
          start_date: string;
          end_date: string;
          quantity: number;
          daily_rate: number;
          billable_days: number;
          line_total: number;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          agreement_item_id?: string | null;
          rental_request_item_id?: string | null;
          display_order?: number;
          equipment_id?: string | null;
          equipment_name?: string;
          serial_number?: string | null;
          start_date?: string;
          end_date?: string;
          quantity?: number;
          daily_rate?: number;
          billable_days?: number;
          line_total?: number;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_fk";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_items_agreement_item_fk";
            columns: ["agreement_item_id"];
            isOneToOne: false;
            referencedRelation: "agreement_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_items_request_item_fk";
            columns: ["rental_request_item_id"];
            isOneToOne: false;
            referencedRelation: "rental_request_items";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          id: string;
          rental_agreement_id: string | null;
          rental_request_id: string | null;
          invoice_number: string | null;
          invoice_type: string;
          status: string;
          customer_type: string | null;
          customer_name: string | null;
          business_name: string | null;
          customer_email: string | null;
          customer_phone: string | null;
          billing_address: string | null;
          service_address: string | null;
          equipment_requested: string | null;
          rental_start_date: string | null;
          rental_end_date: string | null;
          source_agreement_snapshot_hash: string | null;
          currency: string;
          payment_terms: string;
          subtotal: number;
          deposit_amount: number;
          delivery_fee: number;
          tax_amount: number;
          other_charges_amount: number;
          total_amount: number;
          amount_paid: number;
          balance_due: number;
          payment_status: string;
          payment_link: string | null;
          notes: string | null;
          issue_date: string | null;
          issued_at: string | null;
          due_at: string | null;
          paid_at: string | null;
          voided_at: string | null;
          created_by: string | null;
          issued_by: string | null;
          pdf_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rental_agreement_id?: string | null;
          rental_request_id?: string | null;
          invoice_number?: string | null;
          invoice_type?: string;
          status?: string;
          customer_type?: string | null;
          customer_name?: string | null;
          business_name?: string | null;
          customer_email?: string | null;
          customer_phone?: string | null;
          billing_address?: string | null;
          service_address?: string | null;
          equipment_requested?: string | null;
          rental_start_date?: string | null;
          rental_end_date?: string | null;
          source_agreement_snapshot_hash?: string | null;
          currency?: string;
          payment_terms?: string;
          subtotal?: number;
          deposit_amount?: number;
          delivery_fee?: number;
          tax_amount?: number;
          other_charges_amount?: number;
          total_amount?: number;
          amount_paid?: number;
          balance_due?: number;
          payment_status?: string;
          payment_link?: string | null;
          notes?: string | null;
          issue_date?: string | null;
          issued_at?: string | null;
          due_at?: string | null;
          paid_at?: string | null;
          voided_at?: string | null;
          created_by?: string | null;
          issued_by?: string | null;
          pdf_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          rental_agreement_id?: string | null;
          rental_request_id?: string | null;
          invoice_number?: string | null;
          invoice_type?: string;
          status?: string;
          customer_type?: string | null;
          customer_name?: string | null;
          business_name?: string | null;
          customer_email?: string | null;
          customer_phone?: string | null;
          billing_address?: string | null;
          service_address?: string | null;
          equipment_requested?: string | null;
          rental_start_date?: string | null;
          rental_end_date?: string | null;
          source_agreement_snapshot_hash?: string | null;
          currency?: string;
          payment_terms?: string;
          subtotal?: number;
          deposit_amount?: number;
          delivery_fee?: number;
          tax_amount?: number;
          other_charges_amount?: number;
          total_amount?: number;
          amount_paid?: number;
          balance_due?: number;
          payment_status?: string;
          payment_link?: string | null;
          notes?: string | null;
          issue_date?: string | null;
          issued_at?: string | null;
          due_at?: string | null;
          paid_at?: string | null;
          voided_at?: string | null;
          created_by?: string | null;
          issued_by?: string | null;
          pdf_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_rental_agreement_fk";
            columns: ["rental_agreement_id"];
            isOneToOne: false;
            referencedRelation: "rental_agreements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_rental_request_fk";
            columns: ["rental_request_id"];
            isOneToOne: false;
            referencedRelation: "rental_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          invoice_id: string | null;
          amount: number | null;
          payment_method: string | null;
          reference_number: string | null;
          notes: string | null;
          received_at: string;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_id?: string | null;
          amount?: number | null;
          payment_method?: string | null;
          reference_number?: string | null;
          notes?: string | null;
          received_at?: string;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string | null;
          amount?: number | null;
          payment_method?: string | null;
          reference_number?: string | null;
          notes?: string | null;
          received_at?: string;
          recorded_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_invoice_fk";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      rental_agreements: {
        Row: {
          id: string;
          rental_request_id: string;
          agreement_number: string;
          status: string;
          customer_type: string;
          customer_name: string;
          business_name: string | null;
          customer_email: string;
          customer_phone: string;
          billing_address: string | null;
          service_address: string | null;
          equipment_requested: string;
          rental_start_date: string | null;
          rental_end_date: string | null;
          rental_duration: string | null;
          fulfillment_type: string | null;
          quote_amount: number;
          deposit_amount: number;
          delivery_fee: number;
          tax_amount: number;
          total_amount: number;
          agreement_html: string | null;
          signed_pdf_url: string | null;
          effective_at: string;
          signature_status: string;
          acceptance_acknowledged: boolean;
          authorized_signer_name: string | null;
          authorized_signer_title: string | null;
          accepted_terms_version: string | null;
          snapshot_schema_version: number | null;
          current_snapshot_hash: string | null;
          accepted_snapshot_hash: string | null;
          credit_card_authorization_terms: string | null;
          credit_card_authorization_acknowledged: boolean;
          credit_card_authorization_acknowledged_at: string | null;
          insurance_verification_status: string;
          availability_confirmation_status: string;
          terms_version: string | null;
          clause_snapshot: Json;
          clause_snapshot_created_at: string | null;
          sent_at: string | null;
          viewed_at: string | null;
          signed_at: string | null;
          signed_by: string | null;
          locked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rental_request_id: string;
          agreement_number: string;
          status?: string;
          customer_type?: string;
          customer_name: string;
          business_name?: string | null;
          customer_email: string;
          customer_phone: string;
          billing_address?: string | null;
          service_address?: string | null;
          equipment_requested: string;
          rental_start_date?: string | null;
          rental_end_date?: string | null;
          rental_duration?: string | null;
          fulfillment_type?: string | null;
          quote_amount?: number;
          deposit_amount?: number;
          delivery_fee?: number;
          tax_amount?: number;
          total_amount?: number;
          agreement_html?: string | null;
          signed_pdf_url?: string | null;
          effective_at?: string;
          signature_status?: string;
          acceptance_acknowledged?: boolean;
          authorized_signer_name?: string | null;
          authorized_signer_title?: string | null;
          accepted_terms_version?: string | null;
          snapshot_schema_version?: number | null;
          current_snapshot_hash?: string | null;
          accepted_snapshot_hash?: string | null;
          credit_card_authorization_terms?: string | null;
          credit_card_authorization_acknowledged?: boolean;
          credit_card_authorization_acknowledged_at?: string | null;
          insurance_verification_status?: string;
          availability_confirmation_status?: string;
          terms_version?: string | null;
          clause_snapshot?: Json;
          clause_snapshot_created_at?: string | null;
          sent_at?: string | null;
          viewed_at?: string | null;
          signed_at?: string | null;
          signed_by?: string | null;
          locked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          rental_request_id?: string;
          agreement_number?: string;
          status?: string;
          customer_type?: string;
          customer_name?: string;
          business_name?: string | null;
          customer_email?: string;
          customer_phone?: string;
          billing_address?: string | null;
          service_address?: string | null;
          equipment_requested?: string;
          rental_start_date?: string | null;
          rental_end_date?: string | null;
          rental_duration?: string | null;
          fulfillment_type?: string | null;
          quote_amount?: number;
          deposit_amount?: number;
          delivery_fee?: number;
          tax_amount?: number;
          total_amount?: number;
          agreement_html?: string | null;
          signed_pdf_url?: string | null;
          effective_at?: string;
          signature_status?: string;
          acceptance_acknowledged?: boolean;
          authorized_signer_name?: string | null;
          authorized_signer_title?: string | null;
          accepted_terms_version?: string | null;
          snapshot_schema_version?: number | null;
          current_snapshot_hash?: string | null;
          accepted_snapshot_hash?: string | null;
          credit_card_authorization_terms?: string | null;
          credit_card_authorization_acknowledged?: boolean;
          credit_card_authorization_acknowledged_at?: string | null;
          insurance_verification_status?: string;
          availability_confirmation_status?: string;
          terms_version?: string | null;
          clause_snapshot?: Json;
          clause_snapshot_created_at?: string | null;
          sent_at?: string | null;
          viewed_at?: string | null;
          signed_at?: string | null;
          signed_by?: string | null;
          locked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rental_agreements_rental_request_fk";
            columns: ["rental_request_id"];
            isOneToOne: true;
            referencedRelation: "rental_requests";
            referencedColumns: ["id"];
          },
        ];
      };
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
          billing_address: string | null;
          service_address: string | null;
          insurance_verification_status: string;
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
          billing_address?: string | null;
          service_address?: string | null;
          insurance_verification_status?: string;
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
          billing_address?: string | null;
          service_address?: string | null;
          insurance_verification_status?: string;
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
      has_rental_request_conflict: {
        Args: {
          requested_equipment_name: string;
          requested_pickup: string;
          requested_return: string;
        };
        Returns: boolean;
      };
      get_rental_request_item_editability: {
        Args: {
          target_rental_request_id: string;
        };
        Returns: Json;
      };
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
      create_rental_agreement_for_request: {
        Args: {
          target_rental_request_id: string;
        };
        Returns: string;
      };
      update_rental_agreement_financials: {
        Args: {
          target_agreement_id: string;
          deposit_amount_value: number;
          delivery_fee_value: number;
          tax_amount_value: number;
        };
        Returns: string;
      };
      record_rental_agreement_acceptance: {
        Args: {
          target_agreement_id: string;
          signer_legal_name: string;
          signer_title: string | null;
          agreement_accepted: boolean;
          card_authorization_acknowledged: boolean;
        };
        Returns: string;
      };
      finalize_rental_agreement: {
        Args: {
          target_agreement_id: string;
        };
        Returns: string;
      };
      create_invoice_for_agreement: {
        Args: {
          target_rental_agreement_id: string;
        };
        Returns: string;
      };
      issue_invoice: {
        Args: {
          target_invoice_id: string;
        };
        Returns: string;
      };
      record_invoice_payment: {
        Args: {
          target_invoice_id: string;
          payment_amount: number;
          payment_method_value: string;
          reference_number_value?: string | null;
          notes_value?: string | null;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
