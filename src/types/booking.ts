export interface BookingRequest {
  fullName: string;
  phone: string;
  email: string;
  equipmentRequested: string;
  rentalStartDate: string;
  rentalEndDate: string;
  rentalDuration: string;
  fulfillmentType: "Pickup" | "Delivery" | "";
  projectType: string;
  notes: string;
  agreementAccepted: boolean;
  status: "new";
  source: "website";
  submittedAt: string;
}