"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { BADGE, fmt } from "../_lib/data";
import { createClient } from "@/utils/supabase/client";

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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const [{ data: regs }, { data: events }] = await Promise.all([
        supabase
          .from("registrations")
          .select(
            "id, full_name, amount, status, created_at, events(name), ticket_tiers(name), tickets(status, checked_in_at)"
          )
          .order("created_at", { ascending: false })
          .returns<RegistrationRow[]>(),
        supabase.from("events").select("id, starts_at"),
      ]);
      if (cancelled) return;
      setRows(regs ?? []);
      const now = Date.now();
      setEventCounts({
        total: events?.length ?? 0,
        active:
          events?.filter((e) => !e.starts_at || new Date(e.starts_at).getTime() > now).length ??
          0,
      });
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">OVERVIEW</div>
          <h1 className="m-0 mt-2 text-[30px] font-black leading-[1] tracking-[-0.04em] sm:text-[40px]">
            Overview
          </h1>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "TOTAL REVENUE", value: fmt(totalRevenue), note: `${paidCount} bookings` },
          { label: "TICKETS SOLD", value: String(paidCount), note: `${bookings.length} total registrations` },
          { label: "ACTIVE EVENTS", value: String(eventCounts.active), note: `${eventCounts.total} total` },
          {
            label: "CHECK-INS TODAY",
            value: String(checkedInToday),
            note: paidCount ? `${Math.round((checkedInToday / paidCount) * 100)}% of ${paidCount} sold` : "No tickets sold yet",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="animate-[hwUp_0.5s_ease_both] rounded-xl border border-[#EDE6E3] bg-white p-5 transition-transform duration-250 hover:-translate-y-0.5"
          >
            <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">{k.label}</div>
            {loading ? (
              <div className="mt-3.5 h-[30px] w-3/5 animate-[hwPulse_1.4s_ease_infinite] rounded-lg bg-[#F3EEEB]" />
            ) : (
              <div className="mt-2.5 text-[32px] font-black tracking-[-0.035em] tabular-nums">{k.value}</div>
            )}
            <div className="mt-2 text-[13px] text-[#6B6B6B]">{k.note}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-stretch gap-5">
        <div className="min-w-0 flex-[2_1_520px] rounded-xl border border-[#EDE6E3] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[17px] font-bold">Bookings over time</div>
              <div className="mt-0.5 text-[13px] text-[#6B6B6B]">
                {chart.total} bookings in this period
              </div>
            </div>
            <div className="flex gap-0.5 rounded-full border border-[#EDE6E3] p-[3px]">
              {(["7D", "30D", "90D"] as Range[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{
                    background: range === r ? "#141414" : "transparent",
                    color: range === r ? "#fff" : "#6B6B6B",
                  }}
                  className="rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors duration-200"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="relative mt-5 h-[220px]">
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
              <span className="border-t border-[#EDE6E3]" />
              <span className="border-t border-[#EDE6E3]" />
              <span className="border-t border-[#EDE6E3]" />
              <span className="border-t border-[#EDE6E3]" />
            </div>
            <svg
              viewBox="0 0 600 200"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full overflow-visible"
            >
              <path d={chart.area} fill="#FDECEA" opacity={0.6} />
              <path
                d={chart.line}
                fill="none"
                stroke="#E5251B"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="mt-2.5 flex justify-between text-xs text-[#6B6B6B]">
            <span>{chart.x0}</span>
            <span>{chart.x1}</span>
            <span>Today</span>
          </div>
        </div>
        <div className="min-w-0 flex-[1_1_300px] rounded-xl border border-[#EDE6E3] p-6">
          <div className="text-[17px] font-bold">Top events by sales</div>
          {topEvents.length === 0 && (
            <div className="mt-4 text-sm text-[#6B6B6B]">No paid bookings yet.</div>
          )}
          <div className="mt-4.5 flex flex-col gap-[18px]">
            {topEvents.map(([name, rev], i) => (
              <div key={name}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-bold">{name}</span>
                  <span className="tabular-nums">{fmt(rev)}</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#F3EEEB]">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width: (rev / topEvents[0][1]) * 100 + "%",
                      background: i === 0 ? "#E5251B" : "#141414",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="mt-5 rounded-xl border border-[#EDE6E3]">
        <div className="flex flex-wrap items-center justify-between gap-3.5 px-6 py-5">
          <div className="text-[17px] font-bold">Recent bookings</div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((l) => {
              const on = filter === l;
              return (
                <button
                  key={l}
                  onClick={() => {
                    setFilter(l);
                    setPage(0);
                  }}
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

        <div className="hidden lg:block">
          <div className="grid grid-cols-[1.6fr_1.6fr_.9fr_.8fr_.9fr_.6fr] gap-4 border-y border-[#EDE6E3] bg-[#FAF7F5] px-6 py-3 text-[11px] font-bold tracking-[0.12em] text-[#6B6B6B]">
            <span>ATTENDEE</span>
            <span>EVENT</span>
            <span>TICKET</span>
            <span className="text-right">AMOUNT</span>
            <span>STATUS</span>
            <span>DATE</span>
          </div>

          {loading &&
            [1, 2, 3].map((k) => (
              <div
                key={k}
                className="flex animate-[hwPulse_1.4s_ease_infinite] gap-4 border-b border-[#EDE6E3] px-6 py-[18px]"
              >
                <div className="h-3 w-[22%] rounded-full bg-[#F3EEEB]" />
                <div className="h-3 w-[28%] rounded-full bg-[#F3EEEB]" />
                <div className="h-3 w-[12%] rounded-full bg-[#F3EEEB]" />
              </div>
            ))}

          {!loading &&
            pageRows.map((r) => {
              const b = BADGE[r.status];
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[1.6fr_1.6fr_.9fr_.8fr_.9fr_.6fr] items-center gap-4 border-b border-[#EDE6E3] px-6 py-3.5 text-sm transition-colors hover:bg-[#FCFAF9]"
                >
                  <div className="min-w-0 truncate font-bold">{r.name}</div>
                  <div className="min-w-0 truncate">{r.event}</div>
                  <div className="text-[#6B6B6B]">{r.type}</div>
                  <div className="text-right font-bold tabular-nums">{fmt(r.amount)}</div>
                  <div>
                    <span
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold"
                      style={{ background: b[0], color: b[1] }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: b[2] }} />
                      {r.status}
                    </span>
                  </div>
                  <div className="text-[#6B6B6B]">{r.date}</div>
                </div>
              );
            })}
        </div>

        <div className="border-t border-[#EDE6E3] lg:hidden">
          {pageRows.map((r) => {
            const b = BADGE[r.status];
            return (
              <div key={r.id} className="flex flex-col gap-2 border-b border-[#EDE6E3] px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[15px] font-bold">{r.name}</span>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={{ background: b[0], color: b[1] }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: b[2] }} />
                    {r.status}
                  </span>
                </div>
                <div className="text-sm text-[#6B6B6B]">
                  {r.event} · {r.type}
                </div>
                <div className="flex justify-between text-[13px] text-[#6B6B6B]">
                  <span>{r.date}</span>
                  <span className="text-sm font-bold text-[#141414]">{fmt(r.amount)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {total === 0 && !loading && (
          <div className="border-t border-[#EDE6E3] px-6 py-14 text-center">
            <div className="text-lg font-bold">No bookings match</div>
            <div className="mt-1.5 text-sm text-[#6B6B6B]">
              Try a different search or clear the status filter.
            </div>
            <button
              onClick={() => {
                setFilter("All");
                setQ("");
              }}
              className="mt-4 text-sm font-bold text-[#E5251B]"
            >
              Clear filters
            </button>
          </div>
        )}

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 text-[13px] text-[#6B6B6B]">
            <span>
              Showing {currentPage * PER_PAGE + 1}–
              {Math.min(total, currentPage * PER_PAGE + PER_PAGE)} of {total}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => currentPage > 0 && setPage(currentPage - 1)}
                style={{ opacity: currentPage > 0 ? 1 : 0.4 }}
                className="h-[34px] rounded-full border border-[#EDE6E3] px-3.5 font-bold"
              >
                ← Prev
              </button>
              <button
                onClick={() => currentPage < pages - 1 && setPage(currentPage + 1)}
                style={{ opacity: currentPage < pages - 1 ? 1 : 0.4 }}
                className="h-[34px] rounded-full border border-[#EDE6E3] px-3.5 font-bold"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
