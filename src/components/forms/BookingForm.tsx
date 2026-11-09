import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getBookableEquipment } from "../../data/equipmentSelectors";
import { publicSupabase } from "../../lib/supabase";
import BookingSuccess from "./BookingSuccess";
import MultiItemBookingForm from "./MultiItemBookingForm";
import { applicationFeatureFlags } from "../../config/featureFlags";

import type { BookingRequest } from "../../types/booking";

const initialFormState = {
  customerType: "individual" as BookingRequest["customerType"],
  businessName: "",
  fullName: "",
  phone: "",
  email: "",
  equipmentRequested: "",
  pickupDate: "",
  returnDate: "",
  fulfillmentType: "" as BookingRequest["fulfillmentType"],
  projectType: "",
  notes: "",
  agreementAccepted: false,
};

const activeEquipment = getBookableEquipment();

const LegacyBookingForm = () => {
  const [searchParams] = useSearchParams();

  const equipmentQuery = searchParams.get("equipment");

  const defaultEquipment = useMemo(() => {
    const foundEquipment = activeEquipment.find(
      (item) => item.id === equipmentQuery
    );

    return foundEquipment?.name || "";
  }, [equipmentQuery]);

  const [formData, setFormData] = useState({
    ...initialFormState,
    equipmentRequested: defaultEquipment,
  });

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const submitting = useRef(false);
  const selectedEquipment = activeEquipment.find((item) => item.name === formData.equipmentRequested);

  const normalizePhoneNumber = (phone: string) => {
    return phone.replace(/\D/g, "");
  };

  const getDateOnly = (dateTimeValue: string) => {
    return dateTimeValue ? dateTimeValue.split("T")[0] : null;
  };

  const calculateRentalDuration = (pickupDate: string, returnDate: string) => {
    if (!pickupDate || !returnDate) return "";

    const pickupTime = new Date(pickupDate).getTime();
    const returnTime = new Date(returnDate).getTime();

    if (Number.isNaN(pickupTime) || Number.isNaN(returnTime)) return "";
    if (returnTime <= pickupTime) return "";

    const diffMs = returnTime - pickupTime;
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffHours / 24);
    const hours = diffHours % 24;

    if (days === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
    if (hours === 0) return `${days} day${days === 1 ? "" : "s"}`;

    return `${days} day${days === 1 ? "" : "s"} ${hours} hour${
      hours === 1 ? "" : "s"
    }`;
  };

  const rentalDuration = calculateRentalDuration(
    formData.pickupDate,
    formData.returnDate
  );

  const checkAvailabilityConflict = async (
    equipmentRequested: string,
    pickupDate: string,
    returnDate: string
  ) => {
    const { data, error } = await publicSupabase
      .rpc("has_rental_request_conflict", {
        requested_equipment_name: equipmentRequested,
        requested_pickup: pickupDate,
        requested_return: returnDate,
      });

    if (error) {
      console.error("AVAILABILITY CHECK ERROR:", error);
      return false;
    }

    return Boolean(data);
  };

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    setBookingError("");

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : value,
    }));
  };

  const notifyN8n = (bookingRequest: BookingRequest) => {
    const webhookUrl = import.meta.env.VITE_N8N_RENTAL_REQUEST_WEBHOOK;

    if (!webhookUrl) {
      console.warn("N8N webhook URL missing.");
      return;
    }

    fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bookingRequest),
    }).catch((error) => {
      console.error("N8N WEBHOOK ERROR:", error);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting.current) return;

    setBookingError("");

    if (formData.customerType === "business" && !formData.businessName.trim()) {
      setBookingError("Enter your legal business name.");
      return;
    }

    if (!rentalDuration) {
      setBookingError("Choose a return date and time after the rental start.");
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);

    try {
      const hasConflict = await checkAvailabilityConflict(
        formData.equipmentRequested,
        formData.pickupDate,
        formData.returnDate
      );

      if (hasConflict) {
        setBookingError(
          "This equipment is already booked during the selected dates. Please choose another time or contact Urban Cowboy Rentals."
        );
        return;
      }

      const bookingRequest: BookingRequest = {
        ...formData,
        businessName: formData.customerType === "business" ? formData.businessName.trim() : null,
        phone: normalizePhoneNumber(formData.phone),
        rentalDuration,
        status: "new",
        source: "website",
        submittedAt: new Date().toISOString(),
        eventType: "new_request",
      };

      const { error } = await publicSupabase.from("rental_requests").insert({
        customer_type: bookingRequest.customerType,
        business_name: bookingRequest.businessName,
        full_name: bookingRequest.fullName,
        phone: bookingRequest.phone,
        email: bookingRequest.email,
        equipment_requested: bookingRequest.equipmentRequested,
        rental_start_date: getDateOnly(bookingRequest.pickupDate),
        rental_end_date: getDateOnly(bookingRequest.returnDate),
        pickup_date: bookingRequest.pickupDate || null,
        return_date: bookingRequest.returnDate || null,
        rental_duration: bookingRequest.rentalDuration,
        fulfillment_type: bookingRequest.fulfillmentType,
        project_type: bookingRequest.projectType,
        notes: bookingRequest.notes,
        agreement_accepted: bookingRequest.agreementAccepted,
        status: bookingRequest.status,
        source: bookingRequest.source,
        priority: "normal",
        payment_status: "unpaid",
        deposit_status: "not_required",
        delivery_status: "not_scheduled",
        availability_status: "pending_review",
        availability_notes: null,
      });

      if (error) {
        console.error("SUPABASE INSERT ERROR:", error);
        setBookingError("We couldn’t save your request. Your details are still here. Please try again.");
        return;
      }

      notifyN8n(bookingRequest);

      setIsSubmitted(true);
    } catch (error) {
      console.error("BOOKING SUBMIT ERROR:", error);

      setBookingError("We couldn’t submit your request. Your details are still here. Please try again.");
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return <BookingSuccess equipmentName={selectedEquipment?.name} />;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-yellow-500/10 bg-[#11100d]/90 p-4 sm:p-8 shadow-2xl shadow-black/30"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="rental-equipmentRequested" className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Equipment Requested
          </label>

          <select
            id="rental-equipmentRequested"
            name="equipmentRequested"
            value={formData.equipmentRequested}
            onChange={handleChange}
            required
            className="min-w-0 w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition focus:border-yellow-500/40"
          >
            <option value="">Select equipment</option>

            {activeEquipment.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
          {selectedEquipment && (
            <p className="mt-2 text-sm text-[#d8c9bb]" aria-live="polite">
              Starting rate <strong className="text-[#f4b000]">${selectedEquipment.startingPrice.toLocaleString("en-US")}</strong>.
              We’ll confirm the final price and availability after reviewing your request.
            </p>
          )}
        </div>

        <fieldset className="md:col-span-2">
          <legend className="mb-2 text-sm font-bold text-[#fff7ed]">Who is renting?</legend>
          <div className="flex flex-wrap gap-3">
            {(["individual", "business"] as const).map((customerType) => (
              <label key={customerType} className="flex items-center gap-2 rounded-xl border border-yellow-500/20 px-4 py-3 capitalize text-[#fff7ed]">
                <input
                  type="radio"
                  name="customerType"
                  value={customerType}
                  checked={formData.customerType === customerType}
                  onChange={() => {
                    setBookingError("");
                    setFormData((previous) => ({ ...previous, customerType }));
                  }}
                />
                {customerType}
              </label>
            ))}
          </div>
        </fieldset>

        {formData.customerType === "business" && (
          <div className="md:col-span-2">
            <label htmlFor="rental-businessName" className="mb-2 block text-sm font-bold text-[#fff7ed]">
              Legal business name
            </label>
            <input
              id="rental-businessName"
              name="businessName"
              autoComplete="organization"
              required
              maxLength={200}
              value={formData.businessName}
              onChange={handleChange}
              className="min-w-0 w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] focus:border-yellow-500/40"
            />
          </div>
        )}

        <div>
          <label htmlFor="rental-fullName" className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Full Name
          </label>

          <input
            type="text"
            id="rental-fullName"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            required
            placeholder="John Smith"
            className="min-w-0 w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition placeholder:text-[#b8a99a]/50 focus:border-yellow-500/40"
          />
        </div>

        <div>
          <label htmlFor="rental-phone" className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Phone Number
          </label>

          <input
            type="tel"
            id="rental-phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
            placeholder="801-903-9380"
            className="min-w-0 w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition placeholder:text-[#b8a99a]/50 focus:border-yellow-500/40"
          />
        </div>

        <div>
          <label htmlFor="rental-email" className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Email
          </label>

          <input
            type="email"
            id="rental-email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="name@email.com"
            className="min-w-0 w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition placeholder:text-[#b8a99a]/50 focus:border-yellow-500/40"
          />
        </div>

        <div>
          <label htmlFor="rental-pickupDate" className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Pickup Date & Time
          </label>

          <input
            type="datetime-local"
            id="rental-pickupDate"
            name="pickupDate"
            value={formData.pickupDate}
            onChange={handleChange}
            required
            className="min-w-0 w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition focus:border-yellow-500/40"
          />
        </div>

        <div>
          <label htmlFor="rental-returnDate" className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Return Date & Time
          </label>

          <input
            type="datetime-local"
            id="rental-returnDate"
            name="returnDate"
            value={formData.returnDate}
            onChange={handleChange}
            required
            className="min-w-0 w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition focus:border-yellow-500/40"
          />
        </div>

        <div>
          <p className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Estimated Rental Duration
          </p>

          <div className="flex min-h-[58px] items-center rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed]">
            {rentalDuration || "Select pickup and return time"}
          </div>
        </div>

        <div>
          <label htmlFor="rental-fulfillmentType" className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Pickup or Delivery
          </label>

          <select
            id="rental-fulfillmentType"
            name="fulfillmentType"
            value={formData.fulfillmentType}
            onChange={handleChange}
            required
            className="min-w-0 w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition focus:border-yellow-500/40"
          >
            <option value="">Select option</option>
            <option value="Pickup">Pickup</option>
            <option value="Delivery">Delivery</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="rental-projectType" className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Project Type / Reason For Rental
          </label>

          <input
            type="text"
            id="rental-projectType"
            name="projectType"
            value={formData.projectType}
            onChange={handleChange}
            placeholder="Construction, hauling, demolition, weekend ride, etc."
            className="min-w-0 w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition placeholder:text-[#b8a99a]/50 focus:border-yellow-500/40"
          />
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor="rental-notes" className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
          Notes
        </label>

        <textarea
          id="rental-notes"
          name="notes"
          rows={5}
          value={formData.notes}
          onChange={handleChange}
          placeholder="Add delivery address, preferred pickup time, attachments needed, or other details."
          className="min-w-0 w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition placeholder:text-[#b8a99a]/50 focus:border-yellow-500/40"
        />
      </div>

      <div className="mt-6 flex items-start gap-3">
        <input
          type="checkbox"
          id="rental-acknowledgment"
          name="agreementAccepted"
          checked={formData.agreementAccepted}
          onChange={handleChange}
          required
          className="mt-1"
        />

        <label htmlFor="rental-acknowledgment" className="text-sm leading-relaxed text-[#b8a99a]">
          I understand this is a rental request and availability, final price,
          payment, deposit, pickup, and delivery details must be confirmed by
          Urban Cowboy Rentals before the rental is approved.
        </label>
      </div>

      {bookingError && (
        <div role="alert" className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4">
          <p className="text-sm font-semibold text-red-300">{bookingError}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-8 w-full rounded-full bg-[#f4b000] px-8 py-5 text-lg font-black uppercase tracking-[0.08em] text-black transition hover:bg-[#f59e0b] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Submitting Request..." : "Submit Rental Request"}
      </button>
    </form>
  );
};

const BookingForm = () =>
  applicationFeatureFlags.multiItemRentalRequests ? (
    <MultiItemBookingForm />
  ) : (
    <LegacyBookingForm />
  );

export default BookingForm;
