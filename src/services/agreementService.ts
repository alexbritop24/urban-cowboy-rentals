import { supabase } from "../lib/supabase";
import type { RentalAgreement } from "../types/agreement";

interface RentalRequestForAgreement {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  equipment_requested: string;
  rental_start_date: string;
  rental_end_date: string;
  rental_duration: string;
  fulfillment_type: string;
  quote_amount: number | null;
}

const generateAgreementNumber = () => {
  return `UCR-${Date.now()}`;
};

export const getRentalAgreementByRequestId = async (
  rentalRequestId: string
): Promise<RentalAgreement | null> => {
  const { data, error } = await supabase
    .from("rental_agreements")
    .select("*")
    .eq("rental_request_id", rentalRequestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("GET RENTAL AGREEMENT ERROR:", error);
    return null;
  }

  return data;
};

export const createRentalAgreement = async (
  request: RentalRequestForAgreement
): Promise<RentalAgreement | null> => {
  const existingAgreement = await getRentalAgreementByRequestId(request.id);

  if (existingAgreement) {
    return existingAgreement;
  }

  const quoteAmount = Number(request.quote_amount) || 0;

  const { data, error } = await supabase
    .from("rental_agreements")
    .insert({
      rental_request_id: request.id,
      agreement_number: generateAgreementNumber(),
      status: "draft",
      customer_name: request.full_name,
      customer_email: request.email,
      customer_phone: request.phone,
      equipment_requested: request.equipment_requested,
      rental_start_date: request.rental_start_date,
      rental_end_date: request.rental_end_date,
      rental_duration: request.rental_duration,
      fulfillment_type: request.fulfillment_type,
      quote_amount: quoteAmount,
      deposit_amount: 0,
      delivery_fee: 0,
      tax_amount: 0,
      total_amount: quoteAmount,
      agreement_html: null,
      signed_pdf_url: null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("CREATE RENTAL AGREEMENT ERROR:", error);
    alert(JSON.stringify(error, null, 2));
    return null;
  }

  return data;
};