import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { formatDocumentDate } from "../../utils/documentPresentation";

interface RequestSummary {
  id: string;
  full_name: string;
  customer_type?: "individual" | "business";
  business_name?: string | null;
  equipment_requested: string;
  rental_start_date: string | null;
  rental_end_date: string | null;
  fulfillment_type: string | null;
  status: string | null;
  availability_status: string | null;
}

const columns = "md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_9rem]";

const RentalRequestQueue = ({ requests }: { requests: readonly RequestSummary[] }) => (
  <>
    <div aria-hidden="true" className={`hidden gap-5 px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-[#c4b6a6] md:grid ${columns}`}>
      <span>Customer and equipment</span>
      <span>Rental dates</span>
      <span>Status</span>
      <span className="invisible">Open request</span>
    </div>
    <ul aria-label="Rental requests" className="grid gap-2">
      {requests.map((request) => {
        const company = request.customer_type === "business" ? request.business_name : null;
        const customer = company || request.full_name;
        const status = request.status || "new";
        const hasDates = request.rental_start_date || request.rental_end_date;

        return (
          <li key={request.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[#40362c] bg-[#1c1915] p-4 md:gap-5 ${columns}`}>
            <div className="col-span-2 min-w-0 md:col-span-1">
              <p className="break-words font-semibold text-[#fff7ed]">{customer}</p>
              {company && <p className="break-words text-sm text-[#d3c6b8]">{request.full_name}</p>}
              <p className="break-words text-sm text-[#d3c6b8]">{request.equipment_requested}</p>
            </div>
            <div className="col-span-2 min-w-0 text-sm md:col-span-1">
              <p className="text-[#fff7ed]">
                {hasDates
                  ? `${formatDocumentDate(request.rental_start_date, "Start TBD")} – ${formatDocumentDate(request.rental_end_date, "Return TBD")}`
                  : "Dates not provided"}
              </p>
              {request.fulfillment_type && <p className="text-[#d3c6b8]">{request.fulfillment_type}</p>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${status === "new" ? "bg-[#f4b000]/15 text-[#ffd06b]" : "bg-white/10 text-[#fff7ed]"}`}>
                {status.replaceAll("_", " ")}
              </span>
              {request.availability_status === "conflict" && (
                <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-200">
                  Date conflict
                </span>
              )}
            </div>
            <Link
              to={{ search: `?request=${encodeURIComponent(request.id)}` }}
              aria-label={`Open request for ${customer}, ${request.equipment_requested}`}
              className="inline-flex w-fit items-center gap-2 whitespace-nowrap rounded-lg border border-[#7c6238] px-3 py-2 text-sm font-semibold text-[#ffd98a] hover:bg-[#f4b000]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4b000]"
            >
              Open request <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  </>
);

export default RentalRequestQueue;
