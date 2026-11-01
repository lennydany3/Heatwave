"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { fmt } from "../_lib/data";
import HeatwaveLoader from "@/components/HeatwaveLoader";

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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#FAF7F5] px-4 py-4">
        <div>
          <div className="text-[15px] font-bold">{tier.name}</div>
          <div className="text-[13px] text-[#6B6B6B]">
            Under development · shown as &ldquo;Announced soon&rdquo; on the event page
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
            style={{ background: badge.c[0], color: badge.c[1] }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: badge.c[2] }} />
            {badge.label}
          </span>
          {canToggle && (
            <button
              onClick={() => onSave({ status: "open" })}
              disabled={busy}
              className="h-9 rounded-full border border-[#EDE6E3] bg-white px-4 text-[13px] font-bold hover:border-[#141414] disabled:opacity-35"
            >
              Start sales
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-[#FAF7F5] px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div>
          <div className="text-[15px] font-bold">{tier.name}</div>
          <div className="text-[13px] text-[#6B6B6B]">
            Female {price(tier.priceFemale, masks.includes("prices"))} · Male {price(tier.priceMale, masks.includes("prices"))}
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
          style={{ background: badge.c[0], color: badge.c[1] }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: badge.c[2] }} />
          {badge.label}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap justify-between gap-2 text-[13px]">
          <span className="text-[#6B6B6B]">
            <span className="font-bold text-[#2F6B45]">{tier.accepted}</span> accepted ·{" "}
            <span className="font-bold text-[#8A5A00]">{tier.pending}</span> pending verification
            {tier.held > 0 && (
              <>
                {" "}
                · <span className="font-bold text-[#141414]">{tier.held}</span> held for waitlist
              </>
            )}
          </span>
          <span className="font-bold tabular-nums">
            {tier.limit === null
              ? "No limit"
              : `${tier.remaining} of ${tier.limit} seats left`}
          </span>
        </div>
        {tier.limit !== null && (
          <div className="mt-2 h-[4px] overflow-hidden rounded-full bg-[#EDE6E3]">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: pct + "%", background: tier.registrationClosed ? "#B71C14" : "#E5251B" }}
            />
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-[#EDE6E3] pt-4">
        {canEditSeats && (
          <div className="text-[11px] font-bold tracking-[0.12em] text-[#6B6B6B]">
            REGISTRATION SEATS
          </div>
        )}
        <div className={canEditSeats ? "mt-2 flex flex-wrap gap-1.5" : "hidden"}>
          {QUICK_LIMITS.map((n) => (
            <button
              key={n}
              onClick={() => setDraft(String(n))}
              style={{
                background: draft === String(n) ? "#141414" : "#fff",
                color: draft === String(n) ? "#fff" : "#6B6B6B",
                borderColor: draft === String(n) ? "#141414" : "#EDE6E3",
              }}
              className="rounded-full border px-3 py-1 text-[13px] font-bold"
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setDraft("")}
            style={{
              background: draft === "" ? "#141414" : "#fff",
              color: draft === "" ? "#fff" : "#6B6B6B",
              borderColor: draft === "" ? "#141414" : "#EDE6E3",
            }}
            className="rounded-full border px-3 py-1 text-[13px] font-bold"
          >
            Unlimited
          </button>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
          {canEditSeats && (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 5))}
            inputMode="numeric"
            placeholder="Custom, e.g. 40"
            className="h-10 w-[150px] rounded-xl border border-[#EDE6E3] bg-white px-3.5 text-[15px] outline-none focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)]"
          />
          )}
          {canEditSeats && (
          <button
            onClick={() => onSave({ seatLimit: parsed })}
            disabled={busy || !dirty}
            className="h-10 rounded-full bg-[#141414] px-5 text-[13px] font-bold text-white disabled:opacity-35"
          >
            Save limit
          </button>
          )}
          <span className="flex-1" />
          {canToggle && tier.status === "open" && (
            <button
              onClick={() => onSave({ status: "closed" })}
              disabled={busy}
              className="h-10 rounded-full border border-[#F3C9C5] bg-white px-5 text-[13px] font-bold text-[#B71C14] hover:bg-[#FDECEA] disabled:opacity-35"
            >
              Close registration
            </button>
          )}
          {canToggle && tier.status === "closed" && (
            <button
              onClick={() => onSave({ status: "open" })}
              disabled={busy}
              className="h-10 rounded-full bg-[#2F6B45] px-5 text-[13px] font-bold text-white disabled:opacity-35"
            >
              Reopen registration
            </button>
          )}
        </div>
        {canToggle && (
          <button
            onClick={() => onSave({ status: "coming_soon" })}
            disabled={busy}
            className="mt-3 block text-[13px] font-bold text-[#6B6B6B] hover:text-[#141414] disabled:opacity-35"
          >
            Set back to &ldquo;Coming soon&rdquo;
          </button>
        )}
        {tier.waiting > 0 && (
          <Link href="/admin/waitlist" className="mt-3 inline-block text-[13px] font-bold text-[#E5251B]">
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">EVENTS</div>
          <h1 className="m-0 mt-2 text-[30px] font-black leading-[1] tracking-[-0.04em] sm:text-[40px]">
            Your events
          </h1>
        </div>
      </div>

      {!loading && !migrated && (
        <div className="mt-6 rounded-xl bg-[#FFF6E5] px-5 py-4 text-sm leading-relaxed text-[#8A5A00]">
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
        <div className="mt-10 text-center">
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

      <div className="mt-7 grid grid-cols-1 gap-4">
        {!loading &&
          !loadError &&
          visible.map((e) => {
            const startsAt = e.startsAt ? new Date(e.startsAt) : null;
            const ended = startsAt ? startsAt.getTime() < now : false;
            return (
              <div
                key={e.id}
                className="flex max-w-[860px] animate-[hwUp_0.5s_ease_both] flex-col gap-5 rounded-xl border border-[#EDE6E3] bg-white p-5.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] text-[#6B6B6B]">
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
                    <div className="mt-1.5 text-xl font-black tracking-[-0.025em]">{e.name}</div>
                  </div>
                  <span
                    className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={
                      ended
                        ? { background: "#F3EEEB", color: "#6B6B6B" }
                        : { background: "#EEF4EF", color: "#2F6B45" }
                    }
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: ended ? "#6B6B6B" : "#3F8A5A" }}
                    />
                    {ended ? "Ended" : "Upcoming"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 border-y border-[#EDE6E3] py-4 sm:grid-cols-5">
                  {[
                    { l: "ACCEPTED", v: String(e.accepted) },
                    { l: "PENDING", v: String(e.pending) },
                    { l: "DECLINED / FAILED", v: String(e.declined) },
                    { l: "WAITLIST", v: String(e.waiting) },
                    { l: "REVENUE", v: masks.includes("revenue") ? "₹ ••••" : fmt(e.revenue) },
                  ].map((k) => (
                    <div key={k.l}>
                      <div className="text-[11px] font-bold tracking-[0.12em] text-[#6B6B6B]">
                        {k.l}
                      </div>
                      <div className="mt-1 text-xl font-black tracking-[-0.03em] tabular-nums">
                        {k.v}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3">
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

                <p className="m-0 text-[13px] leading-relaxed text-[#6B6B6B]">
                  Seats are counted from accepted and pending registrations. When you decline a
                  payment or mark it unsuccessful, that seat is freed and registration reopens
                  automatically. When a tier is full, customers can join the waitlist instead.
                </p>
              </div>
            );
          })}
      </div>

      {!loading && !loadError && visible.length === 0 && (
        <div className="mt-7 rounded-xl border border-[#EDE6E3] px-6 py-14 text-center">
          <div className="text-lg font-bold">No events found</div>
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
