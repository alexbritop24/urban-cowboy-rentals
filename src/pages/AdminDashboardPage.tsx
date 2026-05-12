import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import AutomationLogs from "../components/admin/AutomationLogs";
import MainLayout from "../components/layout/MainLayout";
import SEO from "../components/seo/SEO";
import PageTransition from "../components/ui/PageTransition";
import { supabase } from "../lib/supabase";

interface RentalRequest {
  id: string;
  created_at: string;
  full_name: string;
  phone: string;
  email: string;
  equipment_requested: string;
  rental_start_date: string;
  rental_end_date: string;
  pickup_date: string | null;
  return_date: string | null;
  rental_duration: string;
  fulfillment_type: string;
  project_type: string;
  notes: string;
  agreement_accepted: boolean;
  status: string;
  source: string;
  assigned_to: string | null;
  internal_notes: string | null;
  priority: string | null;
  quote_amount: number | null;
  deposit_status: string | null;
  payment_status: string | null;
  delivery_status: string | null;
  availability_status: string | null;
  availability_notes: string | null;
  payment_link: string | null;
}

const statusOptions = [
  "new",
  "quote_sent",
  "deposit_pending",
  "confirmed",
  "preparing_equipment",
  "scheduled_delivery",
  "active_rental",
  "pickup_scheduled",
  "return_due",
  "returned",
  "inspection",
  "completed",
  "cancelled",
];

const priorityOptions = ["low", "normal", "high", "urgent"];

const depositStatusOptions = [
  "not_required",
  "required",
  "sent",
  "paid",
  "refunded",
];

const paymentStatusOptions = [
  "unpaid",
  "payment_link_sent",
  "partial",
  "paid",
  "refunded",
];

const deliveryStatusOptions = [
  "not_scheduled",
  "pickup",
  "delivery_needed",
  "scheduled",
  "out_for_delivery",
  "delivered",
  "return_pickup_needed",
  "returned",
];

const availabilityStatusOptions = [
  "pending_review",
  "available",
  "conflict",
  "unavailable",
  "approved",
];

const formatLabel = (value: string) => value.replaceAll("_", " ");

const automationWebhookUrl = import.meta.env.VITE_N8N_AUTOMATION_WEBHOOK_URL;

