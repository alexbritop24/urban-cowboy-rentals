import { useEffect, useState } from "react";

import { supabase } from "../../lib/supabase";

import type { AutomationLog } from "../../types/automation";

const AutomationLogs = () => {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from("automation_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("FETCH AUTOMATION LOGS ERROR:", error);
    } else {
      setLogs(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel("automation-logs-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "automation_logs",
        },
        () => {
          fetchLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="text-[#d6c7b8]">
        Loading automation logs...
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-yellow-500/10 bg-[#11100d] p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-black text-[#fff7ed]">
          Automation Logs
        </h2>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchLogs}
            className="rounded-full border border-yellow-500/20 bg-[#1a1612] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-[#fff7ed] transition hover:border-yellow-500/50"
          >
            Refresh Logs
          </button>

          <div className="rounded-full border border-yellow-500/20 px-4 py-2 text-sm text-[#f4b000]">
            {logs.length} Events
          </div>
        </div>
      </div>

      {logs.length === 0 ? (
        <p className="text-[#b8a99a]">
          No automation logs yet.
        </p>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-2xl border border-yellow-500/10 bg-[#050402] p-5"
            >
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[#f4b000]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#f4b000]">
                  {log.event_type}
                </span>

                <span className="rounded-full bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.12em] text-[#d6c7b8]">
                  {log.channel}
                </span>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${
                    log.status === "success"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {log.status}
                </span>
              </div>

              <p className="mb-2 text-[#fff7ed]">
                {log.message}
              </p>

              <p className="text-sm text-[#8f8577]">
                {new Date(log.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AutomationLogs;