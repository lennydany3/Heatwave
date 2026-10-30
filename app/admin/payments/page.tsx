"use client";

import { useMemo, useRef, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { BOOKINGS, fmt } from "../_lib/data";

type PayStatus = "Paid" | "Pending" | "Refunded" | "Failed";
type Txn = {
  id: string;
  name: string;
  event: string;
  amount: number;
  tx: string;
  method: string;
  st: PayStatus;
  date: string;
  time: string;
};

const PAY_BADGE: Record<PayStatus, [string, string, string]> = {
  Paid: ["#EEF4EF", "#2F6B45", "#3F8A5A"],
  Pending: ["#FAF7F5", "#6B6B6B", "#B5ADA9"],
  Refunded: ["#F3EEEB", "#6B6B6B", "#6B6B6B"],
  Failed: ["#FDECEA", "#B71C14", "#E5251B"],
};
const STATUS_CYCLE: PayStatus[] = ["Paid", "Paid", "Paid", "Pending", "Paid", "Refunded", "Paid", "Failed"];
const FILTERS = ["All", "Paid", "Pending", "Refunded", "Failed"];

const TRANSACTIONS: Txn[] = BOOKINGS.filter((b) => b.amount > 0).map((b, i) => ({
  id: b.id,
  name: b.name,
  event: b.event,
  amount: b.amount,
  tx: "TXN" + (88231 - i * 97),
  method: i % 3 === 1 ? "Card ·· 4242" : "UPI · " + b.name.split(" ")[0].toLowerCase() + "@okaxis",
  st: STATUS_CYCLE[i % 8],
  date: b.date,
  time: (10 + (i % 9)) + ":" + String((i * 7) % 60).padStart(2, "0"),
}));

export default function AdminPaymentsPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [refund, setRefund] = useState<string | null>(null);
  const [refunded, setRefunded] = useState<Record<string, boolean>>({});
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function showToast(msg: string) {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2400);
  }

  const txns = useMemo(
    () => TRANSACTIONS.map((t) => ({ ...t, st: refunded[t.id] ? ("Refunded" as PayStatus) : t.st })),
    [refunded]
  );

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return txns.filter(
      (t) =>
        (filter === "All" || t.st === filter) &&
        (!query || (t.name + t.tx + t.event).toLowerCase().includes(query))
    );
  }, [txns, filter, q]);

  const gross = txns.filter((t) => t.st === "Paid").reduce((a, t) => a + t.amount, 0);
  const refunds = txns.filter((t) => t.st === "Refunded").reduce((a, t) => a + t.amount, 0);
  const refundedCount = txns.filter((t) => t.st === "Refunded").length;
  const refundTxn = refund ? txns.find((t) => t.id === refund) : undefined;

  function doRefund() {
    if (!refund || !refundTxn) return;
    const id = refund;
    const amount = refundTxn.amount;
    setRefunded((r) => ({ ...r, [id]: true }));
    setRefund(null);
    showToast("Refund of " + fmt(amount) + " started");
  }

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
          { l: "COLLECTED", v: fmt(gross), n: "Last 30 days" },
          { l: "REFUNDED", v: fmt(refunds), n: `${refundedCount} transactions` },
          { l: "NEXT PAYOUT", v: fmt(Math.round(gross * 0.96)), n: "Mon, 1 Feb to HDFC ·· 0921" },
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

        <div className="hidden lg:block">
          <div className="grid grid-cols-[1fr_1.5fr_1.4fr_.8fr_.8fr_80px] gap-4 border-y border-[#EDE6E3] bg-[#FAF7F5] px-6 py-3 text-[11px] font-bold tracking-[0.12em] text-[#6B6B6B]">
            <span>TRANSACTION</span>
            <span>ATTENDEE · EVENT</span>
            <span>METHOD</span>
            <span className="text-right">AMOUNT</span>
            <span>STATUS</span>
            <span />
          </div>
          {rows.map((r) => {
            const b = PAY_BADGE[r.st];
            const canRefund = r.st === "Paid";
            return (
              <div
                key={r.id}
                className="grid grid-cols-[1fr_1.5fr_1.4fr_.8fr_.8fr_80px] items-center gap-4 border-b border-[#EDE6E3] px-6 py-3.5 text-sm transition-colors hover:bg-[#FCFAF9]"
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
                <div className="truncate text-[#6B6B6B]">{r.method}</div>
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
                <div className="text-right">
                  {canRefund && (
                    <button
                      onClick={() => setRefund(r.id)}
                      className="text-[13px] font-bold text-[#B71C14] hover:text-[#E5251B]"
                    >
                      Refund
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-[#EDE6E3] lg:hidden">
          {rows.map((r) => {
            const b = PAY_BADGE[r.st];
            const canRefund = r.st === "Paid";
            return (
              <div key={r.id} className="flex flex-col gap-1.5 border-b border-[#EDE6E3] px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold">{r.name}</span>
                  <span className="font-black">{fmt(r.amount)}</span>
                </div>
                <div className="text-[13px] text-[#6B6B6B]">
                  {r.tx} · {r.method}
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={{ background: b[0], color: b[1] }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: b[2] }} />
                    {r.st}
                  </span>
                  {canRefund && (
                    <button
                      onClick={() => setRefund(r.id)}
                      className="text-[13px] font-bold text-[#B71C14]"
                    >
                      Refund
                    </button>
                  )}
                </div>
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
      </section>

      {refundTxn && (
        <div
          onClick={() => setRefund(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#141414]/36 p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] animate-[hwUp_0.25s_ease_both] rounded-xl bg-white p-7"
          >
            <div className="text-[22px] font-black tracking-[-0.025em]">
              Refund {fmt(refundTxn.amount)}?
            </div>
            <p className="mt-2.5 text-[15px] leading-relaxed text-[#6B6B6B]">
              {refundTxn.tx} from {refundTxn.name} will be refunded to {refundTxn.method}. Their
              booking will be cancelled.
            </p>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setRefund(null)}
                className="h-11 rounded-full border border-[#EDE6E3] px-5 text-sm font-bold"
              >
                Cancel
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
