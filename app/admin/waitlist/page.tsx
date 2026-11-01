"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell from "../_components/AdminShell";
import HeatwaveLoader from "@/components/HeatwaveLoader";

type Status = "waiting" | "invited" | "registered";
type Entry = {
  id: string;
  tierId: string | null;
  fullName: string;
  email: string;
  mobile: string;
  instagram: string | null;
  age: number | null;
  gender: string | null;
  status: Status;
  createdAt: string;
  tierName: string | null;
};
type TierSeats = {
  id: string;
  name: string;
  remaining: number | null;
  limit: number | null;
  accepted: number;
  pending: number;
  held: number;
};

const BADGE: Record<Status, { label: string; c: [string, string, string] }> = {
  waiting: { label: "Waiting", c: ["#FFF6E5", "#8A5A00", "#D99A1E"] },
  invited: { label: "Invited", c: ["#EEF4EF", "#2F6B45", "#3F8A5A"] },
  registered: { label: "Registered", c: ["#141414", "#FFFFFF", "#FFFFFF"] },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function AdminWaitlistPage() {
  const [q, setQ] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tiers, setTiers] = useState<TierSeats[]>([]);
  const [migrated, setMigrated] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // Invite blocked because the ticket is full: ask the admin to raise the limit first.
  const [noSeats, setNoSeats] = useState<{ entry: Entry; tier: TierSeats } | null>(null);
  const [newLimit, setNewLimit] = useState("");
  const [raising, setRaising] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function showToast(msg: string) {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2600);
  }

  const load = useCallback(async () => {
    const [w, e] = await Promise.all([
      fetch("/api/admin/waitlist", { cache: "no-store" }),
      fetch("/api/admin/events", { cache: "no-store" }),
    ]);
    const wd = await w.json().catch(() => null);
    const ed = await e.json().catch(() => null);
    if (!w.ok || !wd) {
      setLoadError(wd?.error ?? "Couldn't load the waitlist");
    } else {
      setLoadError("");
      setEntries(wd.entries);
      setMigrated(wd.migrated);
    }
    if (e.ok && ed) {
      setTiers(
        (ed.events as { tiers: TierSeats[] }[]).flatMap((ev) =>
          ev.tiers.map((t) => ({ ...t }))
        )
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Data fetch on mount; state is set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function act(entry: Entry, method: "PATCH" | "DELETE", status?: Status, msg = "Updated") {
    setBusy(entry.id);
    const res = await fetch("/api/admin/waitlist", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: entry.id, status }),
    });
    const data = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) {
      showToast(data?.error ?? "Couldn't update — try again");
      return;
    }
    showToast(msg);
    await load();
  }

  function invite(entry: Entry) {
    const tier = tiers.find((t) => t.id === entry.tierId);
    if (tier && tier.remaining !== null && tier.remaining < 1) {
      setNoSeats({ entry, tier });
      setNewLimit(String((tier.limit ?? 0) + 1));
      return;
    }
    act(entry, "PATCH", "invited", `${entry.fullName} invited — their seat is held`);
  }

  async function raiseAndInvite() {
    if (!noSeats) return;
    const limit = Number(newLimit);
    if (!Number.isInteger(limit) || limit <= (noSeats.tier.limit ?? 0)) return;
    setRaising(true);
    const res = await fetch("/api/admin/tiers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierId: noSeats.tier.id, seatLimit: limit }),
    });
    setRaising(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      showToast(data?.error ?? "Couldn't raise the limit — try again");
      return;
    }
    const entry = noSeats.entry;
    setNoSeats(null);
    await act(entry, "PATCH", "invited", `Limit raised to ${limit} · ${entry.fullName} invited`);
  }

  const counts = useMemo(() => {
    const c = { waiting: 0, invited: 0, registered: 0 };
    entries.forEach((e) => c[e.status]++);
    return c;
  }, [entries]);

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return entries.filter(
      (e) => !query || (e.fullName + e.email + e.mobile + (e.instagram ?? "")).toLowerCase().includes(query)
    );
  }, [entries, q]);

  return (
    <AdminShell active="waitlist" search={q} onSearchChange={setQ}>
      <div>
        <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">WAITLIST</div>
        <h1 className="m-0 mt-2 text-[30px] font-black leading-[1] tracking-[-0.04em] sm:text-[40px]">
          Waitlist
        </h1>
        <p className="mt-2 max-w-[640px] text-sm leading-relaxed text-[#6B6B6B]">
          Customers who tried to register after a ticket filled up. When payments are declined or
          unsuccessful, seats free up — invite people from here, oldest first. An invited customer
          can register even if the ticket is full, and their seat is held until they do.
        </p>
      </div>

      {!loading && !migrated && (
        <div className="mt-6 rounded-xl bg-[#FFF6E5] px-5 py-4 text-sm text-[#8A5A00]">
          <span className="font-bold">One-time setup needed.</span> Run{" "}
          <span className="font-bold">supabase/seat-limits-waitlist.sql</span> in the Supabase SQL
          editor to turn on the waitlist.
        </div>
      )}

      <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { l: "WAITING", v: counts.waiting, n: "in the queue" },
          { l: "INVITED", v: counts.invited, n: "seat held, not registered yet" },
          { l: "REGISTERED", v: counts.registered, n: "came off the waitlist" },
        ].map((k) => (
          <div key={k.l} className="rounded-xl border border-[#EDE6E3] p-5">
            <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">{k.l}</div>
            <div className="mt-2.5 text-[30px] font-black tracking-[-0.035em] tabular-nums">{k.v}</div>
            <div className="mt-1 text-[13px] text-[#6B6B6B]">{k.n}</div>
          </div>
        ))}
        <div className="rounded-xl border border-[#EDE6E3] bg-[#FAF7F5] p-5">
          <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">SEATS FREE NOW</div>
          <div className="mt-2.5 flex flex-col gap-1 text-[14px]">
            {tiers.map((t) => (
              <div key={t.id} className="flex justify-between gap-3">
                <span className="text-[#6B6B6B]">{t.name}</span>
                <span className="font-bold tabular-nums">
                  {t.remaining === null ? "No limit" : t.remaining}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="mt-5 rounded-xl border border-[#EDE6E3]">
        <div className="px-6 py-4.5 text-[17px] font-bold">Queue</div>

        {loading && (
          <div className="border-t border-[#EDE6E3] px-6 py-16">
            <HeatwaveLoader label="Loading waitlist" />
          </div>
        )}

        {!loading && loadError && (
          <div className="border-t border-[#EDE6E3] px-6 py-14 text-center">
            <div className="text-lg font-bold text-[#B71C14]">{loadError}</div>
          </div>
        )}

        {!loading &&
          !loadError &&
          list.map((e, i) => {
            const b = BADGE[e.status];
            const disabled = busy === e.id;
            return (
              <div
                key={e.id}
                className="flex flex-col gap-4 border-t border-[#EDE6E3] px-5 py-5 sm:px-6 lg:flex-row lg:items-center"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#FAF7F5] text-sm font-black tabular-nums text-[#6B6B6B]">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="text-[16px] font-bold">{e.fullName}</span>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
                      style={{ background: b.c[0], color: b.c[1] }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: b.c[2] }} />
                      {b.label}
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] text-[#6B6B6B]">
                    {e.email} · {e.mobile}
                    {e.instagram ? ` · @${e.instagram.replace(/^@/, "")}` : ""}
                    {e.age ? ` · ${e.age}` : ""}
                    {e.gender ? ` · ${e.gender}` : ""}
                  </div>
                  <div className="mt-0.5 text-xs text-[#6B6B6B]">
                    {e.tierName ?? "Ticket"} · joined {when(e.createdAt)}
                  </div>
                </div>
                <div className="flex flex-none flex-wrap gap-2">
                  {e.status === "waiting" && (
                    <button
                      onClick={() => invite(e)}
                      disabled={disabled}
                      className="h-9 rounded-full bg-[#2F6B45] px-5 text-[13px] font-bold text-white disabled:opacity-35"
                    >
                      Invite
                    </button>
                  )}
                  {e.status === "invited" && (
                    <button
                      onClick={() => act(e, "PATCH", "waiting", "Moved back to waiting")}
                      disabled={disabled}
                      className="h-9 rounded-full border border-[#EDE6E3] px-5 text-[13px] font-bold disabled:opacity-35"
                    >
                      Undo invite
                    </button>
                  )}
                  {e.status !== "registered" && (
                    <button
                      onClick={() => act(e, "DELETE", undefined, "Removed from the waitlist")}
                      disabled={disabled}
                      className="h-9 rounded-full border border-[#F3C9C5] px-5 text-[13px] font-bold text-[#B71C14] hover:bg-[#FDECEA] disabled:opacity-35"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}

        {!loading && !loadError && list.length === 0 && (
          <div className="border-t border-[#EDE6E3] px-6 py-14 text-center">
            <div className="text-lg font-bold">Nobody on the waitlist</div>
            <div className="mt-1.5 text-sm text-[#6B6B6B]">
              People appear here when a ticket is full or closed.
            </div>
          </div>
        )}
      </section>

      {noSeats && (
        <div
          onClick={() => !raising && setNoSeats(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#141414]/60 p-4"
        >
          <div
            onClick={(ev) => ev.stopPropagation()}
            role="alertdialog"
            aria-labelledby="noseats-title"
            className="w-full max-w-[460px] animate-[hwUp_0.25s_ease_both] overflow-hidden rounded-xl bg-white"
          >
            <div className="flex items-center gap-3 bg-[#8A5A00] px-6 py-4 text-white">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 3l10 18H2L12 3z" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M12 10v5M12 18v.01" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div id="noseats-title" className="text-[17px] font-black tracking-[-0.01em]">
                No seats free to invite
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="m-0 text-[15px] leading-relaxed">
                <span className="font-bold">{noSeats.tier.name}</span> is at its limit of{" "}
                <span className="font-bold">{noSeats.tier.limit}</span> seats:{" "}
                {noSeats.tier.accepted} accepted, {noSeats.tier.pending} pending verification
                {noSeats.tier.held > 0 ? `, ${noSeats.tier.held} held for invited customers` : ""}.
                Inviting <span className="font-bold">{noSeats.entry.fullName}</span> would go over
                the limit.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[#6B6B6B]">
                Increase the seat limit first, or decline an unverified payment to free a seat
                instead.
              </p>
              <div className="mt-4 text-[11px] font-bold tracking-[0.12em] text-[#6B6B6B]">
                NEW SEAT LIMIT
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {[1, 2, 5, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setNewLimit(String((noSeats.tier.limit ?? 0) + n))}
                    className="rounded-full border border-[#EDE6E3] px-3 py-1 text-[13px] font-bold text-[#6B6B6B] hover:border-[#141414] hover:text-[#141414]"
                  >
                    +{n}
                  </button>
                ))}
                <input
                  value={newLimit}
                  onChange={(ev) => setNewLimit(ev.target.value.replace(/\D/g, "").slice(0, 5))}
                  inputMode="numeric"
                  className="ml-auto h-10 w-[110px] rounded-xl border border-[#EDE6E3] px-3.5 text-[15px] font-bold outline-none focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)]"
                />
              </div>
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  onClick={() => setNoSeats(null)}
                  disabled={raising}
                  className="h-11 rounded-full border border-[#EDE6E3] px-5 text-sm font-bold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={raiseAndInvite}
                  disabled={raising || !(Number(newLimit) > (noSeats.tier.limit ?? 0))}
                  className="h-11 rounded-full bg-[#2F6B45] px-5 text-sm font-bold text-white disabled:opacity-35"
                >
                  {raising ? "Saving…" : `Raise to ${newLimit || "…"} & invite`}
                </button>
              </div>
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
