"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { fmt } from "../_lib/data";
import HeatwaveLoader from "@/components/HeatwaveLoader";
import type { VerifyState } from "@/lib/verification";

type Customer = {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  instagram: string | null;
  age: number;
  gender: string;
  amount: number;
  decision: VerifyState;
  upiTxnId: string | null;
  note: string | null;
  createdAt: string;
  eventName: string | null;
  tierName: string | null;
  ticketCode: string | null;
  checkedInAt: string | null;
  proofUrl: string | null;
};

type Filter = VerifyState | "all";

const LABEL: Record<VerifyState, string> = {
  pending: "Pending",
  accepted: "Accepted",
  declined: "Declined",
  unsuccessful: "Unsuccessful",
};

const BADGE: Record<VerifyState, [string, string, string]> = {
  pending: ["#FFF6E5", "#8A5A00", "#D99A1E"],
  accepted: ["#EEF4EF", "#2F6B45", "#3F8A5A"],
  declined: ["#FDECEA", "#B71C14", "#E5251B"],
  unsuccessful: ["#F3EEEB", "#4A4543", "#8C8480"],
};

const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["accepted", "Accepted"],
  ["declined", "Declined"],
  ["unsuccessful", "Unsuccessful"],
  ["pending", "Pending"],
];

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function Badge({ state }: { state: VerifyState }) {
  const b = BADGE[state];
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold"
      style={{ background: b[0], color: b[1] }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: b[2] }} />
      {LABEL[state]}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-bold tracking-[0.12em] text-[#6B6B6B]">{label}</div>
      <div className="mt-0.5 break-words text-[15px] font-bold">{value || "—"}</div>
    </div>
  );
}

