"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { fmt } from "../_lib/data";
import HeatwaveLoader from "@/components/HeatwaveLoader";
import { Avatar, Chips, DangerBar, Empty, PageHeader, Panel, PanelHead, Pill, Sheet, SheetActions, StatCard, StatGrid, Toast } from "../_components/ui";
import type { VerifyState } from "@/lib/verification";

type Customer = {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  instagram: string | null;
  age: number | null;
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

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function Badge({ state }: { state: VerifyState }) {
  return <Pill tone={BADGE[state]}>{LABEL[state]}</Pill>;
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold tracking-[0.12em] text-[#6B6B6B] sm:text-[11px]">{label}</div>
      <div className="mt-0.5 break-words text-[14px] font-bold sm:text-[15px]">{value || "—"}</div>
    </div>
  );
}

export default function AdminCustomersPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [masks, setMasks] = useState<string[]>([]);
  const has = (item: string) => masks.includes(item);
  const money = (n: number) => (masks.includes("payment") ? "₹ ••••" : fmt(n));
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
      setMasks(data.masks ?? []);
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
      <PageHeader eyebrow="CUSTOMERS" title="Customer details">
        Everything each customer entered in the registration form, with their payment outcome.
        Open a customer to see the full details or delete them.
      </PageHeader>

      <StatGrid>
        {(
          [
            ["accepted", "ACCEPTED", "legit customers"],
            ["declined", "DECLINED", "not a legit customer"],
            ["unsuccessful", "UNSUCCESSFUL", "payment didn't go through"],
            ["pending", "PENDING", "awaiting verification"],
          ] as [VerifyState, string, string][]
        ).map(([key, label, note], i) => (
          <StatCard
            key={key}
            index={i}
            label={label}
            value={counts[key]}
            note={note}
            dot={BADGE[key][2]}
            loading={loading}
            onClick={() => setFilter(filter === key ? "all" : key)}
            active={filter === key}
          />
        ))}
      </StatGrid>

      <Panel className="mt-3 sm:mt-5">
        <PanelHead title="All customers">
          <Chips
            options={FILTERS.map(([id, l]) => ({ id, label: l, count: counts[id] }))}
            value={filter}
            onChange={setFilter}
          />
        </PanelHead>

        {loading && (
          <div className="border-t border-[#EDE6E3] px-6 py-16">
            <HeatwaveLoader label="Loading customers" />
          </div>
        )}

        {!loading && loadError && (
          <Empty
            error
            title={loadError}
            action={
              <button
                onClick={() => {
                  setLoading(true);
                  load();
                }}
                className="mt-3 text-sm font-bold text-[#E5251B]"
              >
                Retry
              </button>
            }
          />
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
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors sm:gap-4 sm:px-6 sm:py-4 ${
                    open ? "bg-[#FCFAF9]" : "hover:bg-[#FCFAF9] active:bg-[#FAF7F5]"
                  }`}
                >
                  <Avatar name={c.fullName} dark={open} size={42} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold sm:text-[16px]">{c.fullName}</span>
                    <span className="block truncate text-[12.5px] text-[#6B6B6B] sm:text-[13px]">
                      {has("contact") ? "Contact details hidden" : `${c.email} · ${c.mobile}`}
                    </span>
                    <span className="mt-1.5 block sm:hidden">
                      <Badge state={c.decision} />
                    </span>
                  </span>
                  <span className="hidden flex-none text-right sm:block">
                    <span className="block text-[15px] font-bold tabular-nums">{money(c.amount)}</span>
                    <span className="block text-xs text-[#6B6B6B]">{c.tierName ?? "Ticket"}</span>
                  </span>
                  <span className="hidden sm:block">
                    <Badge state={c.decision} />
                  </span>
                  <span
                    className={`flex h-8 w-8 flex-none items-center justify-center rounded-full transition-[transform,background] duration-200 ${
                      open ? "rotate-180 bg-[#141414] text-white" : "bg-[#F3EEEB] text-[#6B6B6B]"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </button>

                {open && (
                  <div className="animate-[hwUp_0.25s_ease_both] border-t border-dashed border-[#EDE6E3] bg-[#FAF7F5] px-4 py-5 sm:px-6 sm:py-6">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold tracking-[0.14em] text-[#E5251B]">
                          REGISTRATION FORM
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl bg-white p-4 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-5 sm:p-5">
                          <Detail label="FULL NAME" value={c.fullName} />
                          <Detail label="EMAIL" value={c.email} />
                          <Detail label="MOBILE" value={c.mobile} />
                          <Detail label="INSTAGRAM" value={c.instagram ? `@${c.instagram.replace(/^@/, "")}` : null} />
                          <Detail label="AGE" value={c.age === null ? null : String(c.age)} />
                          <Detail label="GENDER" value={c.gender ? c.gender[0].toUpperCase() + c.gender.slice(1) : null} />
                        </div>

                        <div className="mt-6 text-[11px] font-bold tracking-[0.14em] text-[#E5251B]">
                          TICKET &amp; PAYMENT
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl bg-white p-4 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-5 sm:p-5">
                          <Detail label="EVENT" value={c.eventName} />
                          <Detail label="TICKET TYPE" value={c.tierName} />
                          <Detail label="AMOUNT" value={money(c.amount)} />
                          <Detail label="UPI TXN ID" value={c.upiTxnId} />
                          <Detail label="BOOKING ID" value={c.ticketCode} />
                          <Detail label="REGISTERED" value={when(c.createdAt)} />
                          <Detail
                            label="CHECK-IN"
                            value={c.checkedInAt ? `Checked in ${when(c.checkedInAt)}` : "Not checked in"}
                          />
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold tracking-[0.12em] text-[#6B6B6B] sm:text-[11px]">
                              PAYMENT OUTCOME
                            </div>
                            <div className="mt-1">
                              <Badge state={c.decision} />
                            </div>
                          </div>
                        </div>

                        {c.note && c.decision !== "accepted" && (
                          <div className="mt-4 rounded-xl border border-[#EDE6E3] bg-white px-3.5 py-2.5 text-[13px]">
                            <span className="font-bold">Reason:</span> {c.note}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-row items-end gap-3 lg:flex-col lg:items-stretch">
                        <button
                          onClick={() => c.proofUrl && setPreview(c)}
                          disabled={!c.proofUrl}
                          aria-label={c.proofUrl ? `View payment screenshot from ${c.fullName}` : undefined}
                          className="relative h-[150px] w-[112px] flex-none overflow-hidden rounded-xl border border-[#EDE6E3] bg-white text-[11px] text-[#6B6B6B]"
                        >
                          {c.proofUrl ? (
                            <Image
                              src={c.proofUrl}
                              alt={`Payment screenshot from ${c.fullName}`}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          ) : has("proof") ? (
                            "Hidden"
                          ) : (
                            "No screenshot"
                          )}
                        </button>
                        {!has("delete") && (
                          <button
                            onClick={() => askDelete(c)}
                            className="h-11 flex-1 rounded-full border border-[#F3C9C5] bg-white px-5 text-[13px] font-bold text-[#B71C14] transition-colors hover:bg-[#B71C14] hover:text-white lg:h-10 lg:flex-none"
                          >
                            Delete customer
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        {!loading && !loadError && list.length === 0 && (
          <Empty title="No customers here">Nothing matches this filter or search.</Empty>
        )}
      </Panel>

      {toDelete && (
        <Sheet onClose={() => !deleting && setToDelete(null)} labelledBy="del-title" alert>
          <DangerBar id="del-title">Danger: permanent deletion</DangerBar>
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
              Type <span className="rounded bg-[#FDECEA] px-1.5 py-0.5 text-[#B71C14]">DELETE</span> to confirm
            </label>
            <input
              id="del-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="DELETE"
              className="mt-2 h-12 w-full rounded-xl border border-[#EDE6E3] px-4 text-base outline-none focus:border-[#B71C14] focus:shadow-[0_0_0_3px_rgba(183,28,20,.15)]"
            />
            {deleteError && <div className="mt-2 text-[13px] text-[#C8372D]">{deleteError}</div>}
            <SheetActions>
              <button
                onClick={() => setToDelete(null)}
                disabled={deleting}
                className="rounded-full border border-[#EDE6E3] px-5 text-sm font-bold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={confirmText !== "DELETE" || deleting}
                className="min-w-[150px] rounded-full bg-[#B71C14] px-5 text-sm font-bold text-white transition-opacity disabled:opacity-35"
              >
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </SheetActions>
          </div>
        </Sheet>
      )}

      {preview?.proofUrl && (
        <Sheet onClose={() => setPreview(null)} width={460}>
          <div className="relative h-[80dvh] bg-[#FAF7F5]">
            <Image
              src={preview.proofUrl}
              alt={`Payment screenshot from ${preview.fullName}`}
              fill
              unoptimized
              className="object-contain"
            />
          </div>
        </Sheet>
      )}

      <Toast msg={toastMsg} />
    </AdminShell>
  );
}
