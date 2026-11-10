import { CalendarDays, ChevronDown, Package, UserRound } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getBookableEquipment } from "../../data/equipmentSelectors";
import { publicSupabase } from "../../lib/supabase";
import { mountainBookingDateTimeToIso } from "../../utils/bookingDateTime";
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

const labelClass = "mb-1.5 block text-sm font-semibold";
const controlClass = "min-h-12 w-full min-w-0 rounded-xl border border-[#b8aa96] bg-white px-3 text-base text-[#201b14] placeholder:text-[#6a5e50] focus:border-[#805300] focus:outline-2 focus:outline-offset-1 focus:outline-[#805300]";
const dateClass = `${controlClass} [&::-webkit-date-and-time-value]:text-left`;
const selectClass = `${controlClass} appearance-none pr-10 forced-colors:appearance-auto`;
const selectIconClass = "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#51432d] forced-colors:hidden";
const sectionTitleClass = "flex items-center gap-2 text-lg font-bold";
const gridClass = "grid grid-cols-1 gap-4 sm:grid-cols-2";

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

  const calculateRentalDuration = (pickupDate: string | null, returnDate: string | null) => {
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

  const pickupDateIso = useMemo(() => mountainBookingDateTimeToIso(formData.pickupDate), [formData.pickupDate]);
  const returnDateIso = useMemo(() => mountainBookingDateTimeToIso(formData.returnDate), [formData.returnDate]);
  const rentalDuration = calculateRentalDuration(pickupDateIso, returnDateIso);

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

    if (!pickupDateIso || !returnDateIso) {
      setBookingError("Choose valid Mountain Time dates and times. Some times are skipped when the clocks change.");
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
        pickupDateIso,
        returnDateIso
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
        pickup_date: pickupDateIso,
        return_date: returnDateIso,
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
      aria-label="Equipment rental request"
      className="overflow-hidden rounded-3xl border border-white/15 bg-[#fcfaf6] text-[#201b14] shadow-2xl shadow-black/25 [color-scheme:light]"
    >
      <div className="divide-y divide-[#e4dbcd] px-5 sm:px-8">
        <section aria-labelledby="booking-equipment-heading" className="space-y-4 py-6">
          <h2 id="booking-equipment-heading" className={sectionTitleClass}>
            <Package size={19} aria-hidden="true" /> Equipment
          </h2>
          <div>
            <label htmlFor="rental-equipmentRequested" className={labelClass}>Equipment requested</label>
            <div className="relative">
              <select
                id="rental-equipmentRequested"
                name="equipmentRequested"
                value={formData.equipmentRequested}
                onChange={handleChange}
                required
                className={selectClass}
              >
                <option value="">Select equipment</option>
                {activeEquipment.map((item) => (
                  <option key={item.id} value={item.name}>{item.name}</option>
                ))}
              </select>
              <ChevronDown size={18} aria-hidden="true" className={selectIconClass} />
            </div>
          </div>
          {selectedEquipment && (
            <div aria-live="polite" className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-[#fff0c9] px-4 py-3 text-sm">
              <p className="font-semibold">
                Starting rate <strong className="ml-1 text-lg">${selectedEquipment.startingPrice.toLocaleString("en-US")}</strong>
              </p>
              <p className="text-[#51432d]">We’ll confirm the final price and availability after review.</p>
            </div>
          )}
        </section>

        <section aria-labelledby="booking-schedule-heading" className="space-y-4 py-6">
          <h2 id="booking-schedule-heading" className={sectionTitleClass}>
            <CalendarDays size={19} aria-hidden="true" /> Rental schedule
          </h2>
          <p className="text-sm text-[#635849]">Rental times are in Utah’s Mountain Time.</p>
          <div className={gridClass}>
            <div>
              <label htmlFor="rental-pickupDate" className={labelClass}>Rental start date and time</label>
              <input
                type="datetime-local"
                id="rental-pickupDate"
                name="pickupDate"
                value={formData.pickupDate}
                onChange={handleChange}
                required
                className={dateClass}
              />
            </div>
            <div>
              <label htmlFor="rental-returnDate" className={labelClass}>Return date and time</label>
              <input
                type="datetime-local"
                id="rental-returnDate"
                name="returnDate"
                value={formData.returnDate}
                onChange={handleChange}
                required
                className={dateClass}
              />
            </div>
            <div>
              <label htmlFor="rental-fulfillmentType" className={labelClass}>Pickup or delivery</label>
              <div className="relative">
                <select
                  id="rental-fulfillmentType"
                  name="fulfillmentType"
                  value={formData.fulfillmentType}
                  onChange={handleChange}
                  required
                  className={selectClass}
                >
                  <option value="">Select an option</option>
                  <option value="Pickup">Pickup</option>
                  <option value="Delivery">Delivery</option>
                </select>
                <ChevronDown size={18} aria-hidden="true" className={selectIconClass} />
              </div>
            </div>
            {rentalDuration && (
              <p className="self-end rounded-xl bg-[#f0ebe1] px-4 py-3 text-sm" aria-live="polite">
                Estimated duration <strong>{rentalDuration}</strong>
              </p>
            )}
          </div>
        </section>

        <section aria-labelledby="booking-contact-heading" className="space-y-4 py-6">
          <h2 id="booking-contact-heading" className={sectionTitleClass}>
            <UserRound size={19} aria-hidden="true" /> Contact details
          </h2>
          <fieldset>
            <legend className={labelClass}>Who is renting?</legend>
            <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
              {(["individual", "business"] as const).map((customerType) => (
                <label
                  key={customerType}
                  className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-[#b8aa96] bg-white px-3 text-sm font-medium capitalize has-checked:border-[#8c5b00] has-checked:bg-[#fff0c9] sm:px-4"
                >
                  <input
                    type="radio"
                    name="customerType"
                    value={customerType}
                    checked={formData.customerType === customerType}
                    onChange={() => {
                      setBookingError("");
                      setFormData((previous) => ({ ...previous, customerType }));
                    }}
                    className="size-4 accent-[#805300] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#805300]"
                  />
                  {customerType}
                </label>
              ))}
            </div>
          </fieldset>

          <div className={gridClass}>
            {formData.customerType === "business" && (
              <div className="sm:col-span-2">
                <label htmlFor="rental-businessName" className={labelClass}>Legal business name</label>
                <input
                  id="rental-businessName"
                  name="businessName"
                  autoComplete="organization"
                  required
                  maxLength={200}
                  value={formData.businessName}
                  onChange={handleChange}
                  className={controlClass}
                />
              </div>
            )}
            <div>
              <label htmlFor="rental-fullName" className={labelClass}>Full name</label>
              <input
                id="rental-fullName"
                name="fullName"
                autoComplete="name"
                value={formData.fullName}
                onChange={handleChange}
                required
                className={controlClass}
              />
            </div>
            <div>
              <label htmlFor="rental-phone" className={labelClass}>Phone number</label>
              <input
                type="tel"
                id="rental-phone"
                name="phone"
                autoComplete="tel"
                value={formData.phone}
                onChange={handleChange}
                required
                className={controlClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="rental-email" className={labelClass}>Email</label>
              <input
                type="email"
                id="rental-email"
                name="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                required
                className={controlClass}
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="booking-notes-heading" className="space-y-4 py-6">
          <h2 id="booking-notes-heading" className="text-base font-semibold">Additional details <span className="ml-1 text-sm font-normal text-[#635849]">Optional</span></h2>
          <div>
            <label htmlFor="rental-projectType" className={labelClass}>What are you working on?</label>
            <input
              id="rental-projectType"
              name="projectType"
              value={formData.projectType}
              onChange={handleChange}
              placeholder="For example, grading a driveway"
              className={controlClass}
            />
          </div>
          <div>
            <label htmlFor="rental-notes" className={labelClass}>Notes</label>
            <textarea
              id="rental-notes"
              name="notes"
              rows={3}
              value={formData.notes}
              onChange={handleChange}
              placeholder="Delivery address, preferred pickup time, or attachments needed"
              className={`${controlClass} py-3`}
            />
          </div>
        </section>
      </div>

      <div className="space-y-4 border-t border-[#e4dbcd] bg-[#f4efe5] px-5 py-6 sm:px-8">
        <label htmlFor="rental-acknowledgment" className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-[#40372a]">
          <input
            type="checkbox"
            id="rental-acknowledgment"
            name="agreementAccepted"
            checked={formData.agreementAccepted}
            onChange={handleChange}
            required
            className="mt-0.5 size-5 shrink-0 accent-[#805300] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#805300]"
          />
          <span>
            I understand this is a rental request and availability, final price,
            payment, deposit, pickup, and delivery details must be confirmed by
            Urban Cowboy Rentals before the rental is approved.
          </span>
        </label>

        {bookingError && (
          <p role="alert" className="rounded-xl border border-[#e5b6ad] bg-[#fff0ec] px-4 py-3 text-sm font-semibold text-[#8a241b]">
            {bookingError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-12 w-full rounded-xl bg-[#f4b000] px-6 py-3 font-bold text-[#201b14] transition hover:bg-[#e9a600] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#805300] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isSubmitting ? "Submitting request…" : "Submit rental request"}
        </button>
      </div>
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