export default function AdminCustomersPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Customer | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [preview, setPreview] = useState<Customer | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function showToast(msg: string) {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2600);
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/customers", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      setLoadError(data?.error ?? "Couldn't load customers");
    } else {
      setLoadError("");
      setRows(data.customers);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Data fetch on mount; state is set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { all: rows.length, accepted: 0, declined: 0, unsuccessful: 0, pending: 0 };
    rows.forEach((r) => c[r.decision]++);
    return c;
  }, [rows]);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "all" || r.decision === filter) &&
        (!query ||
          (r.fullName + r.email + r.mobile + (r.instagram ?? "") + (r.upiTxnId ?? "") + (r.ticketCode ?? ""))
            .toLowerCase()
            .includes(query))
    );
  }, [rows, filter, q]);

  function askDelete(c: Customer) {
    setToDelete(c);
    setConfirmText("");
    setDeleteError("");
  }

  async function confirmDelete() {
    if (!toDelete || confirmText !== "DELETE") return;
    setDeleting(true);
    setDeleteError("");
    const res = await fetch("/api/admin/customers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId: toDelete.id }),
    });
    const data = await res.json().catch(() => null);
    setDeleting(false);
    if (!res.ok) {
      setDeleteError(data?.error ?? "Couldn't delete — try again");
      return;
    }
    setRows((r) => r.filter((x) => x.id !== toDelete.id));
    setOpenId(null);
    showToast(`${toDelete.fullName} was permanently deleted`);
    setToDelete(null);
  }

  return (
    <AdminShell active="customers" search={q} onSearchChange={setQ}>
      <div>
        <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">CUSTOMERS</div>
        <h1 className="m-0 mt-2 text-[30px] font-black leading-[1] tracking-[-0.04em] sm:text-[40px]">
          Customer details
        </h1>
        <p className="mt-2 max-w-[620px] text-sm leading-relaxed text-[#6B6B6B]">
          Everything each customer entered in the registration form, with their payment outcome.
          Open a customer to see the full details or delete them.
        </p>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(
          [
            ["accepted", "ACCEPTED", "legit customers"],
            ["declined", "DECLINED", "not a legit customer"],
            ["unsuccessful", "UNSUCCESSFUL", "payment didn't go through"],
            ["pending", "PENDING", "awaiting verification"],
          ] as [VerifyState, string, string][]
        ).map(([key, label, note]) => (
          <button
            key={key}
            onClick={() => setFilter(filter === key ? "all" : key)}
            style={{
              borderColor: filter === key ? BADGE[key][2] : "#EDE6E3",
              boxShadow: filter === key ? `0 0 0 1px ${BADGE[key][2]}` : "none",
            }}
            className="rounded-xl border p-5 text-left transition-transform duration-200 hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: BADGE[key][2] }} />
              {label}
            </div>
            <div className="mt-2.5 text-[30px] font-black tracking-[-0.035em] tabular-nums">
              {counts[key]}
            </div>
            <div className="mt-1 text-[13px] text-[#6B6B6B]">{note}</div>
          </button>
        ))}
      </div>

      <section className="mt-5 rounded-xl border border-[#EDE6E3]">
        <div className="flex flex-wrap items-center justify-between gap-3.5 px-6 py-4.5">
          <div className="text-[17px] font-bold">All customers</div>
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
          <div className="border-t border-[#EDE6E3] px-6 py-16">
            <HeatwaveLoader label="Loading customers" />
          </div>
        )}

        {!loading && loadError && (
          <div className="border-t border-[#EDE6E3] px-6 py-14 text-center">
            <div className="text-lg font-bold text-[#B71C14]">{loadError}</div>
            <button
              onClick={() => {
                setLoading(true);
                load();
              }}
              className="mt-3 text-sm font-bold text-[#E5251B]"
            >
              Retry
            </button>
          </div>
        )}

        {!loading &&
          !loadError &&
          list.map((c) => {
            const open = openId === c.id;
            return (
              <div key={c.id} className="border-t border-[#EDE6E3]">
                <button
                  onClick={() => setOpenId(open ? null : c.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[#FCFAF9] sm:px-6"
                >
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#FAF7F5] text-sm font-bold text-[#6B6B6B]">
                    {initials(c.fullName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-bold">{c.fullName}</span>
                    <span className="block truncate text-[13px] text-[#6B6B6B]">
                      {c.email} · {c.mobile}
                    </span>
                  </span>
                  <span className="hidden flex-none text-right sm:block">
                    <span className="block text-[15px] font-bold tabular-nums">{fmt(c.amount)}</span>
                    <span className="block text-xs text-[#6B6B6B]">{c.tierName ?? "Ticket"}</span>
                  </span>
                  <Badge state={c.decision} />
                  <span
                    className="flex-none text-lg text-[#6B6B6B] transition-transform duration-200"
                    style={{ transform: open ? "rotate(180deg)" : "none" }}
                  >
                    ⌄
                  </span>
                </button>

                {open && (
                  <div className="animate-[hwUp_0.25s_ease_both] border-t border-dashed border-[#EDE6E3] bg-[#FAF7F5] px-5 py-6 sm:px-6">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
                      <div>
                        <div className="text-[11px] font-bold tracking-[0.14em] text-[#E5251B]">
                          REGISTRATION FORM
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                          <Detail label="FULL NAME" value={c.fullName} />
                          <Detail label="EMAIL" value={c.email} />
                          <Detail label="MOBILE" value={c.mobile} />
                          <Detail label="INSTAGRAM" value={c.instagram ? `@${c.instagram.replace(/^@/, "")}` : null} />
                          <Detail label="AGE" value={String(c.age)} />
                          <Detail label="GENDER" value={c.gender ? c.gender[0].toUpperCase() + c.gender.slice(1) : null} />
                        </div>

                        <div className="mt-7 text-[11px] font-bold tracking-[0.14em] text-[#E5251B]">
                          TICKET &amp; PAYMENT
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                          <Detail label="EVENT" value={c.eventName} />
                          <Detail label="TICKET TYPE" value={c.tierName} />
                          <Detail label="AMOUNT" value={fmt(c.amount)} />
                          <Detail label="UPI TXN ID" value={c.upiTxnId} />
                          <Detail label="BOOKING ID" value={c.ticketCode} />
                          <Detail label="REGISTERED" value={when(c.createdAt)} />
                          <Detail
                            label="CHECK-IN"
                            value={c.checkedInAt ? `Checked in ${when(c.checkedInAt)}` : "Not checked in"}
                          />
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold tracking-[0.12em] text-[#6B6B6B]">
                              PAYMENT OUTCOME
                            </div>
                            <div className="mt-1">
                              <Badge state={c.decision} />
                            </div>
                          </div>
                        </div>

                        {c.note && c.decision !== "accepted" && (
                          <div className="mt-5 rounded-lg border border-[#EDE6E3] bg-white px-3.5 py-2.5 text-[13px]">
                            <span className="font-bold">Reason:</span> {c.note}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-row items-start gap-4 lg:flex-col">
                        <button
                          onClick={() => c.proofUrl && setPreview(c)}
                          disabled={!c.proofUrl}
                          className="relative h-[150px] w-[112px] flex-none overflow-hidden rounded-lg border border-[#EDE6E3] bg-white text-[11px] text-[#6B6B6B]"
                        >
                          {c.proofUrl ? (
                            <Image
                              src={c.proofUrl}
                              alt={`Payment screenshot from ${c.fullName}`}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          ) : (
                            "No screenshot"
                          )}
                        </button>
                        <button
                          onClick={() => askDelete(c)}
                          className="h-10 rounded-full border border-[#F3C9C5] bg-white px-5 text-[13px] font-bold text-[#B71C14] transition-colors hover:bg-[#B71C14] hover:text-white"
                        >
                          Delete customer
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        {!loading && !loadError && list.length === 0 && (
          <div className="border-t border-[#EDE6E3] px-6 py-14 text-center">
            <div className="text-lg font-bold">No customers here</div>
            <div className="mt-1.5 text-sm text-[#6B6B6B]">Nothing matches this filter or search.</div>
          </div>
        )}
      </section>

      {toDelete && (
        <div
          onClick={() => !deleting && setToDelete(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#141414]/60 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-labelledby="del-title"
            className="w-full max-w-[480px] animate-[hwUp_0.25s_ease_both] overflow-hidden rounded-xl bg-white"
          >
            <div className="flex items-center gap-3 bg-[#B71C14] px-6 py-4 text-white">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 3l10 18H2L12 3z"
                  stroke="#fff"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path d="M12 10v5M12 18v.01" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div id="del-title" className="text-[17px] font-black tracking-[-0.01em]">
                Danger: permanent deletion
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="m-0 text-[15px] leading-relaxed">
                You are about to permanently delete{" "}
                <span className="font-bold">{toDelete.fullName}</span> ({toDelete.email}). This{" "}
                <span className="font-bold text-[#B71C14]">cannot be undone</span>.
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#6B6B6B]">
                <li>Their registration form details</li>
                <li>Their ticket and QR code (it will stop working at the gate)</li>
                <li>Their payment record and UPI transaction ID, in Payments and Verification</li>
                <li>Their payment screenshot</li>
              </ul>
              <label htmlFor="del-confirm" className="mt-5 block text-sm font-bold">
                Type <span className="rounded bg-[#FDECEA] px-1.5 py-0.5 text-[#B71C14]">DELETE</span>{" "}
                to confirm
              </label>
              <input
                id="del-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                placeholder="DELETE"
                className="mt-2 h-12 w-full rounded-xl border border-[#EDE6E3] px-4 text-base outline-none focus:border-[#B71C14] focus:shadow-[0_0_0_3px_rgba(183,28,20,.15)]"
              />
              {deleteError && <div className="mt-2 text-[13px] text-[#C8372D]">{deleteError}</div>}
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  onClick={() => setToDelete(null)}
                  disabled={deleting}
                  className="h-11 rounded-full border border-[#EDE6E3] px-5 text-sm font-bold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={confirmText !== "DELETE" || deleting}
                  className="h-11 min-w-[150px] rounded-full bg-[#B71C14] px-5 text-sm font-bold text-white transition-opacity disabled:opacity-35"
                >
                  {deleting ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {preview?.proofUrl && (
        <div
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#141414]/70 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative h-[80vh] w-full max-w-[460px] overflow-hidden rounded-xl bg-white"
          >
            <Image
              src={preview.proofUrl}
              alt={`Payment screenshot from ${preview.fullName}`}
              fill
              unoptimized
              className="object-contain"
            />
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
