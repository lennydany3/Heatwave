"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { fmt } from "../_lib/data";
import HeatwaveLoader from "@/components/HeatwaveLoader";
import { Empty, PageHeader, Panel, Pill, Toast } from "../_components/ui";

type TierStatus = "open" | "coming_soon" | "closed";

type Tier = {
  id: string;
  name: string;
  priceMale: number | null;
  priceFemale: number | null;
  status: TierStatus;
  limit: number | null;
  accepted: number;
  pending: number;
  held: number;
  remaining: number | null;
  waiting: number;
  registrationClosed: boolean;
};

type EventRow = {
  id: string;
  name: string;
  venue: string | null;
  startsAt: string | null;
  accepted: number;
  pending: number;
  declined: number;
  revenue: number;
  waiting: number;
  tiers: Tier[];
};

const QUICK_LIMITS = [5, 10, 20, 30, 35, 50];

const price = (n: number | null, hidden = false) => (hidden ? "••••" : n ? fmt(n) : "× × ×");

function tierBadge(t: Tier): { label: string; c: [string, string, string] } {
  if (t.status === "coming_soon") return { label: "Coming soon", c: ["#FFF6E5", "#8A5A00", "#D99A1E"] };
  if (t.status === "closed") return { label: "Closed manually", c: ["#F3EEEB", "#4A4543", "#8C8480"] };
  if (t.registrationClosed) return { label: "Full · waitlist open", c: ["#FDECEA", "#B71C14", "#E5251B"] };
  return { label: "On sale", c: ["#EEF4EF", "#2F6B45", "#3F8A5A"] };
}

