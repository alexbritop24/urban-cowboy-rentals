import { useEffect, useState } from "react";

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
}

const statusOptions = [
  "new",
  "approved",
  "in_progress",
  "completed",
  "cancelled",
];

const AdminDashboardPage = () => {
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  const updateRequestStatus = async (
    requestId: string,
    newStatus: string
  ) => {
    setUpdatingId(requestId);

    const { error } = await supabase
      .from("rental_requests")
      .update({ status: newStatus })
      .eq("id", requestId);

    if (error) {
      console.error("UPDATE STATUS ERROR:", error);
      alert("Could not update request status.");
      setUpdatingId(null);
      return;
    }

    setRequests((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? { ...request, status: newStatus }
          : request
      )
    );

    setUpdatingId(null);
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
            <p className="text-sm font-black uppercase tracking-[0.35em] text-[#f4b000]">
              Admin Dashboard
            </p>

            <h1 className="mt-5 text-5xl font-black tracking-tight text-[#fff7ed] md:text-7xl">
              Rental request command center.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#b8a99a]">
              Review incoming rental requests, customer details, dates, status,
              automation history, and operational notes.
            </p>

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
                            {request.status.replace("_", " ")}
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
                            value={request.status}
                            disabled={updatingId === request.id}
                            onChange={(e) =>
                              updateRequestStatus(
                                request.id,
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

                      {request.notes && (
                        <div className="mt-6 rounded-2xl border border-yellow-500/10 bg-black/30 p-5">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8f8577]">
                            Notes
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