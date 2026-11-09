export interface BookingRequest {
  customerType: "individual" | "business";
  businessName: string | null;
  fullName: string;
  phone: string;
  email: string;
  equipmentRequested: string;
  pickupDate: string;
  returnDate: string;
  rentalDuration: string;
  fulfillmentType: "Pickup" | "Delivery" | "";
  projectType: string;
  notes: string;
  agreementAccepted: boolean;
  status: "new";
  source: "website";
  submittedAt: string;
  eventType: "new_request";
}