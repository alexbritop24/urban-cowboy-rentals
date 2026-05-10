import { useEffect, useState } from "react";
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

const AdminDashboardPage = () => {
  const navigate = useNavigate();

  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from("rental_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("FETCH RENTAL REQUESTS ERROR:", error);
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
    };
  }, []);

  const updateRequestField = async (
    requestId: string,
    field: keyof RentalRequest,
    value: string | number | null
  ) => {
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
        request.id === requestId
          ? { ...request, [field]: value }
          : request
      )
    );

    setUpdatingId(null);
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
        <section className="px-6 py-24">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
                  Admin Dashboard
                </p>

                <h1 className="mt-5 text-5xl font-black tracking-tight text-[#fff7ed] md:text-7xl">
                  Rental request command center.
                </h1>

                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#b8a99a]">
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

            <div className="mt-12 rounded-[2rem] border border-yellow-500/10 bg-[#11100d]/90 p-6 shadow-2xl shadow-black/30">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <h2 className="text-2xl font-black text-[#fff7ed]">
                  Incoming Requests
                </h2>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={fetchRequests}
                    className="rounded-full border border-yellow-500/20 bg-[#1a1612] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#fff7ed] transition hover:border-yellow-500/50"
                  >
                    Refresh
                  </button>

                  <span className="rounded-full bg-[#f4b000] px-4 py-2 text-sm font-black text-black">
                    {requests.length} total
                  </span>
                </div>
              </div>

              {isLoading ? (
                <p className="text-[#b8a99a]">Loading requests...</p>
              ) : requests.length === 0 ? (
                <p className="text-[#b8a99a]">No rental requests yet.</p>
              ) : (
                <div className="grid gap-5">
                  {requests.map((request) => (
                    <article
                      key={request.id}
                      className="rounded-[1.5rem] border border-yellow-500/10 bg-[#1a1612] p-6"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
                            {(request.status || "new").replace("_", " ")}
                          </p>

                          <h3 className="mt-2 text-2xl font-black text-[#fff7ed]">
                            {request.equipment_requested}
                          </h3>

                          <p className="mt-2 text-[#b8a99a]">
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
                            onChange={(e) =>
                              updateRequestField(
                                request.id,
                                "status",
                                e.target.value
                              )
                            }
                            className="rounded-2xl border border-yellow-500/10 bg-black/40 px-5 py-4 text-sm font-black uppercase tracking-[0.08em] text-[#fff7ed] outline-none transition focus:border-yellow-500/40 disabled:opacity-50"
                          >
                            {statusOptions.map((status) => (
                              <option key={status} value={status}>
                                {status.replace("_", " ")}
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

                      <div className="mt-6 rounded-2xl border border-yellow-500/10 bg-black/25 p-5">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#f4b000]">
                          Internal Operations
                        </p>

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
                                  e.target.value
                                    ? Number(e.target.value)
                                    : null
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
                              value={
                                request.deposit_status || "not_required"
                              }
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
                                  {status.replace("_", " ")}
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
                                  {status.replace("_", " ")}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
                              Delivery Status
                            </label>

                            <select
                              value={
                                request.delivery_status || "not_scheduled"
                              }
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
                                  {status.replace("_", " ")}
                                </option>
                              ))}
                            </select>
                          </div>
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
                                updateRequestField(
                                  request.id,
                                  "payment_link",
                                  e.target.value
                                )
                              }
                              placeholder="Paste Square payment link here"
                              className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
                            />

                            {request.payment_link ? (
                              <a
                                href={request.payment_link}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-2xl border border-yellow-500/20 bg-[#f4b000] px-5 py-3 text-center text-sm font-black uppercase tracking-[0.08em] text-black transition hover:bg-[#f59e0b]"
                              >
                                Open Link
                              </a>
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
                        </div>

                        <div className="mt-5">
                          <label className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-[#8f8577]">
                            Internal Notes
                          </label>

                          <textarea
                            rows={4}
                            value={request.internal_notes || ""}
                            onChange={(e) =>
                              updateRequestField(
                                request.id,
                                "internal_notes",
                                e.target.value
                              )
                            }
                            placeholder="Private team notes, prep instructions, quote reasoning, delivery details..."
                            className="w-full rounded-2xl border border-yellow-500/10 bg-black/40 px-4 py-3 text-[#fff7ed] outline-none focus:border-yellow-500/40"
                          />
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