const AdminDashboardPage = () => {
  const navigate = useNavigate();

  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const noteSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );

  const fetchRequests = async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("rental_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("FETCH RENTAL REQUESTS ERROR:", error);
      setRequests([]);
      setIsLoading(false);
      return;
    }

    setRequests(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel("rental-requests-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rental_requests",
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);

      Object.values(noteSaveTimers.current).forEach((timer) => {
        clearTimeout(timer);
      });
    };
  }, []);

  const filteredRequests = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return requests.filter((request) => {
      const matchesSearch =
        !normalizedSearchTerm ||
        [
          request.full_name,
          request.phone,
          request.email,
          request.equipment_requested,
          request.project_type,
          request.source,
          request.assigned_to || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearchTerm);

      const matchesStatus =
        statusFilter === "all" || request.status === statusFilter;

      const matchesPayment =
        paymentFilter === "all" ||
        (request.payment_status || "unpaid") === paymentFilter;

      const matchesPriority =
        priorityFilter === "all" ||
        (request.priority || "normal") === priorityFilter;

      return matchesSearch && matchesStatus && matchesPayment && matchesPriority;
    });
  }, [requests, searchTerm, statusFilter, paymentFilter, priorityFilter]);

  const dashboardStats = useMemo(() => {
    const activeRequests = requests.filter(
      (request) =>
        !["completed", "cancelled", "returned"].includes(request.status || "new")
    );

    const quoteSent = requests.filter(
      (request) => request.status === "quote_sent"
    );

    const confirmed = requests.filter(
      (request) => request.status === "confirmed"
    );

    const unpaid = requests.filter(
      (request) => (request.payment_status || "unpaid") !== "paid"
    );

    const urgent = requests.filter(
      (request) => (request.priority || "normal") === "urgent"
    );

    const totalQuoted = requests.reduce((sum, request) => {
      return sum + (Number(request.quote_amount) || 0);
    }, 0);

    return {
      total: requests.length,
      active: activeRequests.length,
      quoteSent: quoteSent.length,
      confirmed: confirmed.length,
      unpaid: unpaid.length,
      urgent: urgent.length,
      totalQuoted,
    };
  }, [requests]);

  const createAutomationLog = async (
  request: RentalRequest,
  eventType: string,
  message: string,
  channel = "email"
) => {
  const { error } = await supabase.from("automation_logs").insert({
    rental_request_id: request.id,
    event_type: eventType,
    channel,
    status: "success",
    message,
  });

  if (error) {
    console.error("CREATE AUTOMATION LOG ERROR:", error);
    alert(
      "The request was updated, but the automation log could not be created."
    );
    return;
  }

  if (!automationWebhookUrl) {
    console.warn("Missing VITE_N8N_AUTOMATION_WEBHOOK_URL.");
    return;
  }

  try {
    await fetch(automationWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rental_request_id: request.id,
        event_type: eventType,
        channel,
        message,
        customer_name: request.full_name,
        customer_email: request.email,
        customer_phone: request.phone,
        equipment_requested: request.equipment_requested,
        rental_start_date: request.rental_start_date,
        rental_end_date: request.rental_end_date,
        rental_duration: request.rental_duration,
        fulfillment_type: request.fulfillment_type,
        project_type: request.project_type,
        quote_amount: request.quote_amount,
        payment_status: request.payment_status,
        deposit_status: request.deposit_status,
        delivery_status: request.delivery_status,
        payment_link: request.payment_link,
      }),
    });
  } catch (webhookError) {
    console.error("N8N WEBHOOK ERROR:", webhookError);
  }
};

