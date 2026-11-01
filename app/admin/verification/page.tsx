"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell from "../_components/AdminShell";
import HeatwaveLoader from "@/components/HeatwaveLoader";
import { fmt } from "../_lib/data";
import { Chips, Empty, PageHeader, Panel, PanelHead, Pill, Sheet, StatCard, StatGrid, Toast } from "../_components/ui";
import type { VerifyState } from "@/lib/verification";

type Filter = VerifyState | "all";
type Reasoned = "pending" | "declined" | "unsuccessful";

type Submission = {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  amount: number;
  decision: VerifyState;
  upiTxnId: string;
  note: string | null;
  verifiedAt: string | null;
  createdAt: string;
  tierName: string | null;
  ticketCode: string | null;
  proofUrl: string | null;
};

const LABEL: Record<VerifyState, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  unsuccessful: "Unsuccessful",
};

const STATUS_BADGE: Record<VerifyState, [string, string, string]> = {
  pending: ["#FFF6E5", "#8A5A00", "#D99A1E"],
  accepted: ["#EEF4EF", "#2F6B45", "#3F8A5A"],
  declined: ["#FDECEA", "#B71C14", "#E5251B"],
  unsuccessful: ["#F3EEEB", "#4A4543", "#8C8480"],
};

const FILTERS: [Filter, string][] = [
  ["pending", "Pending"],
  ["accepted", "Accepted"],
  ["declined", "Declined"],
  ["unsuccessful", "Unsuccessful"],
  ["all", "All"],
];

const QUICK_REASONS: Record<Reasoned, string[]> = {
  pending: [
    "Payment not received in account yet",
    "Checking with bank",
    "Screenshot unclear — contact support",
  ],
  declined: [
    "Couldn't confirm this is a genuine customer",
    "Screenshot doesn't match transaction ID",
    "Duplicate / reused payment",
  ],
  unsuccessful: [
    "Transaction ID not found in our account",
    "Payment didn't go through",
    "Amount paid doesn't match ticket price",
  ],
};

const REASON_PROMPT: Record<Reasoned, string> = {
  pending: "Why is this still pending? (optional)",
  declined: "Why are you declining this customer?",
  unsuccessful: "Why was this payment unsuccessful?",
};

