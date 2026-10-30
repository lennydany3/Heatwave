"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { fmt } from "../_lib/data";
import { createClient } from "@/utils/supabase/client";

type PayStatus = "Paid" | "Pending" | "Failed";
type Txn = {
  id: string;
  name: string;
  event: string;
  amount: number;
  tx: string;
  st: PayStatus;
  date: string;
  time: string;
};

type RegistrationRow = {
  id: string;
  full_name: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  created_at: string;
  upi_txn_id: string | null;
  events: { name: string } | null;
};

const PAY_BADGE: Record<PayStatus, [string, string, string]> = {
  Paid: ["#EEF4EF", "#2F6B45", "#3F8A5A"],
  Pending: ["#FAF7F5", "#6B6B6B", "#B5ADA9"],
  Failed: ["#FDECEA", "#B71C14", "#E5251B"],
};
const FILTERS = ["All", "Paid", "Pending", "Failed"];

function mapStatus(status: RegistrationRow["status"]): PayStatus {
  if (status === "paid") return "Paid";
  if (status === "pending") return "Pending";
  return "Failed";
}

export default function AdminPaymentsPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [txns, setTxns] = useState<Txn[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("registrations")
        .select("id, full_name, amount, status, created_at, upi_txn_id, events(name)")
        .order("created_at", { ascending: false })
        .returns<RegistrationRow[]>();
      if (cancelled) return;
      const mapped: Txn[] = (data ?? [])
        .filter((r) => r.status !== "cancelled")
        .map((r) => {
          const created = new Date(r.created_at);
          return {
            id: r.id,
            name: r.full_name,
            event: r.events?.name ?? "—",
            amount: r.amount,
            tx: r.upi_txn_id ?? r.id.slice(0, 8).toUpperCase(),
            st: mapStatus(r.status),
            date: created.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
            time: created.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
          };
        });
      setTxns(mapped);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return txns.filter(
      (t) =>
        (filter === "All" || t.st === filter) &&
        (!query || (t.name + t.tx + t.event).toLowerCase().includes(query))
    );
  }, [txns, filter, q]);

  const collected = txns.filter((t) => t.st === "Paid").reduce((a, t) => a + t.amount, 0);
  const pending = txns.filter((t) => t.st === "Pending").reduce((a, t) => a + t.amount, 0);
  const failedCount = txns.filter((t) => t.st === "Failed").length;

  return (
    <AdminShell active="payments" search={q} onSearchChange={setQ}>
      <div>
        <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">PAYMENTS</div>
        <h1 className="m-0 mt-2 text-[30px] font-black leading-[1] tracking-[-0.04em] sm:text-[40px]">
          Transactions
        </h1>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { l: "COLLECTED", v: fmt(collected), n: `${txns.filter((t) => t.st === "Paid").length} paid` },
          { l: "PENDING", v: fmt(pending), n: `${txns.filter((t) => t.st === "Pending").length} awaiting verification` },
          { l: "FAILED", v: String(failedCount), n: "attempts" },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-[#EDE6E3] p-5">
            <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">{k.l}</div>
            <div className="mt-2.5 text-[30px] font-black tracking-[-0.035em] tabular-nums">{k.v}</div>
            <div className="mt-1.5 text-[13px] text-[#6B6B6B]">{k.n}</div>
          </div>
        ))}
      </div>

      <section className="mt-5 rounded-xl border border-[#EDE6E3]">
        <div className="flex flex-wrap items-center justify-between gap-3.5 px-6 py-4.5">
          <div className="text-[17px] font-bold">All transactions</div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((l) => {
              const on = filter === l;
              return (
                <button
                  key={l}
                  onClick={() => setFilter(l)}
                  style={{
                    background: on ? "#141414" : "#fff",
                    color: on ? "#fff" : "#6B6B6B",
                    borderColor: on ? "#141414" : "#EDE6E3",
                  }}
                  className="rounded-full border px-3.5 py-1.5 text-[13px] font-bold"
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>

        {loading && (
          <div className="px-6 py-14 text-center text-sm text-[#6B6B6B]">Loading transactions…</div>
        )}

        {!loading && (
          <>
            <div className="hidden lg:block">
              <div className="grid grid-cols-[1fr_1.5fr_.8fr_.8fr] gap-4 border-y border-[#EDE6E3] bg-[#FAF7F5] px-6 py-3 text-[11px] font-bold tracking-[0.12em] text-[#6B6B6B]">
                <span>TRANSACTION</span>
                <span>ATTENDEE · EVENT</span>
                <span className="text-right">AMOUNT</span>
                <span>STATUS</span>
              </div>
              {rows.map((r) => {
                const b = PAY_BADGE[r.st];
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-[1fr_1.5fr_.8fr_.8fr] items-center gap-4 border-b border-[#EDE6E3] px-6 py-3.5 text-sm transition-colors hover:bg-[#FCFAF9]"
                  >
                    <div>
                      <div className="font-bold tabular-nums">{r.tx}</div>
                      <div className="text-xs text-[#6B6B6B]">
                        {r.date} · {r.time}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-bold">{r.name}</div>
                      <div className="truncate text-xs text-[#6B6B6B]">{r.event}</div>
                    </div>
                    <div className="text-right font-bold tabular-nums">{fmt(r.amount)}</div>
                    <div>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
                        style={{ background: b[0], color: b[1] }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: b[2] }} />
                        {r.st}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[#EDE6E3] lg:hidden">
              {rows.map((r) => {
                const b = PAY_BADGE[r.st];
                return (
                  <div key={r.id} className="flex flex-col gap-1.5 border-b border-[#EDE6E3] px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold">{r.name}</span>
                      <span className="font-black">{fmt(r.amount)}</span>
                    </div>
                    <div className="text-[13px] text-[#6B6B6B]">
                      {r.tx} · {r.event}
                    </div>
                    <span
                      className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
                      style={{ background: b[0], color: b[1] }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: b[2] }} />
                      {r.st}
                    </span>
                  </div>
                );
              })}
            </div>

            {rows.length === 0 && (
              <div className="border-t border-[#EDE6E3] px-6 py-14 text-center">
                <div className="text-lg font-bold">No transactions here</div>
                <div className="mt-1.5 text-sm text-[#6B6B6B]">Nothing matches this filter yet.</div>
                <button
                  onClick={() => {
                    setFilter("All");
                    setQ("");
                  }}
                  className="mt-4 text-sm font-bold text-[#E5251B]"
                >
                  Show all
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </AdminShell>
  );
}