function TierCard({
  tier,
  busy,
  masks,
  onSave,
}: {
  tier: Tier;
  busy: boolean;
  masks: string[];
  onSave: (body: { seatLimit?: number | null; status?: TierStatus }) => void;
}) {
  const [draft, setDraft] = useState(tier.limit === null ? "" : String(tier.limit));
  const badge = tierBadge(tier);
  const used = tier.accepted + tier.pending + tier.held;
  const pct = tier.limit ? Math.min(100, Math.round((used / tier.limit) * 100)) : 0;
  const parsed = draft === "" ? null : Number(draft);
  const dirty = parsed !== tier.limit;

  const canToggle = !masks.includes("registration_toggle");
  const canEditSeats = !masks.includes("seat_edit");

  if (tier.status === "coming_soon") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-[#E8DCD6] bg-[#FCFAF9] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold">{tier.name}</span>
            <Pill tone={badge.c}>{badge.label}</Pill>
          </div>
          <div className="mt-1 text-[13px] text-[#6B6B6B]">
            Under development · shown as &ldquo;Announced soon&rdquo; on the event page
          </div>
        </div>
        {canToggle && (
          <button
            onClick={() => onSave({ status: "open" })}
            disabled={busy}
            className="h-11 flex-none rounded-full bg-[#141414] px-5 text-[13px] font-bold text-white transition active:scale-[.98] disabled:opacity-35 sm:h-10"
          >
            Start sales
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#EDE6E3] bg-[#FCFAF9] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-bold">{tier.name}</div>
          <div className="mt-0.5 text-[13px] text-[#6B6B6B]">
            Female {price(tier.priceFemale, masks.includes("prices"))} · Male {price(tier.priceMale, masks.includes("prices"))}
          </div>
        </div>
        <Pill tone={badge.c}>{badge.label}</Pill>
      </div>

      <div className="mt-4">
        <div className="flex items-end justify-between gap-3">
          <div className="text-[13px] leading-snug text-[#6B6B6B]">
            <span className="font-bold text-[#2F6B45]">{tier.accepted}</span> accepted ·{" "}
            <span className="font-bold text-[#8A5A00]">{tier.pending}</span> pending
            {tier.held > 0 && (
              <>
                {" "}
                · <span className="font-bold text-[#141414]">{tier.held}</span> held for waitlist
              </>
            )}
          </div>
          <div className="flex-none text-right">
            {tier.limit === null ? (
              <span className="text-sm font-bold">No limit</span>
            ) : (
              <>
                <span className="text-[22px] font-black leading-none tracking-[-0.03em] tabular-nums">
                  {tier.remaining}
                </span>
                <span className="text-[13px] font-bold text-[#6B6B6B]"> / {tier.limit} left</span>
              </>
            )}
          </div>
        </div>
        {tier.limit !== null && (
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#EDE6E3]">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: pct + "%",
                background: tier.registrationClosed ? "#B71C14" : "linear-gradient(90deg,#FF7A45,#E5251B)",
              }}
            />
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-[#EDE6E3] pt-4">
        {canEditSeats && (
          <>
            <div className="text-[11px] font-bold tracking-[0.12em] text-[#6B6B6B]">REGISTRATION SEATS</div>
            <div className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              {[...QUICK_LIMITS.map(String), ""].map((n) => {
                const on = draft === n;
                return (
                  <button
                    key={n || "unlimited"}
                    onClick={() => setDraft(n)}
                    className={`h-9 flex-none rounded-full border px-3.5 text-[13px] font-bold transition-colors ${
                      on
                        ? "border-[#141414] bg-[#141414] text-white"
                        : "border-[#EDE6E3] bg-white text-[#6B6B6B] hover:text-[#141414]"
                    }`}
                  >
                    {n || "Unlimited"}
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                placeholder="Custom, e.g. 40"
                className="h-11 min-w-0 flex-1 rounded-xl border border-[#EDE6E3] bg-white px-3.5 text-base outline-none focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)] sm:max-w-[170px]"
              />
              <button
                onClick={() => onSave({ seatLimit: parsed })}
                disabled={busy || !dirty}
                className="h-11 flex-none rounded-full bg-[#141414] px-5 text-[13px] font-bold text-white transition active:scale-[.98] disabled:opacity-30"
              >
                Save limit
              </button>
            </div>
          </>
        )}

        {canToggle && (
          <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${canEditSeats ? "mt-4" : ""}`}>
            <button
              onClick={() => onSave({ status: "coming_soon" })}
              disabled={busy}
              className="order-2 h-9 text-left text-[13px] font-bold text-[#6B6B6B] hover:text-[#141414] disabled:opacity-35 sm:order-1"
            >
              Set back to &ldquo;Coming soon&rdquo;
            </button>
            {tier.status === "open" && (
              <button
                onClick={() => onSave({ status: "closed" })}
                disabled={busy}
                className="order-1 h-11 rounded-full border border-[#F3C9C5] bg-white px-5 text-[13px] font-bold text-[#B71C14] transition-colors hover:bg-[#FDECEA] disabled:opacity-35 sm:order-2 sm:h-10"
              >
                Close registration
              </button>
            )}
            {tier.status === "closed" && (
              <button
                onClick={() => onSave({ status: "open" })}
                disabled={busy}
                className="order-1 h-11 rounded-full bg-[#2F6B45] px-5 text-[13px] font-bold text-white disabled:opacity-35 sm:order-2 sm:h-10"
              >
                Reopen registration
              </button>
            )}
          </div>
        )}
        {tier.waiting > 0 && (
          <Link
            href="/admin/waitlist"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#FDECEA] px-3 py-1.5 text-[13px] font-bold text-[#B71C14]"
          >
            {tier.waiting} on the waitlist →
          </Link>
        )}
      </div>
    </div>
  );
}

export default function AdminEventsPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [migrated, setMigrated] = useState(true);
  const [masks, setMasks] = useState<string[]>([]);
  const [busyTier, setBusyTier] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [now, setNow] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function showToast(msg: string) {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2600);
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/events", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      setLoadError(data?.error ?? "Couldn't load events");
    } else {
      setLoadError("");
      setEvents(data.events);
      setMigrated(data.migrated);
      setMasks(data.masks ?? []);
    }
    setNow(Date.now());
    setLoading(false);
  }, []);

  useEffect(() => {
    // Data fetch on mount; state is set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function saveTier(
    tier: Tier,
    body: { seatLimit?: number | null; status?: TierStatus },
    msg: string
  ) {
    setBusyTier(tier.id);
    const res = await fetch("/api/admin/tiers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierId: tier.id, ...body }),
    });
    const data = await res.json().catch(() => null);
    setBusyTier(null);
    if (!res.ok) {
      showToast(data?.error ?? "Couldn't update — try again");
      return;
    }
    showToast(msg);
    await load();
  }

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    return events.filter((e) => !query || (e.name + (e.venue ?? "")).toLowerCase().includes(query));
  }, [events, q]);

  return (
    <AdminShell active="events" search={q} onSearchChange={setQ}>
      <PageHeader eyebrow="EVENTS" title="Your events" />

      {!loading && !migrated && (
        <div className="mt-6 rounded-2xl bg-[#FFF6E5] px-5 py-4 text-sm leading-relaxed text-[#8A5A00]">
          <span className="font-bold">One-time setup needed.</span> Run{" "}
          <span className="font-bold">supabase/seat-limits-waitlist.sql</span> in the Supabase SQL
          editor to turn on seat limits and the waitlist.
        </div>
      )}

      {loading && (
        <div className="mt-16">
          <HeatwaveLoader label="Loading events" />
        </div>
      )}

      {!loading && loadError && (
        <Empty
          bare
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

      <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:gap-5">
        {!loading &&
          !loadError &&
          visible.map((e) => {
            const startsAt = e.startsAt ? new Date(e.startsAt) : null;
            const ended = startsAt ? startsAt.getTime() < now : false;
            return (
              <Panel key={e.id} className="max-w-[900px] animate-[hwUp_0.5s_ease_both]">
                <div className="relative overflow-hidden bg-[#141414] px-4 pb-5 pt-5 text-white sm:px-6 sm:pt-6">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#E5251B] opacity-45 blur-3xl"
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -bottom-24 left-10 h-40 w-40 rounded-full bg-[#FF7A45] opacity-15 blur-3xl"
                  />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[12.5px] text-white/60">
                        {startsAt
                          ? startsAt.toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "Date TBA"}
                        {e.venue ? ` · ${e.venue}` : ""}
                      </div>
                      <div className="mt-1.5 text-[26px] font-black leading-[1.05] tracking-[-0.04em] sm:text-[32px]">
                        {e.name}
                      </div>
                    </div>
                    <Pill
                      tone={
                        ended
                          ? ["rgba(255,255,255,.1)", "rgba(255,255,255,.7)", "rgba(255,255,255,.5)"]
                          : ["rgba(111,191,138,.16)", "#9BE0B1", "#6FBF8A"]
                      }
                    >
                      {ended ? "Ended" : "Upcoming"}
                    </Pill>
                  </div>

                  <div className="relative mt-5 grid grid-cols-3 gap-x-3 gap-y-4 border-t border-white/10 pt-4 sm:grid-cols-5">
                    {[
                      { l: "ACCEPTED", v: String(e.accepted) },
                      { l: "PENDING", v: String(e.pending) },
                      { l: "DECLINED / FAILED", v: String(e.declined) },
                      { l: "WAITLIST", v: String(e.waiting) },
                      { l: "REVENUE", v: masks.includes("revenue") ? "₹ ••••" : fmt(e.revenue) },
                    ].map((k) => (
                      <div key={k.l} className="flex min-w-0 flex-col justify-between">
                        <div className="text-[10px] font-bold leading-tight tracking-[0.12em] text-white/45">
                          {k.l}
                        </div>
                        <div
                          className={`mt-1.5 truncate text-[22px] font-black leading-none tracking-[-0.035em] tabular-nums ${
                            k.l === "REVENUE" ? "text-[#FF6B5E]" : ""
                          }`}
                        >
                          {k.v}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 p-3 sm:p-5">
                  {e.tiers.map((t) => (
                    <TierCard
                      key={`${t.id}-${t.limit}`}
                      tier={t}
                      busy={busyTier === t.id}
                      masks={masks}
                      onSave={(body) =>
                        saveTier(
                          t,
                          body,
                          body.status === "closed"
                            ? `${t.name} registration closed`
                            : body.status === "open"
                              ? `${t.name} registration open`
                              : body.status === "coming_soon"
                                ? `${t.name} set to coming soon`
                                : "Seat limit saved"
                        )
                      }
                    />
                  ))}
                </div>

                <p className="m-0 px-4 pb-5 text-[12.5px] leading-relaxed text-[#6B6B6B] sm:px-6">
                  Seats are counted from accepted and pending registrations. When you decline a
                  payment or mark it unsuccessful, that seat is freed and registration reopens
                  automatically. When a tier is full, customers can join the waitlist instead.
                </p>
              </Panel>
            );
          })}
      </div>

      {!loading && !loadError && visible.length === 0 && (
        <Panel className="mt-6">
          <Empty bare title="No events found" />
        </Panel>
      )}

      <Toast msg={toastMsg} />
    </AdminShell>
  );
}