const hasDateConflict = (
  currentRequestId: string,
  equipmentRequested: string,
  pickupDate: string,
  returnDate: string
) => {
  return requests.some((request) => {
    if (request.id === currentRequestId) return false;

    if (request.equipment_requested !== equipmentRequested) {
      return false;
    }

    if (!request.pickup_date || !request.return_date) {
      return false;
    }

    const existingPickup = new Date(request.pickup_date).getTime();
    const existingReturn = new Date(request.return_date).getTime();

    const newPickup = new Date(pickupDate).getTime();
    const newReturn = new Date(returnDate).getTime();

    return newPickup < existingReturn && newReturn > existingPickup;
     });
    };

  const updateRequestField = async (
    requestId: string,
    field: keyof RentalRequest,
    value: string | number | null
  ) => {

    if (
  field === "pickup_date" ||
  field === "return_date"
) {
  const currentRequest = requests.find(
    (request) => request.id === requestId
  );

  if (!currentRequest) return;

  const pickupDate =
    field === "pickup_date"
      ? value
      : currentRequest.pickup_date;

  const returnDate =
    field === "return_date"
      ? value
      : currentRequest.return_date;

  if (
    pickupDate &&
    returnDate &&
    hasDateConflict(
      requestId,
      currentRequest.equipment_requested,
      String(pickupDate || ""),
      String(returnDate || "")
      )
     ) {
      alert(
      "Equipment conflict detected. This equipment is already booked during that time."
       );

        return;
     }
  }
    
    setUpdatingId(requestId);

    const { error } = await supabase
      .from("rental_requests")
      .update({ [field]: value })
      .eq("id", requestId);

    if (error) {
      console.error("UPDATE REQUEST ERROR:", error);
      alert("Could not update request.");
      setUpdatingId(null);
      return;
    }

    setRequests((prev) =>
      prev.map((request) =>
        request.id === requestId ? { ...request, [field]: value } : request
      )
    );

    setUpdatingId(null);
  };

  const updateRequestFields = async (
  requestId: string,
  updates: Partial<RentalRequest>
) => {
  setUpdatingId(requestId);

  const currentRequest = getRequestById(requestId);

  const { error } = await supabase
    .from("rental_requests")
    .update(updates)
    .eq("id", requestId);

  if (error) {
    console.error("UPDATE REQUEST FIELDS ERROR:", error);
    alert("Could not update request.");
    setUpdatingId(null);
    return null;
  }

  const updatedRequest = currentRequest
    ? { ...currentRequest, ...updates }
    : null;

  setRequests((prev) =>
    prev.map((request) =>
      request.id === requestId ? { ...request, ...updates } : request
    )
  );

  setUpdatingId(null);

  return updatedRequest;
  };

  const getRequestById = (requestId: string) => {
    return requests.find((request) => request.id === requestId) || null;
  };

  const handleInternalNotesChange = (requestId: string, value: string) => {
    setRequests((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? { ...request, internal_notes: value }
          : request
      )
    );

    if (noteSaveTimers.current[requestId]) {
      clearTimeout(noteSaveTimers.current[requestId]);
    }

    noteSaveTimers.current[requestId] = setTimeout(async () => {
      setSavingNoteId(requestId);

      const { error } = await supabase
        .from("rental_requests")
        .update({ internal_notes: value || null })
        .eq("id", requestId);

      if (error) {
        console.error("SAVE INTERNAL NOTES ERROR:", error);
        alert("Could not save internal notes.");
      }

      setSavingNoteId(null);
    }, 800);
  };

  const handleCopyPaymentLink = async (paymentLink: string | null) => {
    if (!paymentLink) return;

    try {
      await navigator.clipboard.writeText(paymentLink);
      alert("Payment link copied.");
    } catch (error) {
      console.error("COPY PAYMENT LINK ERROR:", error);
      alert("Could not copy payment link.");
    }
  };

  const handlePaymentLinkChange = async (
    requestId: string,
    paymentLink: string
  ) => {
    const trimmedPaymentLink = paymentLink.trim();
    const currentRequest = getRequestById(requestId);

    if (!currentRequest) return;

    const updatedRequest = await updateRequestFields(requestId, {
      payment_link: paymentLink,
      payment_status: trimmedPaymentLink ? "payment_link_sent" : "unpaid",
    });

    if (updatedRequest && trimmedPaymentLink) {
      await createAutomationLog(
        updatedRequest,
        "payment_link_sent",
        `Payment link sent to ${updatedRequest.full_name} for ${updatedRequest.equipment_requested}.`
      );
    }
  };

  const handleMarkQuoteSent = async (requestId: string) => {
    const updatedRequest = await updateRequestFields(requestId, {
      status: "quote_sent",
    });

    if (updatedRequest) {
      await createAutomationLog(
        updatedRequest,
        "quote_sent",
        `Quote sent to ${updatedRequest.full_name} for ${updatedRequest.equipment_requested}.`
      );
    }
  };

  const handleConfirmRental = async (requestId: string) => {
    const updatedRequest = await updateRequestFields(requestId, {
      status: "confirmed",
    });

    if (updatedRequest) {
      await createAutomationLog(
        updatedRequest,
        "rental_confirmed",
        `Rental confirmed for ${updatedRequest.full_name}: ${updatedRequest.equipment_requested}.`
      );
    }
  };

  const handleMarkPaid = async (requestId: string) => {
    const updatedRequest = await updateRequestFields(requestId, {
      payment_status: "paid",
      deposit_status: "paid",
    });

    if (updatedRequest) {
      await createAutomationLog(
        updatedRequest,
        "payment_paid",
        `Payment marked as paid for ${updatedRequest.full_name}: ${updatedRequest.equipment_requested}.`
      );
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("LOGOUT ERROR:", error);
      alert("Could not log out. Please try again.");
      setIsLoggingOut(false);
      return;
    }

    navigate("/admin-login");
  };

  return (
    <PageTransition>
      <SEO
        title="Admin Dashboard | Urban Cowboy Rentals"
        description="Internal rental request dashboard for Urban Cowboy Rentals."
      />

      <MainLayout>
        <section className="px-4 py-20 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
                  Admin Dashboard
                </p>

                <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-tight text-[#fff7ed] sm:text-5xl md:text-7xl">
                  Rental request command center.
                </h1>

                <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#b8a99a] sm:text-lg">
                  Review incoming rental requests, customer details, dates,
                  status, automation history, internal notes, assignments, and
                  payment workflow.
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-fit rounded-full border border-red-500/20 bg-red-500/10 px-6 py-4 text-sm font-black uppercase tracking-[0.1em] text-red-300 transition hover:border-red-500/50 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingOut ? "Logging Out..." : "Logout"}
              </button>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[1.5rem] border border-yellow-500/10 bg-[#11100d]/90 p-5 shadow-xl shadow-black/20">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8f8577]">
                  Total Requests
                </p>
                <p className="mt-3 text-4xl font-black text-[#fff7ed]">
                  {dashboardStats.total}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-yellow-500/10 bg-[#11100d]/90 p-5 shadow-xl shadow-black/20">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8f8577]">
                  Active Rentals
                </p>
                <p className="mt-3 text-4xl font-black text-[#fff7ed]">
                  {dashboardStats.active}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-yellow-500/10 bg-[#11100d]/90 p-5 shadow-xl shadow-black/20">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8f8577]">
                  Payment Follow-Ups
                </p>
                <p className="mt-3 text-4xl font-black text-[#fff7ed]">
                  {dashboardStats.unpaid}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-yellow-500/10 bg-[#11100d]/90 p-5 shadow-xl shadow-black/20">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8f8577]">
                  Total Quoted
                </p>
                <p className="mt-3 text-4xl font-black text-[#fff7ed]">
                  ${dashboardStats.totalQuoted.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-yellow-500/10 bg-black/30 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8f8577]">
                  Quotes Sent
                </p>
                <p className="mt-2 text-3xl font-black text-[#f4b000]">
                  {dashboardStats.quoteSent}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-yellow-500/10 bg-black/30 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8f8577]">
                  Confirmed
                </p>
                <p className="mt-2 text-3xl font-black text-green-300">
                  {dashboardStats.confirmed}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-yellow-500/10 bg-black/30 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8f8577]">
                  Urgent
                </p>
                <p className="mt-2 text-3xl font-black text-red-300">
                  {dashboardStats.urgent}
                </p>
              </div>
            </div>

            <div className="mt-12 rounded-[2rem] border border-yellow-500/10 bg-[#11100d]/90 p-4 shadow-2xl shadow-black/30 sm:p-6">
              <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-[#fff7ed]">
                    Incoming Requests
                  </h2>
                  <p className="mt-1 text-sm text-[#8f8577]">
                    Showing {filteredRequests.length} of {requests.length}{" "}
                    requests.
                  </p>
                </div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search customer, phone, email, equipment..."
                    className="w-full rounded-full border border-yellow-500/10 bg-black/40 px-5 py-3 text-sm text-[#fff7ed] outline-none transition placeholder:text-[#8f8577] focus:border-yellow-500/40 lg:w-80"
                  />

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-full border border-yellow-500/10 bg-black/40 px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#fff7ed] outline-none focus:border-yellow-500/40"
                  >
                    <option value="all">All Statuses</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {formatLabel(status)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="rounded-full border border-yellow-500/10 bg-black/40 px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#fff7ed] outline-none focus:border-yellow-500/40"
                  >
                    <option value="all">All Payments</option>
                    {paymentStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {formatLabel(status)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="rounded-full border border-yellow-500/10 bg-black/40 px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#fff7ed] outline-none focus:border-yellow-500/40"
                  >
                    <option value="all">All Priorities</option>
                    {priorityOptions.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={fetchRequests}
                    className="rounded-full border border-yellow-500/20 bg-[#1a1612] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#fff7ed] transition hover:border-yellow-500/50"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {isLoading ? (
                <p className="text-[#b8a99a]">Loading requests...</p>
              ) : requests.length === 0 ? (
                <p className="text-[#b8a99a]">No rental requests yet.</p>
              ) : filteredRequests.length === 0 ? (
                <p className="text-[#b8a99a]">
                  No requests match the current filters.
                </p>
              ) : (
                <div className="grid gap-5">
                  {filteredRequests.map((request) => (
                    <article
                      key={request.id}
                      className="rounded-[1.5rem] border border-yellow-500/10 bg-[#1a1612] p-4 sm:p-6"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="rounded-full bg-[#f4b000]/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#f4b000]">
                              {formatLabel(request.status || "new")}
                            </p>

                            <p className="rounded-full border border-yellow-500/10 bg-black/30 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#b8a99a]">
                              {request.priority || "normal"}
                            </p>

                            <p className="rounded-full border border-yellow-500/10 bg-black/30 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#b8a99a]">
                              {formatLabel(request.payment_status || "unpaid")}
                            </p>
                          </div>

                          <h3 className="mt-3 text-2xl font-black text-[#fff7ed]">
                            {request.equipment_requested}
                          </h3>

                          <p className="mt-2 break-words text-[#b8a99a]">
                            {request.full_name} · {request.phone} ·{" "}
                            {request.email}
                          </p>
                        </div>

                        <div className="flex flex-col gap-3">
                          <div className="rounded-2xl border border-yellow-500/10 bg-black/30 px-5 py-4 text-sm text-[#b8a99a]">
                            {new Date(request.created_at).toLocaleString()}
                          </div>

                          <select
                            value={request.status || "new"}
                            disabled={updatingId === request.id}
                            onChange={async (e) => {

                            const newStatus = e.target.value;

                            await updateRequestField(request.id, "status", newStatus);

                             if (newStatus === "completed") {

                              await createAutomationLog(

                              { ...request, status: "completed" },

                                "rental_completed",

                                `Rental completed for ${request.full_name}: ${request.equipment_requested}.`

                               );

                               }

                                if (newStatus === "return_due") {
                                 await createAutomationLog(
                                { ...request, status: "return_due" },
                                       "return_reminder",
                             `Return reminder sent for ${request.full_name}: ${request.equipment_requested}.`
                                 );
                                 }

                            if (newStatus === "pickup_scheduled") {
                             await createAutomationLog(
                            { ...request, status: "pickup_scheduled" },
                                      "pickup_scheduled",
                            `Pickup scheduled for ${request.full_name}: ${request.equipment_requested}.`
                              );
                            }
                            if (newStatus === "active_rental") {
                             await createAutomationLog(
                            { ...request, status: "active_rental" },
                                  "active_rental",
                             `Rental activated for ${request.full_name}: ${request.equipment_requested}.`
                                       );
                               }

                               if (newStatus === "cancelled") {
                                 await createAutomationLog(
                                { ...request, status: "cancelled" },
                                 "booking_cancelled",
                                 `Booking cancelled for ${request.full_name}: ${request.equipment_requested}.`
                                         );
                                   }
                                }}




                            className="rounded-2xl border border-yellow-500/10 bg-black/40 px-5 py-4 text-sm font-black uppercase tracking-[0.08em] text-[#fff7ed] outline-none transition focus:border-yellow-500/40 disabled:opacity-50"
                          >
                            {statusOptions.map((status) => (
                              <option key={status} value={status}>
                                {formatLabel(status)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-4 md:grid-cols-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8f8577]">
                            Start Date
                          </p>
                          <p className="mt-1 text-[#fff7ed]">
                            {request.rental_start_date}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8f8577]">
                            End Date
                          </p>
                          <p className="mt-1 text-[#fff7ed]">
                            {request.rental_end_date}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8f8577]">
                            Duration
                          </p>
                          <p className="mt-1 text-[#fff7ed]">
                            {request.rental_duration}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8f8577]">
                            Pickup / Delivery
                          </p>
                          <p className="mt-1 text-[#fff7ed]">
                            {request.fulfillment_type}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8f8577]">
                            Project Type
                          </p>
                          <p className="mt-1 text-[#fff7ed]">
                            {request.project_type || "Not provided"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8f8577]">
                            Source
                          </p>
                          <p className="mt-1 text-[#fff7ed]">
                            {request.source}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 rounded-2xl border border-yellow-500/10 bg-black/25 p-4 sm:p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
                            Internal Operations
                          </p>

                          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                            <button
                              type="button"
                              disabled={updatingId === request.id}
                              onClick={() => handleMarkQuoteSent(request.id)}
                              className="rounded-full border border-yellow-500/20 bg-black/30 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-[#fff7ed] transition hover:border-yellow-500/50 disabled:opacity-50"
                            >
                              Mark Quote Sent
                            </button>

                            <button
                              type="button"
                              disabled={updatingId === request.id}
                              onClick={() => handleConfirmRental(request.id)}
                              className="rounded-full border border-green-500/20 bg-green-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-green-300 transition hover:border-green-500/50 disabled:opacity-50"
                            >
                              Confirm Rental
                            </button>

                            <button
                              type="button"
                              disabled={updatingId === request.id}
                              onClick={() => handleMarkPaid(request.id)}
                              className="rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-blue-300 transition hover:border-blue-500/50 disabled:opacity-50"
                            >
                              Mark Paid
                            </button>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          <div>
                            <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
                              Assigned To
                            </label>

                            <input
                              type="text"
                              value={request.assigned_to || ""}
                              onChange={(e) =>
                                updateRequestField(
                                  request.id,
                                  "assigned_to",
                                  e.target.value
                                )
                              }
                              placeholder="Staff name"
                              className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
                              Priority
                            </label>

                            <select
                              value={request.priority || "normal"}
                              onChange={(e) =>
                                updateRequestField(
                                  request.id,
                                  "priority",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
                            >
                              {priorityOptions.map((priority) => (
                                <option key={priority} value={priority}>
                                  {priority}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
                              Quote Amount
                            </label>

                            <input
                              type="number"
                              min="0"
                              value={request.quote_amount ?? ""}
                              onChange={(e) =>
                                updateRequestField(
                                  request.id,
                                  "quote_amount",
                                  e.target.value ? Number(e.target.value) : null
                                )
                              }
                              placeholder="0.00"
                              className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
                              Deposit Status
                            </label>

                            <select
                              value={request.deposit_status || "not_required"}
                              onChange={(e) =>
                                updateRequestField(
                                  request.id,
                                  "deposit_status",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
                            >
                              {depositStatusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {formatLabel(status)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
                              Payment Status
                            </label>

                            <select
                              value={request.payment_status || "unpaid"}
                              onChange={(e) =>
                                updateRequestField(
                                  request.id,
                                  "payment_status",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
                            >
                              {paymentStatusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {formatLabel(status)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
                              Delivery Status
                            </label>

                            <select
                              value={request.delivery_status || "not_scheduled"}
                              onChange={(e) =>
                                updateRequestField(
                                  request.id,
                                  "delivery_status",
                                  e.target.value
                                )
                              }
                              className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
                            >
                              {deliveryStatusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {formatLabel(status)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
  <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
    Availability Status
  </label>

  <select
    value={request.availability_status || "pending_review"}
    onChange={(e) =>
      updateRequestField(
        request.id,
        "availability_status",
        e.target.value
      )
    }
    className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
  >
    {availabilityStatusOptions.map((status) => (
      <option key={status} value={status}>
        {formatLabel(status)}
      </option>
             ))}
      </select>
       </div>

           <div className="md:col-span-2">
             <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
                      Availability Notes
                           </label>

                            <input
                       type="text"
                       value={request.availability_notes || ""}
                              onChange={(e) =>
                             updateRequestField(
                                request.id,
                                "availability_notes",
                              e.target.value
                                  )
                                   }
                                       placeholder="Conflict reason, equipment condition, approval notes..."
                                       className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
                                            />
                                        </div>

                        <div className="mt-5">
                          <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
                            Square Payment Link
                          </label>

                          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                            <input
                              type="url"
                              value={request.payment_link || ""}
                              onChange={(e) =>
                                setRequests((prev) =>
                                  prev.map((item) =>
                                    item.id === request.id
                                      ? {
                                          ...item,
                                          payment_link: e.target.value,
                                        }
                                      : item
                                  )
                                )
                              }
                              onBlur={(e) =>
                                handlePaymentLinkChange(
                                  request.id,
                                  e.target.value
                                )
                              }
                              placeholder="Paste Square payment link here"
                              className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
                            />

                            {request.payment_link ? (
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyPaymentLink(request.payment_link)
                                  }
                                  className="rounded-2xl border border-yellow-500/20 bg-black/40 px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#fff7ed] transition hover:border-yellow-500/50"
                                >
                                  Copy
                                </button>

                                <a
                                  href={request.payment_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-2xl border border-yellow-500/20 bg-[#f4b000] px-5 py-3 text-center text-sm font-black uppercase tracking-[0.08em] text-black transition hover:bg-[#f59e0b]"
                                >
                                  Open Link
                                </a>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="rounded-2xl border border-yellow-500/10 bg-black/20 px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#8f8577]"
                              >
                                No Link
                              </button>
                            )}
                          </div>

                          <p className="mt-2 text-xs text-[#8f8577]">
                            Payment link saves when the field loses focus and
                            creates a payment automation event.
                          </p>
                        </div>

                        <div className="mt-5">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <label className="block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
                              Internal Notes
                            </label>

                            {savingNoteId === request.id && (
                              <span className="text-xs font-bold text-[#f4b000]">
                                Saving...
                              </span>
                            )}
                          </div>

                          <textarea
                            rows={4}
                            value={request.internal_notes || ""}
                            onChange={(e) =>
                              handleInternalNotesChange(
                                request.id,
                                e.target.value
                              )
                            }
                            placeholder="Private team notes, prep instructions, quote reasoning, delivery details..."
                            className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
                          />
                        </div>

                        <div className="mt-5 rounded-2xl border border-yellow-500/10 bg-black/30 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8f8577]">
                            Internal Activity Timeline
                          </p>

                          <div className="mt-4 space-y-3 text-sm text-[#b8a99a]">
                            <p>
                              <span className="font-bold text-[#fff7ed]">
                                Request created:
                              </span>{" "}
                              {new Date(request.created_at).toLocaleString()}
                            </p>

                            <p>
                              <span className="font-bold text-[#fff7ed]">
                                Current status:
                              </span>{" "}
                              {formatLabel(request.status || "new")}
                            </p>

                            <p>
                              <span className="font-bold text-[#fff7ed]">
                                Payment status:
                              </span>{" "}
                              {formatLabel(request.payment_status || "unpaid")}
                            </p>

                            <p>
                              <span className="font-bold text-[#fff7ed]">
                                Delivery status:
                              </span>{" "}
                              {formatLabel(
                                request.delivery_status || "not_scheduled"
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      {request.notes && (
                        <div className="mt-6 rounded-2xl border border-yellow-500/10 bg-black/30 p-5">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8f8577]">
                            Customer Notes
                          </p>

                          <p className="mt-2 leading-relaxed text-[#b8a99a]">
                            {request.notes}
                          </p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-10">
              <AutomationLogs />
            </div>
          </div>
        </section>
      </MainLayout>
    </PageTransition>
  );
};

export default AdminDashboardPage;