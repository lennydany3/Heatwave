"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { fmt } from "../_lib/data";

type VerifyStatus = "pending" | "paid" | "failed";
type Filter = "pending" | "paid" | "failed" | "all";

type Submission = {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  amount: number;
  status: VerifyStatus;
  upiTxnId: string;
  note: string | null;
  verifiedAt: string | null;
  createdAt: string;
  tierName: string | null;
  ticketCode: string | null;
  proofUrl: string | null;
};

const LABEL: Record<VerifyStatus, string> = {
  pending: "Pending",
  paid: "Verified",
  failed: "Failed",
};

const STATUS_BADGE: Record<VerifyStatus, [string, string, string]> = {
  pending: ["#FFF6E5", "#8A5A00", "#D99A1E"],
  paid: ["#EEF4EF", "#2F6B45", "#3F8A5A"],
  failed: ["#FDECEA", "#B71C14", "#E5251B"],
};

const FILTERS: [Filter, string][] = [
  ["pending", "Pending"],
  ["paid", "Verified"],
  ["failed", "Failed"],
  ["all", "All"],
];

const QUICK_REASONS: Record<"pending" | "failed", string[]> = {
  pending: [
    "Payment not received in account yet",
    "Checking with bank",
    "Screenshot unclear — contact support",
  ],
  failed: [
    "Transaction ID not found",
    "Amount paid doesn't match ticket price",
    "Screenshot doesn't match transaction ID",
    "Duplicate / reused payment",
  ],
};