export default function AdminVerificationPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("pending");
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Items an admin has masked for this account; the server already blanks the data.
  const [masks, setMasks] = useState<string[]>([]);
  const has = (item: string) => masks.includes(item);
  const money = (n: number) => (masks.includes("amount") ? "₹ ••••" : fmt(n));
  const [saving, setSaving] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; decision: Reasoned } | null>(
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
    setMasks(data.masks ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Data fetch on mount; state is set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { pending: 0, accepted: 0, declined: 0, unsuccessful: 0, all: rows.length };
    rows.forEach((r) => c[r.decision]++);
    return c;
  }, [rows]);

  const acceptedAmount = rows
    .filter((r) => r.decision === "accepted")
    .reduce((a, r) => a + r.amount, 0);
  const pendingAmount = rows
    .filter((r) => r.decision === "pending")
    .reduce((a, r) => a + r.amount, 0);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "all" || r.decision === filter) &&
        (!query ||
          (r.fullName + r.email + r.mobile + r.upiTxnId + (r.ticketCode ?? ""))
            .toLowerCase()
            .includes(query))
    );
  }, [rows, filter, q]);

  async function update(row: Submission, decision: VerifyState, note = "") {
    setSaving(row.id);
    const res = await fetch("/api/admin/verification", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId: row.id, decision, note }),
    });
    const data = await res.json().catch(() => null);
    setSaving(null);
    if (!res.ok) {
      showToast(data?.error ?? "Couldn't update — try again");
      return;
    }
    setEditing(null);
    setReason("");
    const marked = `${row.fullName} marked ${LABEL[decision].toLowerCase()}`;
    if (data?.emailed === true) showToast(`${marked} · email sent`);
    else if (data?.emailed === false) showToast(`${marked}, but the email couldn't be sent`);
    else showToast(marked);
    await load();
  }

  function startEdit(row: Submission, decision: Reasoned) {
    setEditing({ id: row.id, decision });
    setReason(row.decision === decision ? row.note ?? "" : "");
    setReasonError("");
  }

  function saveReason(row: Submission) {
    if (!editing) return;
    const note = reason.trim();
    if (editing.decision !== "pending" && !note) {
      setReasonError("Add a reason — it's shown to the scanner at the gate");
      return;
    }
    update(row, editing.decision, note);
  }

  return (
    <AdminShell active="verification" search={q} onSearchChange={setQ}>
      <PageHeader eyebrow="PAYMENT VERIFICATION" title="Verify UPI payments">
        Match each transaction ID and screenshot against your UPI account, then mark it Accepted,
        Declined or Unsuccessful. Only accepted tickets pass the scanner — every other ticket shows
        your reason at check-in.
      </PageHeader>

      <StatGrid>
        {[
          { l: "TO VERIFY", v: String(counts.pending), n: `${money(pendingAmount)} waiting`, dot: "#D99A1E" },
          { l: "ACCEPTED", v: money(acceptedAmount), n: `${counts.accepted} tickets`, dot: "#3F8A5A" },
          { l: "DECLINED", v: String(counts.declined), n: "not a legit customer", dot: "#E5251B" },
          { l: "UNSUCCESSFUL", v: String(counts.unsuccessful), n: "payment didn't go through", dot: "#8C8480" },
        ].map((k, i) => (
          <StatCard
            key={k.l}
            index={i}
            dark={i === 0}
            label={k.l}
            value={k.v}
            note={k.n}
            dot={i === 0 ? undefined : k.dot}
            loading={loading}
          />
        ))}
      </StatGrid>

      <Panel className="mt-3 sm:mt-5">
        <PanelHead title="Submissions">
          <Chips
            options={FILTERS.map(([id, l]) => ({ id, label: l, count: counts[id] }))}
            value={filter}
            onChange={setFilter}
          />
        </PanelHead>

        {loading && (
          <div className="border-t border-[#EDE6E3] px-6 py-16">
            <HeatwaveLoader label="Loading submissions" />
          </div>
        )}

        {!loading && loadError && (
          <Empty
            error
            title={loadError}
            action={
              <button onClick={load} className="mt-3 text-sm font-bold text-[#E5251B]">
                Retry
              </button>
            }
          />
        )}

        {!loading &&
          !loadError &&
          list.map((r) => {
            const isEditing = editing?.id === r.id;
            const busy = saving === r.id;
            const created = new Date(r.createdAt);
            return (
              <div
                key={r.id}
                className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3.5 gap-y-3 border-t border-[#EDE6E3] px-4 py-4 sm:grid-cols-[90px_minmax(0,1fr)] sm:px-6 sm:py-5 lg:grid-cols-[90px_minmax(0,1fr)_140px] lg:gap-x-6"
              >
                <button
                  onClick={() => r.proofUrl && setPreview(r)}
                  disabled={!r.proofUrl}
                  aria-label={r.proofUrl ? `View payment screenshot from ${r.fullName}` : undefined}
                  className="relative h-[96px] w-[72px] overflow-hidden rounded-xl border border-[#EDE6E3] bg-[#FAF7F5] text-[11px] leading-tight text-[#6B6B6B] sm:h-[120px] sm:w-[90px] lg:row-span-2"
                >
                  {r.proofUrl ? (
                    <>
                      <Image
                        src={r.proofUrl}
                        alt={`Payment screenshot from ${r.fullName}`}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent pb-1 pt-4 text-center text-[10px] font-bold text-white">
                        View
                      </span>
                    </>
                  ) : has("proof") ? (
                    "Hidden"
                  ) : (
                    "No screenshot"
                  )}
                </button>

                <div className="min-w-0 self-center lg:self-start">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <span className="text-[16px] font-bold sm:text-[17px]">{r.fullName}</span>
                    <Pill tone={STATUS_BADGE[r.decision]}>{LABEL[r.decision]}</Pill>
                  </div>
                  <div className="mt-1 truncate text-[13px] text-[#6B6B6B]">
                    {has("contact") ? "Contact details hidden" : `${r.email} · ${r.mobile}`}
                  </div>
                </div>

                <div className="col-span-2 min-w-0 lg:col-span-1 lg:col-start-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-[#FAF7F5] p-3 sm:grid-cols-4 lg:bg-transparent lg:p-0">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold tracking-[0.12em] text-[#6B6B6B] sm:text-[11px]">UPI TXN ID</div>
                      <div className="mt-0.5 truncate font-bold tabular-nums">{r.upiTxnId}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold tracking-[0.12em] text-[#6B6B6B] sm:text-[11px]">AMOUNT</div>
                      <div className="mt-0.5 font-bold tabular-nums">{money(r.amount)}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold tracking-[0.12em] text-[#6B6B6B] sm:text-[11px]">TICKET</div>
                      <div className="mt-0.5 truncate font-bold">
                        {r.tierName ?? "—"}
                        {r.ticketCode && <span className="font-normal text-[#6B6B6B]"> · {r.ticketCode}</span>}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold tracking-[0.12em] text-[#6B6B6B] sm:text-[11px]">SUBMITTED</div>
                      <div className="mt-0.5 truncate font-bold">
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
                  {r.note && r.decision !== "accepted" && (
                    <div className="mt-3 rounded-xl border border-[#EDE6E3] bg-white px-3.5 py-2.5 text-[13px]">
                      <span className="font-bold">Reason shown at scan:</span> {r.note}
                    </div>
                  )}

                  {isEditing && editing && (
                    <div className="mt-3.5 animate-[hwUp_0.2s_ease_both] rounded-2xl border border-[#EDE6E3] bg-white p-4 shadow-[0_10px_30px_-18px_rgba(20,20,20,.25)]">
                      <div className="text-sm font-bold">{REASON_PROMPT[editing.decision]}</div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {QUICK_REASONS[editing.decision].map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              setReason(s);
                              setReasonError("");
                            }}
                            className={`rounded-full border px-3 py-1.5 text-left text-xs font-bold transition-colors ${
                              reason === s
                                ? "border-[#E5251B] bg-[#FDECEA] text-[#B71C14]"
                                : "border-[#EDE6E3] text-[#6B6B6B]"
                            }`}
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
                        className="mt-3 w-full resize-none rounded-xl border border-[#EDE6E3] px-3 py-2 text-base outline-none focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)] sm:text-sm"
                      />
                      {reasonError && <div className="mt-1 text-[13px] text-[#C8372D]">{reasonError}</div>}
                      <div className="mt-3 flex justify-end gap-2">
                        <button
                          onClick={() => setEditing(null)}
                          className="h-10 rounded-full px-4 text-[13px] font-bold text-[#6B6B6B] hover:text-[#141414]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveReason(r)}
                          disabled={busy}
                          className="h-10 rounded-full bg-[#141414] px-5 text-[13px] font-bold text-white disabled:opacity-50"
                        >
                          {busy ? "Saving…" : `Mark ${LABEL[editing.decision].toLowerCase()}`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {has("decide") ? (
                  <div className="col-span-2 self-start rounded-full border border-[#EDE6E3] px-4 py-2 text-center text-xs font-bold text-[#6B6B6B] lg:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1">
                    View only
                  </div>
                ) : (
                  <div className="col-span-2 grid grid-cols-3 gap-2 self-start lg:col-span-1 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:flex lg:flex-col">
                    <button
                      onClick={() => update(r, "accepted")}
                      disabled={busy || r.decision === "accepted"}
                      className="h-11 rounded-full bg-[#2F6B45] px-3 text-[13px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(47,107,69,.8)] transition active:scale-[.97] disabled:opacity-35 disabled:shadow-none lg:h-9"
                    >
                      {r.decision === "accepted" ? "Accepted" : "Accept"}
                    </button>
                    <button
                      onClick={() => startEdit(r, "declined")}
                      disabled={busy}
                      className="h-11 rounded-full border border-[#EDE6E3] bg-white px-3 text-[13px] font-bold transition hover:border-[#E5251B] hover:text-[#E5251B] active:scale-[.97] disabled:opacity-35 lg:h-9"
                    >
                      Decline
                    </button>
                    <button
                      onClick={() => startEdit(r, "unsuccessful")}
                      disabled={busy}
                      className="h-11 rounded-full border border-[#EDE6E3] bg-white px-3 text-[13px] font-bold transition hover:border-[#141414] active:scale-[.97] disabled:opacity-35 lg:h-9"
                    >
                      Unsuccessful
                    </button>
                    {r.decision !== "pending" && (
                      <button
                        onClick={() => startEdit(r, "pending")}
                        disabled={busy}
                        className="col-span-3 h-9 text-xs font-bold text-[#6B6B6B] hover:text-[#8A5A00] disabled:opacity-35 lg:h-8"
                      >
                        Reset to pending
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

        {!loading && !loadError && list.length === 0 && (
          <Empty title={filter === "pending" ? "All caught up" : "Nothing here"}>
            {filter === "pending"
              ? "No payments are waiting for verification."
              : "No submissions match this filter."}
          </Empty>
        )}
      </Panel>

      {preview?.proofUrl && (
        <Sheet onClose={() => setPreview(null)} width={460}>
          <div className="flex items-center justify-between gap-3 border-b border-[#EDE6E3] px-5 pb-3.5 pt-6 sm:pt-3.5">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-bold">{preview.fullName}</div>
              <div className="text-xs tabular-nums text-[#6B6B6B]">
                UTR {preview.upiTxnId} · {money(preview.amount)}
              </div>
            </div>
            <button
              onClick={() => setPreview(null)}
              aria-label="Close"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#FAF7F5] text-xl text-[#6B6B6B] hover:text-[#141414]"
            >
              ×
            </button>
          </div>
          <div className="relative h-[62dvh] bg-[#FAF7F5]">
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
            className="block border-t border-[#EDE6E3] px-5 py-3.5 text-center text-sm font-bold text-[#E5251B]"
          >
            Open full size
          </a>
        </Sheet>
      )}

      <Toast msg={toastMsg} />
    </AdminShell>
  );
}
