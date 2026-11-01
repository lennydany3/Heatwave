"use client";

import { useEffect, useMemo, useState } from "react";
import AdminShell from "../_components/AdminShell";
import HeatwaveLoader from "@/components/HeatwaveLoader";
import { fmt } from "../_lib/data";
import { createClient } from "@/utils/supabase/client";

type TierStatus = "open" | "coming_soon" | "closed";

type TierRow = {
  id: string;
  event_id: string;
  name: string;
  price_male: number | null;
  price_female: number | null;
  status: TierStatus;
  sort_order: number;
};

type EventRow = { id: string; name: string; venue: string | null; starts_at: string | null };

type RegistrationRow = {
  event_id: string;
  ticket_tier_id: string;
  amount: number;
  status: "pending" | "paid" | "failed" | "cancelled";
};

const TIER_BADGE: Record<TierStatus, { label: string; c: [string, string, string] }> = {
  open: { label: "On sale", c: ["#EEF4EF", "#2F6B45", "#3F8A5A"] },
  coming_soon: { label: "Coming soon", c: ["#FFF6E5", "#8A5A00", "#D99A1E"] },
  closed: { label: "Closed", c: ["#F3EEEB", "#6B6B6B", "#6B6B6B"] },
};

const price = (n: number | null) => (n ? fmt(n) : "× × ×");

export default function AdminEventsPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [regs, setRegs] = useState<RegistrationRow[]>([]);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const [e, t, r] = await Promise.all([
        supabase.from("events").select("id, name, venue, starts_at").order("starts_at"),
        supabase
          .from("ticket_tiers")
          .select("id, event_id, name, price_male, price_female, status, sort_order")
          .order("sort_order"),
        supabase.from("registrations").select("event_id, ticket_tier_id, amount, status"),
      ]);
      if (cancelled) return;
      setEvents(e.data ?? []);
      setTiers((t.data ?? []) as TierRow[]);
      setRegs((r.data ?? []) as RegistrationRow[]);
      setNow(Date.now());
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    return events.filter(
      (e) => !query || (e.name + (e.venue ?? "")).toLowerCase().includes(query)
    );
  }, [events, q]);

  const totals = useMemo(() => {
    const live = regs.filter((r) => r.status !== "cancelled");
    return {
      accepted: live.filter((r) => r.status === "paid").length,
      pending: live.filter((r) => r.status === "pending").length,
      declined: live.filter((r) => r.status === "failed").length,
    };
  }, [regs]);

  return (
    <AdminShell active="events" search={q} onSearchChange={setQ}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">EVENTS</div>
          <h1 className="m-0 mt-2 text-[30px] font-black leading-[1] tracking-[-0.04em] sm:text-[40px]">
            Your events
          </h1>
        </div>
        <div className="flex flex-wrap gap-5 text-sm text-[#6B6B6B]">
          <span>
            <span className="font-bold text-[#141414]">{totals.accepted}</span> Accepted
          </span>
          <span>
            <span className="font-bold text-[#141414]">{totals.pending}</span> Pending
          </span>
          <span>
            <span className="font-bold text-[#141414]">{totals.declined}</span> Declined / unsuccessful
          </span>
        </div>
      </div>

      {loading && (
        <div className="mt-16">
          <HeatwaveLoader label="Loading events" />
        </div>
      )}

      <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {!loading &&
          visible.map((e) => {
            const eventRegs = regs.filter((r) => r.event_id === e.id && r.status !== "cancelled");
            const accepted = eventRegs.filter((r) => r.status === "paid");
            const revenue = accepted.reduce((a, r) => a + r.amount, 0);
            const startsAt = e.starts_at ? new Date(e.starts_at) : null;
            const ended = startsAt ? startsAt.getTime() < now : false;
            return (
              <div
                key={e.id}
                className="flex animate-[hwUp_0.5s_ease_both] flex-col gap-5 rounded-xl border border-[#EDE6E3] bg-white p-5.5"
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

                <div className="grid grid-cols-3 gap-3 border-y border-[#EDE6E3] py-4">
                  {[
                    { l: "ACCEPTED", v: String(accepted.length) },
                    {
                      l: "PENDING",
                      v: String(eventRegs.filter((r) => r.status === "pending").length),
                    },
                    { l: "REVENUE", v: fmt(revenue) },
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

                <div className="flex flex-col gap-2.5">
                  {tiers
                    .filter((t) => t.event_id === e.id)
                    .map((t) => {
                      const badge = TIER_BADGE[t.status];
                      const sold = accepted.filter((r) => r.ticket_tier_id === t.id).length;
                      return (
                        <div
                          key={t.id}
                          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-[#FAF7F5] px-4 py-3"
                        >
                          <div>
                            <div className="text-[15px] font-bold">{t.name}</div>
                            <div className="text-[13px] text-[#6B6B6B]">
                              Female {price(t.price_female)} · Male {price(t.price_male)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[13px] text-[#6B6B6B]">{sold} sold</span>
                            <span
                              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
                              style={{ background: badge.c[0], color: badge.c[1] }}
                            >
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: badge.c[2] }}
                              />
                              {badge.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
      </div>

      {!loading && visible.length === 0 && (
        <div className="mt-7 rounded-xl border border-[#EDE6E3] px-6 py-14 text-center">
          <div className="text-lg font-bold">No events found</div>
          <div className="mt-1.5 text-sm text-[#6B6B6B]">
            Events are read from your database — nothing matches this search.
          </div>
        </div>
      )}
    </AdminShell>
  );
}