export default function AdminVerificationPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("pending");
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; status: "pending" | "failed" } | null>(
    null
  );
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [preview, setPreview] = useState<Submission | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function showToast(msg: string) {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2400);
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/verification", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      setLoadError(data?.error ?? "Couldn't load submissions");
      setLoading(false);
      return;
    }
    setLoadError("");
    setRows(data.registrations);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Data fetch on mount; state is set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { pending: 0, paid: 0, failed: 0, all: rows.length };
    rows.forEach((r) => c[r.status]++);
    return c;
  }, [rows]);

  const verifiedAmount = rows
    .filter((r) => r.status === "paid")
    .reduce((a, r) => a + r.amount, 0);
  const pendingAmount = rows
    .filter((r) => r.status === "pending")
    .reduce((a, r) => a + r.amount, 0);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "all" || r.status === filter) &&
        (!query ||
          (r.fullName + r.email + r.mobile + r.upiTxnId + (r.ticketCode ?? ""))
            .toLowerCase()
            .includes(query))
    );
  }, [rows, filter, q]);

  async function update(row: Submission, status: VerifyStatus, note = "") {
    setSaving(row.id);
    const res = await fetch("/api/admin/verification", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId: row.id, status, note }),
    });
    const data = await res.json().catch(() => null);
    setSaving(null);
    if (!res.ok) {
      showToast(data?.error ?? "Couldn't update — try again");
      return;
    }
    setEditing(null);
    setReason("");
    showToast(`${row.fullName} marked ${LABEL[status].toLowerCase()}`);
    await load();
  }

  function startEdit(row: Submission, status: "pending" | "failed") {
    setEditing({ id: row.id, status });
    setReason(row.status === status ? row.note ?? "" : "");
    setReasonError("");
  }

  function saveReason(row: Submission) {
    if (!editing) return;
    const note = reason.trim();
    if (editing.status === "failed" && !note) {
      setReasonError("Add a reason — it's shown to the scanner at the gate");
      return;
    }
    update(row, editing.status, note);
  }

  return (
    <AdminShell active="verification" search={q} onSearchChange={setQ}>
      <div>
        <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
          PAYMENT VERIFICATION
        </div>
        <h1 className="m-0 mt-2 text-[30px] font-black leading-[1] tracking-[-0.04em] sm:text-[40px]">
          Verify UPI payments
        </h1>
        <p className="mt-2 max-w-[620px] text-sm leading-relaxed text-[#6B6B6B]">
          Match each transaction ID and screenshot against your UPI account. Only verified tickets
          pass the scanner — pending and failed tickets show your reason at check-in.
        </p>
      </div>

      <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { l: "TO VERIFY", v: String(counts.pending), n: `${fmt(pendingAmount)} waiting` },
          { l: "VERIFIED", v: fmt(verifiedAmount), n: `${counts.paid} tickets` },
          { l: "FAILED", v: String(counts.failed), n: "rejected payments" },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-[#EDE6E3] p-5">
            <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">{k.l}</div>
            <div className="mt-2.5 text-[30px] font-black tracking-[-0.035em] tabular-nums">
              {k.v}
            </div>
            <div className="mt-1.5 text-[13px] text-[#6B6B6B]">{k.n}</div>
          </div>
        ))}
      </div>

      <section className="mt-5 rounded-xl border border-[#EDE6E3]">
        <div className="flex flex-wrap items-center justify-between gap-3.5 px-6 py-4.5">
          <div className="text-[17px] font-bold">Submissions</div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(([id, l]) => {
              const on = filter === id;
              return (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  style={{
                    background: on ? "#141414" : "#fff",
                    color: on ? "#fff" : "#6B6B6B",
                    borderColor: on ? "#141414" : "#EDE6E3",
                  }}
                  className="rounded-full border px-3.5 py-1.5 text-[13px] font-bold"
                >
                  {l} <span className="opacity-60">{counts[id]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {loading && (
          <div className="border-t border-[#EDE6E3] px-6 py-14 text-center text-sm text-[#6B6B6B]">
            Loading submissions…
          </div>
        )}

        {!loading && loadError && (
          <div className="border-t border-[#EDE6E3] px-6 py-14 text-center">
            <div className="text-lg font-bold text-[#B71C14]">{loadError}</div>
            <button onClick={load} className="mt-3 text-sm font-bold text-[#E5251B]">
              Retry
            </button>
          </div>
        )}

        {!loading &&
          !loadError &&
          list.map((r) => {
            const b = STATUS_BADGE[r.status];
            const isEditing = editing?.id === r.id;
            const busy = saving === r.id;
            const created = new Date(r.createdAt);
            return (
              <div
                key={r.id}
                className="flex flex-col gap-4 border-t border-[#EDE6E3] px-5 py-5 sm:px-6 lg:flex-row lg:items-start"
              >
                <button
                  onClick={() => r.proofUrl && setPreview(r)}
                  disabled={!r.proofUrl}
                  className="relative h-[120px] w-[90px] flex-none overflow-hidden rounded-lg border border-[#EDE6E3] bg-[#FAF7F5] text-[11px] text-[#6B6B6B]"
                >
                  {r.proofUrl ? (
                    <Image
                      src={r.proofUrl}
                      alt={`Payment screenshot from ${r.fullName}`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    "No screenshot"
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[17px] font-bold">{r.fullName}</span>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
                      style={{ background: b[0], color: b[1] }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: b[2] }} />
                      {LABEL[r.status]}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[13px] text-[#6B6B6B]">
                    {r.email} · {r.mobile}
                  </div>
                  <div className="mt-3.5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                    <div>
                      <div className="text-[11px] font-bold tracking-[0.12em] text-[#6B6B6B]">
                        UPI TXN ID
                      </div>
                      <div className="mt-0.5 font-bold tabular-nums">{r.upiTxnId}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold tracking-[0.12em] text-[#6B6B6B]">
                        AMOUNT
                      </div>
                      <div className="mt-0.5 font-bold tabular-nums">{fmt(r.amount)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold tracking-[0.12em] text-[#6B6B6B]">
                        TICKET
                      </div>
                      <div className="mt-0.5 truncate font-bold">
                        {r.tierName ?? "—"}
                        {r.ticketCode && (
                          <span className="font-normal text-[#6B6B6B]"> · {r.ticketCode}</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold tracking-[0.12em] text-[#6B6B6B]">
                        SUBMITTED
                      </div>
                      <div className="mt-0.5 font-bold">
                        {created.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        <span className="font-normal text-[#6B6B6B]">
                          {" "}
                          ·{" "}
                          {created.toLocaleTimeString("en-IN", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {r.note && r.status !== "paid" && (
                    <div className="mt-3 rounded-lg bg-[#FAF7F5] px-3.5 py-2.5 text-[13px]">
                      <span className="font-bold">Reason shown at scan:</span> {r.note}
                    </div>
                  )}

                  {isEditing && editing && (
                    <div className="mt-3.5 animate-[hwUp_0.2s_ease_both] rounded-xl border border-[#EDE6E3] p-4">
                      <div className="text-sm font-bold">
                        {editing.status === "failed"
                          ? "Why did this payment fail?"
                          : "Why is this still pending? (optional)"}
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {QUICK_REASONS[editing.status].map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              setReason(s);
                              setReasonError("");
                            }}
                            style={{
                              borderColor: reason === s ? "#E5251B" : "#EDE6E3",
                              color: reason === s ? "#E5251B" : "#6B6B6B",
                            }}
                            className="rounded-full border px-3 py-1 text-xs font-bold"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={reason}
                        onChange={(e) => {
                          setReason(e.target.value.slice(0, 300));
                          setReasonError("");
                        }}
                        rows={2}
                        placeholder="Reason shown to the gate scanner"
                        className="mt-3 w-full resize-none rounded-lg border border-[#EDE6E3] px-3 py-2 text-sm outline-none focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)]"
                      />
                      {reasonError && (
                        <div className="mt-1 text-[13px] text-[#C8372D]">{reasonError}</div>
                      )}
                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          onClick={() => setEditing(null)}
                          className="h-9 rounded-full px-4 text-[13px] font-bold text-[#6B6B6B] hover:text-[#141414]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveReason(r)}
                          disabled={busy}
                          className="h-9 rounded-full bg-[#141414] px-4 text-[13px] font-bold text-white disabled:opacity-50"
                        >
                          {busy ? "Saving…" : `Mark ${LABEL[editing.status].toLowerCase()}`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-none flex-wrap gap-2 lg:w-[132px] lg:flex-col">
                  <button
                    onClick={() => update(r, "paid")}
                    disabled={busy || r.status === "paid"}
                    className="h-9 rounded-full bg-[#2F6B45] px-4 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-35"
                  >
                    {r.status === "paid" ? "Verified" : "Verify"}
                  </button>
                  <button
                    onClick={() => startEdit(r, "pending")}
                    disabled={busy}
                    className="h-9 rounded-full border border-[#EDE6E3] px-4 text-[13px] font-bold hover:border-[#D99A1E] hover:text-[#8A5A00] disabled:opacity-35"
                  >
                    Pending
                  </button>
                  <button
                    onClick={() => startEdit(r, "failed")}
                    disabled={busy}
                    className="h-9 rounded-full border border-[#EDE6E3] px-4 text-[13px] font-bold hover:border-[#E5251B] hover:text-[#E5251B] disabled:opacity-35"
                  >
                    Failed
                  </button>
                </div>
              </div>
            );
          })}

        {!loading && !loadError && list.length === 0 && (
          <div className="border-t border-[#EDE6E3] px-6 py-14 text-center">
            <div className="text-lg font-bold">
              {filter === "pending" ? "All caught up" : "Nothing here"}
            </div>
            <div className="mt-1.5 text-sm text-[#6B6B6B]">
              {filter === "pending"
                ? "No payments are waiting for verification."
                : "No submissions match this filter."}
            </div>
          </div>
        )}
      </section>

      {preview?.proofUrl && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#141414]/70 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-full max-w-[460px] animate-[hwUp_0.25s_ease_both] flex-col overflow-hidden rounded-xl bg-white"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#EDE6E3] px-5 py-3.5">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-bold">{preview.fullName}</div>
                <div className="text-xs tabular-nums text-[#6B6B6B]">
                  UTR {preview.upiTxnId} · {fmt(preview.amount)}
                </div>
              </div>
              <button
                onClick={() => setPreview(null)}
                aria-label="Close"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-xl text-[#6B6B6B] hover:bg-[#FAF7F5] hover:text-[#141414]"
              >
                ×
              </button>
            </div>
            <div className="relative min-h-[60vh] flex-1 bg-[#FAF7F5]">
              <Image
                src={preview.proofUrl}
                alt={`Payment screenshot from ${preview.fullName}`}
                fill
                unoptimized
                className="object-contain"
              />
            </div>
            <a
              href={preview.proofUrl}
              target="_blank"
              rel="noreferrer"
              className="border-t border-[#EDE6E3] px-5 py-3 text-center text-sm font-bold text-[#E5251B]"
            >
              Open full size
            </a>
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
