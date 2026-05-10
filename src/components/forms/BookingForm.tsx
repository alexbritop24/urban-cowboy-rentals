import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { equipmentData } from "../../data/equipmentData";
import { supabase } from "../../lib/supabase";
import BookingSuccess from "./BookingSuccess";

import type { BookingRequest } from "../../types/booking";

const durationOptions = [
  "4 hours",
  "1 day",
  "2 days",
  "1 week",
  "2 weeks",
  "3 weeks",
  "4 weeks",
  "Custom",
];

const BookingForm = () => {
  const [searchParams] = useSearchParams();

  const equipmentQuery = searchParams.get("equipment");

  const defaultEquipment = useMemo(() => {
    const foundEquipment = equipmentData.find(
      (item) => item.id === equipmentQuery
    );

    return foundEquipment?.name || "";
  }, [equipmentQuery]);

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    equipmentRequested: defaultEquipment,
    rentalStartDate: "",
    rentalEndDate: "",
    rentalDuration: "",
    fulfillmentType: "" as BookingRequest["fulfillmentType"],
    projectType: "",
    notes: "",
    agreementAccepted: false,
  });

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : value,
    }));
  };

  const notifyN8n = async (bookingRequest: BookingRequest) => {
    const webhookUrl = import.meta.env.VITE_N8N_RENTAL_REQUEST_WEBHOOK;

    if (!webhookUrl) {
      console.warn("N8N webhook URL is missing.");
      return;
    }

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bookingRequest),
      });
    } catch (error) {
      console.error("N8N WEBHOOK ERROR:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);

    const bookingRequest: BookingRequest = {
      ...formData,
      status: "new",
      source: "website",
      submittedAt: new Date().toISOString(),
    };

    const { error } = await supabase.from("rental_requests").insert({
      full_name: bookingRequest.fullName,
      phone: bookingRequest.phone,
      email: bookingRequest.email,
      equipment_requested: bookingRequest.equipmentRequested,
      rental_start_date: bookingRequest.rentalStartDate,
      rental_end_date: bookingRequest.rentalEndDate,
      rental_duration: bookingRequest.rentalDuration,
      fulfillment_type: bookingRequest.fulfillmentType,
      project_type: bookingRequest.projectType,
      notes: bookingRequest.notes,
      agreement_accepted: bookingRequest.agreementAccepted,
      status: bookingRequest.status,
      source: bookingRequest.source,
    });

    if (error) {
      console.error("SUPABASE INSERT ERROR:", error);
      alert("Something went wrong. Please try again.");
      setIsSubmitting(false);
      return;
    }

    console.log("BOOKING REQUEST SAVED:", bookingRequest);

    await notifyN8n(bookingRequest);

    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return <BookingSuccess />;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-yellow-500/10 bg-[#11100d]/90 p-8 shadow-2xl shadow-black/30"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Full Name
          </label>

          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            required
            placeholder="John Smith"
            className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition placeholder:text-[#b8a99a]/50 focus:border-yellow-500/40"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Phone Number
          </label>

          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            required
            placeholder="801-903-9380"
            className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition placeholder:text-[#b8a99a]/50 focus:border-yellow-500/40"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Email
          </label>

          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="name@email.com"
            className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition placeholder:text-[#b8a99a]/50 focus:border-yellow-500/40"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Equipment Requested
          </label>

          <select
            name="equipmentRequested"
            value={formData.equipmentRequested}
            onChange={handleChange}
            required
            className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition focus:border-yellow-500/40"
          >
            <option value="">Select equipment</option>
            {equipmentData.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Rental Start Date
          </label>

          <input
            type="date"
            name="rentalStartDate"
            value={formData.rentalStartDate}
            onChange={handleChange}
            required
            className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition focus:border-yellow-500/40"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Rental End Date
          </label>

          <input
            type="date"
            name="rentalEndDate"
            value={formData.rentalEndDate}
            onChange={handleChange}
            required
            className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition focus:border-yellow-500/40"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Rental Duration
          </label>

          <select
            name="rentalDuration"
            value={formData.rentalDuration}
            onChange={handleChange}
            required
            className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition focus:border-yellow-500/40"
          >
            <option value="">Select duration</option>
            {durationOptions.map((duration) => (
              <option key={duration} value={duration}>
                {duration}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Pickup or Delivery
          </label>

          <select
            name="fulfillmentType"
            value={formData.fulfillmentType}
            onChange={handleChange}
            required
            className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition focus:border-yellow-500/40"
          >
            <option value="">Select option</option>
            <option value="Pickup">Pickup</option>
            <option value="Delivery">Delivery</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
            Project Type / Reason For Rental
          </label>

          <input
            type="text"
            name="projectType"
            value={formData.projectType}
            onChange={handleChange}
            placeholder="Construction, hauling, demolition, weekend ride, etc."
            className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition placeholder:text-[#b8a99a]/50 focus:border-yellow-500/40"
          />
        </div>
      </div>

      <div className="mt-6">
        <label className="mb-2 block text-sm font-black uppercase tracking-[0.12em] text-[#fff7ed]">
          Notes
        </label>

        <textarea
          name="notes"
          rows={5}
          value={formData.notes}
          onChange={handleChange}
          placeholder="Add delivery address, preferred pickup time, attachments needed, or other details."
          className="w-full rounded-2xl border border-yellow-500/10 bg-[#1a1612] px-5 py-4 text-[#fff7ed] outline-none transition placeholder:text-[#b8a99a]/50 focus:border-yellow-500/40"
        />
      </div>

      <div className="mt-6 flex items-start gap-3">
        <input
          type="checkbox"
          name="agreementAccepted"
          checked={formData.agreementAccepted}
          onChange={handleChange}
          required
          className="mt-1"
        />

        <p className="text-sm leading-relaxed text-[#b8a99a]">
          I understand this is a rental request and availability, final price,
          payment, deposit, pickup, and delivery details must be confirmed by
          Urban Cowboy Rentals before the rental is approved.
        </p>
      </div>

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

export default BookingForm;