"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "../_components/AdminShell";
import HeatwaveLoader from "@/components/HeatwaveLoader";
import { fmt } from "../_lib/data";
import { Avatar, Chips, Empty, PageHeader, Panel, PanelHead, Pill, StatCard, StatGrid } from "../_components/ui";

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
  const [masks, setMasks] = useState<string[]>([]);
  const money = (n: number) => (masks.includes("amount") ? "₹ ••••" : fmt(n));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Read through the API so masked fields are blanked on the server.
      const res = await fetch("/api/admin/payments", { cache: "no-store" });
      const body = await res.json().catch(() => null);
      const data: RegistrationRow[] = res.ok && body ? body.rows : [];
      if (res.ok && body) setMasks(body.masks ?? []);
      if (cancelled) return;
      const mapped: Txn[] = data
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
      <PageHeader eyebrow="PAYMENTS" title="Transactions" />

      <StatGrid three>
        {[
          { l: "COLLECTED", v: money(collected), n: `${txns.filter((t) => t.st === "Paid").length} paid` },
          { l: "PENDING", v: money(pending), n: `${txns.filter((t) => t.st === "Pending").length} awaiting verification` },
          { l: "FAILED", v: String(failedCount), n: "attempts" },
        ].map((k, i) => (
          <StatCard
            key={k.l}
            index={i}
            dark={i === 0}
            wide={i === 0}
            label={k.l}
            value={k.v}
            note={k.n}
            dot={i === 0 ? undefined : PAY_BADGE[i === 1 ? "Pending" : "Failed"][2]}
            loading={loading}
          />
        ))}
      </StatGrid>

      <Panel className="mt-3 sm:mt-5">
        <PanelHead title="All transactions">
          <Chips
            options={FILTERS.map((l) => ({
              id: l,
              label: l,
              count: l === "All" ? txns.length : txns.filter((t) => t.st === l).length,
            }))}
            value={filter}
            onChange={setFilter}
          />
        </PanelHead>

        {loading && (
          <div className="border-t border-[#EDE6E3] px-6 py-16">
            <HeatwaveLoader label="Loading transactions" />
          </div>
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
              {rows.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1fr_1.5fr_.8fr_.8fr] items-center gap-4 border-b border-[#EDE6E3] px-6 py-3.5 text-sm transition-colors last:border-b-0 hover:bg-[#FCFAF9]"
                >
                  <div>
                    <div className="font-bold tabular-nums">{r.tx}</div>
                    <div className="text-xs text-[#6B6B6B]">
                      {r.date} · {r.time}
                    </div>
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={r.name} size={32} />
                    <div className="min-w-0">
                      <div className="truncate font-bold">{r.name}</div>
                      <div className="truncate text-xs text-[#6B6B6B]">{r.event}</div>
                    </div>
                  </div>
                  <div className="text-right font-bold tabular-nums">{money(r.amount)}</div>
                  <div>
                    <Pill tone={PAY_BADGE[r.st]}>{r.st}</Pill>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:hidden">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-3 border-t border-[#EDE6E3] px-4 py-3.5">
                  <Avatar name={r.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold">{r.name}</div>
                    <div className="truncate text-[12.5px] tabular-nums text-[#6B6B6B]">
                      {r.tx} · {r.date}, {r.time}
                    </div>
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1.5">
                    <span className="text-sm font-black tabular-nums">{money(r.amount)}</span>
                    <Pill tone={PAY_BADGE[r.st]}>{r.st}</Pill>
                  </div>
                </div>
              ))}
            </div>

            {rows.length === 0 && (
              <Empty
                title="No transactions here"
                action={
                  <button
                    onClick={() => {
                      setFilter("All");
                      setQ("");
                    }}
                    className="mt-4 text-sm font-bold text-[#E5251B]"
                  >
                    Show all
                  </button>
                }
              >
                Nothing matches this filter yet.
              </Empty>
            )}
          </>
        )}
      </Panel>
    </AdminShell>
  );
}
