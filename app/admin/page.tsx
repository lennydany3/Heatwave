"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AdminShell from "./_components/AdminShell";
import { BADGE, BOOKINGS, type Booking, fmt, series } from "./_lib/data";

type SortKey = "name" | "event" | "type" | "amount" | "status" | "day";
type Range = "7D" | "30D" | "90D";

const FILTERS = ["All", "Confirmed", "Pending", "Checked-in", "Cancelled"];
const COLS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "name", label: "ATTENDEE", align: "left" },
  { key: "event", label: "EVENT", align: "left" },
  { key: "type", label: "TICKET", align: "left" },
  { key: "amount", label: "AMOUNT", align: "right" },
  { key: "status", label: "STATUS", align: "left" },
  { key: "day", label: "DATE", align: "left" },
];
const TOP_EVENTS: [string, number][] = [
  ["Bay Beats Festival", 742000],
  ["Chennai Product Summit", 486500],
  ["Marina Sunrise 10K", 301200],
  ["Carnatic Fusion Night", 188400],
  ["Stand-up Sunday", 124500],
];
const PER_PAGE = 6;

const lab = (k: number) => {
  const dt = new Date(2027, 0, 30 - k);
  return dt.getDate() + " " + dt.toLocaleString("en", { month: "short" });
};

export default function AdminOverviewPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("30D");
  const [sort, setSort] = useState<SortKey>("day");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(0);
  const [menu, setMenu] = useState<string | null>(null);
  const [refund, setRefund] = useState<string | null>(null);
  const [refunded, setRefunded] = useState<Record<string, boolean>>({});
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  function showToast(msg: string) {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2400);
  }

  function handleSort(key: SortKey) {
    if (sort === key) {
      setDir((d) => (d * -1) as 1 | -1);
    } else {
      setSort(key);
      setDir(1);
    }
  }

  const { rows, total, pages, currentPage } = useMemo(() => {
    const query = q.trim().toLowerCase();
    const withStatus = BOOKINGS.map((b) => ({
      ...b,
      status: refunded[b.id] ? "Cancelled" : b.status,
    }));
    const filtered = withStatus.filter(
      (b) =>
        (filter === "All" || b.status === filter) &&
        (!query || (b.name + b.event + b.id).toLowerCase().includes(query))
    );
    filtered.sort((a, b) => {
      const av = a[sort];
      const bv = b[sort];
      return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
    });
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const currentPage = Math.min(page, pages - 1);
    return {
      rows: filtered.slice(currentPage * PER_PAGE, currentPage * PER_PAGE + PER_PAGE),
      total,
      pages,
      currentPage,
    };
  }, [q, filter, sort, dir, page, refunded]);

  const chart = useMemo(() => {
    const n = { "7D": 7, "30D": 30, "90D": 90 }[range];
    const d = series(90).slice(90 - n);
    const max = Math.max(...d) * 1.1;
    const pts = d.map((v, i): [number, number] => [(i / (n - 1)) * 600, 200 - (v / max) * 200]);
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    return {
      line,
      area: line + " L600 200 L0 200 Z",
      lastY: pts[n - 1][1] / 2 + "%",
      chartTotal: d.reduce((a, b) => a + b, 0).toLocaleString("en-IN"),
      x0: lab(n - 1),
      x1: lab(Math.round(n / 2)),
    };
  }, [range]);

  const refundBooking: Booking | undefined = refund ? BOOKINGS.find((b) => b.id === refund) : undefined;

  function doRefund() {
    if (!refund || !refundBooking) return;
    const id = refund;
    const amount = refundBooking.amount;
    setRefunded((r) => ({ ...r, [id]: true }));
    setRefund(null);
    showToast("Refund of " + fmt(amount) + " started");
  }

  return (
    <AdminShell active="overview" search={q} onSearchChange={setQ}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">OVERVIEW</div>
          <h1 className="m-0 mt-2 text-[30px] font-black leading-[1] tracking-[-0.04em] sm:text-[40px]">
            Good morning, Lakshmi
          </h1>
        </div>
        <div className="text-sm text-[#6B6B6B]">Sat, 30 Jan 2027 · Updated 2 min ago</div>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "TOTAL REVENUE", value: "₹18,42,600", trend: "↑ 12.4%", note: "vs last 30 days", tBg: "#EEF4EF", tFg: "#2F6B45" },
          { label: "TICKETS SOLD", value: "3,284", trend: "↑ 8.1%", note: "vs last 30 days", tBg: "#EEF4EF", tFg: "#2F6B45" },
          { label: "ACTIVE EVENTS", value: "6", trend: "0", note: "2 go live next week", tBg: "#FAF7F5", tFg: "#6B6B6B" },
          { label: "CHECK-INS TODAY", value: "412", trend: "36%", note: "of 1,150 expected", tBg: "#FDECEA", tFg: "#B71C14" },
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
            <div className="mt-2 flex items-center gap-2 text-[13px] text-[#6B6B6B]">
              <span
                className="rounded-full px-2 py-0.5 font-bold"
                style={{ background: k.tBg, color: k.tFg }}
              >
                {k.trend}
              </span>
              {k.note}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-stretch gap-5">
        <div className="min-w-0 flex-[2_1_520px] rounded-xl border border-[#EDE6E3] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[17px] font-bold">Bookings over time</div>
              <div className="mt-0.5 text-[13px] text-[#6B6B6B]">
                {chart.chartTotal} bookings in this period
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
            <div
              className="absolute -right-[5px] -mt-[5px] h-2.5 w-2.5 rounded-full bg-[#E5251B] shadow-[0_0_0_4px_#fff]"
              style={{ top: chart.lastY }}
            />
          </div>
          <div className="mt-2.5 flex justify-between text-xs text-[#6B6B6B]">
            <span>{chart.x0}</span>
            <span>{chart.x1}</span>
            <span>Today</span>
          </div>
        </div>
        <div className="min-w-0 flex-[1_1_300px] rounded-xl border border-[#EDE6E3] p-6">
          <div className="text-[17px] font-bold">Top events by sales</div>
          <div className="mt-4.5 flex flex-col gap-[18px]">
            {TOP_EVENTS.map(([name, rev], i) => (
              <div key={name}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-bold">{name}</span>
                  <span className="tabular-nums">{fmt(rev)}</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#F3EEEB]">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width: (rev / TOP_EVENTS[0][1]) * 100 + "%",
                      background: i === 0 ? "#E5251B" : "#141414",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section id="bookings" className="mt-5 scroll-mt-[90px] rounded-xl border border-[#EDE6E3]">
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
          <div className="grid grid-cols-[1.6fr_1.6fr_.9fr_.8fr_.9fr_.6fr_44px] gap-4 border-y border-[#EDE6E3] bg-[#FAF7F5] px-6 py-3">
            {COLS.map((c) => (
              <button
                key={c.key}
                onClick={() => handleSort(c.key)}
                style={{
                  color: sort === c.key ? "#141414" : "#6B6B6B",
                  justifyContent: c.align === "right" ? "flex-end" : "flex-start",
                  textAlign: c.align,
                }}
                className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em]"
              >
                {c.label}
                <span className="text-[#E5251B]">
                  {sort === c.key ? (dir > 0 ? "↑" : "↓") : ""}
                </span>
              </button>
            ))}
            <span />
          </div>

          {loading ? (
            [1, 2, 3, 4, 5].map((k) => (
              <div
                key={k}
                className="flex animate-[hwPulse_1.4s_ease_infinite] gap-4 border-b border-[#EDE6E3] px-6 py-[18px]"
              >
                <div className="h-3 w-[22%] rounded-full bg-[#F3EEEB]" />
                <div className="h-3 w-[28%] rounded-full bg-[#F3EEEB]" />
                <div className="h-3 w-[12%] rounded-full bg-[#F3EEEB]" />
              </div>
            ))
          ) : (
            rows.map((r) => {
              const b = BADGE[r.status];
              return (
                <div
                  key={r.id}
                  className="relative grid grid-cols-[1.6fr_1.6fr_.9fr_.8fr_.9fr_.6fr_44px] items-center gap-4 border-b border-[#EDE6E3] px-6 py-3.5 text-sm transition-colors hover:bg-[#FCFAF9]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-bold">{r.name}</div>
                    <div className="text-xs text-[#6B6B6B]">{r.id}</div>
                  </div>
                  <div className="min-w-0 truncate">{r.event}</div>
                  <div className="text-[#6B6B6B]">
                    {r.type} × {r.qty}
                  </div>
                  <div className="text-right font-bold tabular-nums">
                    {r.amount ? fmt(r.amount) : "Free"}
                  </div>
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
                  <button
                    onClick={() => setMenu((m) => (m === r.id ? null : r.id))}
                    aria-label="Row actions"
                    className="flex h-8 w-8 items-center justify-center rounded-full text-lg tracking-widest text-[#6B6B6B] hover:bg-[#FAF7F5] hover:text-[#141414]"
                  >
                    ⋯
                  </button>
                  {menu === r.id && (
                    <div className="absolute right-6 top-[52px] z-10 w-[180px] animate-[hwUp_0.15s_ease_both] rounded-xl border border-[#EDE6E3] bg-white p-1.5 shadow-[0_8px_24px_rgba(20,20,20,.06)]">
                      <button
                        onClick={() => {
                          setMenu(null);
                          showToast("Opening " + r.id);
                        }}
                        className="block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-[#FAF7F5]"
                      >
                        View booking
                      </button>
                      <button
                        onClick={() => {
                          setMenu(null);
                          showToast("Ticket resent to " + r.name.split(" ")[0]);
                        }}
                        className="block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-[#FAF7F5]"
                      >
                        Resend ticket
                      </button>
                      {(r.status === "Confirmed" || r.status === "Pending") && r.amount > 0 && (
                        <button
                          onClick={() => {
                            setMenu(null);
                            setRefund(r.id);
                          }}
                          className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-[#B71C14] hover:bg-[#FDECEA]"
                        >
                          Refund
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-[#EDE6E3] lg:hidden">
          {rows.map((r) => {
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
                  {r.event} · {r.type} × {r.qty}
                </div>
                <div className="flex justify-between text-[13px] text-[#6B6B6B]">
                  <span>
                    {r.id} · {r.date}
                  </span>
                  <span className="text-sm font-bold text-[#141414]">
                    {r.amount ? fmt(r.amount) : "Free"}
                  </span>
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

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 text-[13px] text-[#6B6B6B]">
          <span>
            {total
              ? `Showing ${currentPage * PER_PAGE + 1}–${Math.min(total, currentPage * PER_PAGE + PER_PAGE)} of ${total}`
              : "No results"}
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
      </section>

      {refundBooking && (
        <div
          onClick={() => setRefund(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#141414]/36 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] animate-[hwUp_0.25s_ease_both] rounded-xl bg-white p-7"
          >
            <div className="text-[22px] font-black tracking-[-0.025em]">
              Refund {fmt(refundBooking.amount)}?
            </div>
            <p className="mt-2.5 text-[15px] leading-relaxed text-[#6B6B6B]">
              {refundBooking.name}&apos;s booking {refundBooking.id} for {refundBooking.event}{" "}
              will be cancelled and the amount returned to the original payment method.
            </p>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setRefund(null)}
                className="h-11 rounded-full border border-[#EDE6E3] px-5 text-sm font-bold"
              >
                Keep booking
              </button>
              <button
                onClick={doRefund}
                className="h-11 rounded-full bg-[#B71C14] px-5 text-sm font-bold text-white"
              >
                Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-7 left-1/2 z-[80] flex -translate-x-1/2 animate-[hwUp_0.3s_ease_both] items-center gap-2.5 whitespace-nowrap rounded-full bg-[#141414] px-5 py-3 text-sm text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6FBF8A]" />
          {toastMsg}
        </div>
      )}
    </AdminShell>
  );
}
