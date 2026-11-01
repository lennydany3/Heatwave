"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { BADGE, fmt } from "../_lib/data";
import { Avatar, Chips, Empty, PageHeader, Panel, PanelHead, Pill, StatCard, StatGrid } from "../_components/ui";

type BookingStatus = "Confirmed" | "Pending" | "Checked-in" | "Cancelled";
type Range = "7D" | "30D" | "90D";

type RegistrationRow = {
  id: string;
  full_name: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  created_at: string;
  events: { name: string } | null;
  ticket_tiers: { name: string } | null;
  tickets: { status: "valid" | "checked_in" | "cancelled"; checked_in_at: string | null }[];
};

type Booking = {
  id: string;
  name: string;
  event: string;
  type: string;
  amount: number;
  status: BookingStatus;
  date: string;
  createdAt: string;
};

const FILTERS = ["All", "Confirmed", "Pending", "Checked-in", "Cancelled"];
const PER_PAGE = 8;

function bookingStatus(r: RegistrationRow): BookingStatus | null {
  if (r.status === "pending") return "Pending";
  if (r.status !== "paid") return null; // drop failed attempts — not real bookings
  const ticket = r.tickets[0];
  if (!ticket || ticket.status === "valid") return "Confirmed";
  if (ticket.status === "checked_in") return "Checked-in";
  return "Cancelled";
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function dayLabel(key: string) {
  const d = new Date(key + "T00:00:00Z");
  return d.getUTCDate() + " " + d.toLocaleString("en", { month: "short", timeZone: "UTC" });
}

export default function AdminDashboardPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("30D");
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [eventCounts, setEventCounts] = useState({ total: 0, active: 0 });
  const [masks, setMasks] = useState<string[]>([]);
  const money = (n: number) => (masks.includes("revenue") ? "₹ ••••" : fmt(n));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Read through the API so masked fields are blanked on the server.
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (cancelled) return;
      if (res.ok && data) {
        setRows(data.rows);
        setEventCounts(data.eventCounts);
        setMasks(data.masks ?? []);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const bookings: Booking[] = useMemo(
    () =>
      rows
        .map((r) => {
          const status = bookingStatus(r);
          if (!status) return null;
          const created = new Date(r.created_at);
          const b: Booking = {
            id: r.id,
            name: r.full_name,
            event: r.events?.name ?? "—",
            type: r.ticket_tiers?.name ?? "Ticket",
            amount: r.amount,
            status,
            date: created.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
            createdAt: r.created_at,
          };
          return b;
        })
        .filter((b): b is Booking => b !== null),
    [rows]
  );

  const paidCount = bookings.filter((b) => b.status !== "Pending").length;
  const totalRevenue = bookings
    .filter((b) => b.status !== "Pending")
    .reduce((a, b) => a + b.amount, 0);
  const checkedInToday = rows.filter((r) => {
    const ticket = r.tickets[0];
    if (!ticket?.checked_in_at) return false;
    return dayKey(ticket.checked_in_at) === dayKey(new Date().toISOString());
  }).length;

  const chart = useMemo(() => {
    const n = { "7D": 7, "30D": 30, "90D": 90 }[range];
    const buckets = new Map<string, number>();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      buckets.set(dayKey(d.toISOString()), 0);
    }
    rows.forEach((r) => {
      const key = dayKey(r.created_at);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    });
    const keys = Array.from(buckets.keys());
    const values = Array.from(buckets.values());
    const max = Math.max(1, ...values) * 1.1;
    const pts = values.map((v, i): [number, number] => [
      n === 1 ? 0 : (i / (n - 1)) * 600,
      200 - (v / max) * 200,
    ]);
    const line = pts
      .map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1))
      .join(" ");
    return {
      line,
      area: line + " L600 200 L0 200 Z",
      total: values.reduce((a, b) => a + b, 0),
      x0: dayLabel(keys[0]),
      x1: dayLabel(keys[Math.round((keys.length - 1) / 2)]),
    };
  }, [rows, range]);

  const topEvents = useMemo(() => {
    const totals = new Map<string, number>();
    bookings
      .filter((b) => b.status !== "Pending")
      .forEach((b) => totals.set(b.event, (totals.get(b.event) ?? 0) + b.amount));
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [bookings]);

  const filteredRows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return bookings.filter(
      (b) =>
        (filter === "All" || b.status === filter) &&
        (!query || (b.name + b.event).toLowerCase().includes(query))
    );
  }, [bookings, filter, q]);

  const total = filteredRows.length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const currentPage = Math.min(page, pages - 1);
  const pageRows = filteredRows.slice(
    currentPage * PER_PAGE,
    currentPage * PER_PAGE + PER_PAGE
  );

  return (
    <AdminShell active="overview" search={q} onSearchChange={setQ}>
      <PageHeader eyebrow="OVERVIEW" title="Overview" />

      <StatGrid>
        {[
          { label: "TOTAL REVENUE", value: money(totalRevenue), note: `${paidCount} bookings` },
          { label: "TICKETS SOLD", value: String(paidCount), note: `${bookings.length} total registrations` },
          { label: "ACTIVE EVENTS", value: String(eventCounts.active), note: `${eventCounts.total} total` },
          {
            label: "CHECK-INS TODAY",
            value: String(checkedInToday),
            note: paidCount ? `${Math.round((checkedInToday / paidCount) * 100)}% of ${paidCount} sold` : "No tickets sold yet",
          },
        ].map((k, i) => (
          <StatCard key={k.label} index={i} dark={i === 0} loading={loading} {...k} />
        ))}
      </StatGrid>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:mt-5 sm:gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {masks.includes("chart") ? (
          <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-[#EDE6E3] bg-[#FAF7F5] p-6 text-sm font-bold text-[#6B6B6B]">
            Bookings chart hidden for your role
          </div>
        ) : (
          <Panel className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[16px] font-bold sm:text-[17px]">Bookings over time</div>
                <div className="mt-0.5 text-[13px] text-[#6B6B6B]">
                  <span className="font-bold text-[#141414]">{chart.total}</span> bookings in this period
                </div>
              </div>
              <div className="flex flex-none gap-0.5 rounded-full bg-[#F3EEEB] p-[3px]">
                {(["7D", "30D", "90D"] as Range[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition-all duration-200 sm:px-3.5 sm:text-[13px] ${
                      range === r
                        ? "bg-white text-[#141414] shadow-[0_1px_3px_rgba(20,20,20,.15)]"
                        : "text-[#6B6B6B]"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative mt-5 h-[170px] sm:h-[220px]">
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                <span className="border-t border-dashed border-[#EDE6E3]" />
                <span className="border-t border-dashed border-[#EDE6E3]" />
                <span className="border-t border-dashed border-[#EDE6E3]" />
                <span className="border-t border-[#EDE6E3]" />
              </div>
              <svg
                viewBox="0 0 600 200"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full overflow-visible"
              >
                <defs>
                  <linearGradient id="hw-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E5251B" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#E5251B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <path d={chart.area} fill="url(#hw-area)" />
                <path
                  d={chart.line}
                  fill="none"
                  stroke="#E5251B"
                  strokeWidth={2.5}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  style={{ filter: "drop-shadow(0 4px 6px rgba(229,37,27,.35))" }}
                />
              </svg>
            </div>
            <div className="mt-2.5 flex justify-between text-xs text-[#6B6B6B]">
              <span>{chart.x0}</span>
              <span>{chart.x1}</span>
              <span>Today</span>
            </div>
          </Panel>
        )}
        <Panel className="p-4 sm:p-6">
          <div className="text-[16px] font-bold sm:text-[17px]">Top events by sales</div>
          {topEvents.length === 0 && (
            <div className="mt-4 rounded-xl bg-[#FAF7F5] px-4 py-6 text-center text-sm text-[#6B6B6B]">
              No paid bookings yet.
            </div>
          )}
          <div className="mt-4 flex flex-col gap-4">
            {topEvents.map(([name, rev], i) => (
              <div key={name} className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 flex-none items-center justify-center rounded-xl text-[13px] font-black ${
                    i === 0 ? "bg-[#E5251B] text-white" : "bg-[#F3EEEB] text-[#6B6B6B]"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate font-bold">{name}</span>
                    <span className="flex-none tabular-nums">{money(rev)}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#F3EEEB]">
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-out"
                      style={{
                        width: (topEvents[0][1] ? (rev / topEvents[0][1]) * 100 : 0) + "%",
                        background: i === 0 ? "linear-gradient(90deg,#B71C14,#E5251B)" : "#141414",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="mt-3 sm:mt-5">
        <PanelHead title="Recent bookings">
          <Chips
            options={FILTERS.map((l) => ({ id: l, label: l }))}
            value={filter}
            onChange={(l) => {
              setFilter(l);
              setPage(0);
            }}
          />
        </PanelHead>

        <div className="hidden lg:block">
          <div className="grid grid-cols-[1.6fr_1.6fr_.9fr_.8fr_.9fr_.6fr] gap-4 border-y border-[#EDE6E3] bg-[#FAF7F5] px-6 py-3 text-[11px] font-bold tracking-[0.12em] text-[#6B6B6B]">
            <span>ATTENDEE</span>
            <span>EVENT</span>
            <span>TICKET</span>
            <span className="text-right">AMOUNT</span>
            <span>STATUS</span>
            <span>DATE</span>
          </div>

          {!loading &&
            pageRows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[1.6fr_1.6fr_.9fr_.8fr_.9fr_.6fr] items-center gap-4 border-b border-[#EDE6E3] px-6 py-3 text-sm transition-colors last:border-b-0 hover:bg-[#FCFAF9]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={r.name} size={32} />
                  <span className="truncate font-bold">{r.name}</span>
                </div>
                <div className="min-w-0 truncate">{r.event}</div>
                <div className="text-[#6B6B6B]">{r.type}</div>
                <div className="text-right font-bold tabular-nums">{money(r.amount)}</div>
                <div>
                  <Pill tone={BADGE[r.status]}>{r.status}</Pill>
                </div>
                <div className="text-[#6B6B6B]">{r.date}</div>
              </div>
            ))}
        </div>

        <div className="lg:hidden">
          {!loading &&
            pageRows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 border-t border-[#EDE6E3] px-4 py-3.5">
                <Avatar name={r.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold">{r.name}</div>
                  <div className="truncate text-[12.5px] text-[#6B6B6B]">
                    {r.event} · {r.type} · {r.date}
                  </div>
                </div>
                <div className="flex flex-none flex-col items-end gap-1.5">
                  <span className="text-sm font-black tabular-nums">{money(r.amount)}</span>
                  <Pill tone={BADGE[r.status]}>{r.status}</Pill>
                </div>
              </div>
            ))}
        </div>

        {loading &&
          [1, 2, 3].map((k) => (
            <div
              key={k}
              className="flex animate-[hwPulse_1.4s_ease_infinite] items-center gap-4 border-t border-[#EDE6E3] px-4 py-4 sm:px-6"
            >
              <div className="h-8 w-8 flex-none rounded-full bg-[#F3EEEB]" />
              <div className="h-3 w-[30%] rounded-full bg-[#F3EEEB]" />
              <div className="h-3 w-[22%] rounded-full bg-[#F3EEEB]" />
            </div>
          ))}

        {total === 0 && !loading && (
          <Empty
            title="No bookings match"
            action={
              <button
                onClick={() => {
                  setFilter("All");
                  setQ("");
                }}
                className="mt-4 text-sm font-bold text-[#E5251B]"
              >
                Clear filters
              </button>
            }
          >
            Try a different search or clear the status filter.
          </Empty>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-[#EDE6E3] px-4 py-3 text-[13px] text-[#6B6B6B] sm:px-6">
            <span className="tabular-nums">
              {currentPage * PER_PAGE + 1}–{Math.min(total, currentPage * PER_PAGE + PER_PAGE)} of {total}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => currentPage > 0 && setPage(currentPage - 1)}
                disabled={currentPage === 0}
                className="h-9 rounded-full border border-[#EDE6E3] bg-white px-3.5 font-bold text-[#141414] disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                onClick={() => currentPage < pages - 1 && setPage(currentPage + 1)}
                disabled={currentPage >= pages - 1}
                className="h-9 rounded-full border border-[#EDE6E3] bg-white px-3.5 font-bold text-[#141414] disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </Panel>
    </AdminShell>
  );
}
