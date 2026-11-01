"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminShell from "../_components/AdminShell";
import HeatwaveLoader from "@/components/HeatwaveLoader";
import { DangerBar, Empty, PageHeader, Panel, PanelHead, Pill, Sheet, SheetActions, StatCard, StatGrid, Toast } from "../_components/ui";

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
  const [masks, setMasks] = useState<string[]>([]);
  const has = (item: string) => masks.includes(item);
  const [busy, setBusy] = useState<string | null>(null);
  // Invite blocked because the ticket is full: ask the admin to raise the limit first.
  const [noSeats, setNoSeats] = useState<{ entry: Entry; tier: TierSeats } | null>(null);
  const [newLimit, setNewLimit] = useState("");
  const [raising, setRaising] = useState(false);
  // Permanent delete of a waitlist record, behind a typed confirmation.
  const [toDelete, setToDelete] = useState<Entry | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
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
      setMasks(wd.masks ?? []);
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
    // Inviting also emails the customer; say so (or warn if that email failed).
    if (data?.emailed === true) showToast(`${msg} · email sent`);
    else if (data?.emailed === false) showToast(`${msg}, but the email couldn't be sent — contact them directly`);
    else showToast(msg);
    await load();
  }

  function askDelete(entry: Entry) {
    setToDelete(entry);
    setConfirmText("");
    setDeleteError("");
  }

  async function confirmDelete() {
    if (!toDelete || confirmText !== "DELETE") return;
    setDeleting(true);
    setDeleteError("");
    const res = await fetch("/api/admin/waitlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: toDelete.id }),
    });
    const data = await res.json().catch(() => null);
    setDeleting(false);
    if (!res.ok) {
      setDeleteError(data?.error ?? "Couldn't delete — try again");
      return;
    }
    showToast(`${toDelete.fullName} was permanently deleted from the waitlist`);
    setToDelete(null);
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
      <PageHeader eyebrow="WAITLIST" title="Waitlist">
        Customers who tried to register after a ticket filled up. When payments are declined or
        unsuccessful, seats free up — invite people from here, oldest first. An invited customer
        can register even if the ticket is full, and their seat is held until they do.
      </PageHeader>

      {!loading && !migrated && (
        <div className="mt-6 rounded-2xl bg-[#FFF6E5] px-5 py-4 text-sm text-[#8A5A00]">
          <span className="font-bold">One-time setup needed.</span> Run{" "}
          <span className="font-bold">supabase/seat-limits-waitlist.sql</span> in the Supabase SQL
          editor to turn on the waitlist.
        </div>
      )}

      <StatGrid>
        {[
          { l: "WAITING", v: counts.waiting, n: "in the queue" },
          { l: "INVITED", v: counts.invited, n: "seat held, not registered yet" },
          { l: "REGISTERED", v: counts.registered, n: "came off the waitlist" },
        ].map((k, i) => (
          <StatCard key={k.l} index={i} dark={i === 0} label={k.l} value={k.v} note={k.n} loading={loading} />
        ))}
        <div
          className="min-w-0 animate-[hwUp_0.5s_ease_both] rounded-2xl border border-[#EDE6E3] bg-[#FCFAF9] p-4 sm:p-5"
          style={{ animationDelay: "180ms" }}
        >
          <div className="text-[10px] font-bold tracking-[0.14em] text-[#6B6B6B] sm:text-[11px]">SEATS FREE NOW</div>
          <div className="mt-2.5 flex flex-col gap-1.5 text-[13px] sm:text-[14px]">
            {tiers.map((t) => (
              <div key={t.id} className="flex justify-between gap-2">
                <span className="truncate text-[#6B6B6B]">{t.name}</span>
                <span className="flex-none font-bold tabular-nums">
                  {t.remaining === null ? "No limit" : t.remaining}
                </span>
              </div>
            ))}
          </div>
        </div>
      </StatGrid>

      <Panel className="mt-3 sm:mt-5">
        <PanelHead title="Queue" sub={!loading && list.length > 0 ? "Oldest first" : undefined} />

        {loading && (
          <div className="border-t border-[#EDE6E3] px-6 py-16">
            <HeatwaveLoader label="Loading waitlist" />
          </div>
        )}

        {!loading && loadError && <Empty error title={loadError} />}

        {!loading &&
          !loadError &&
          list.map((e, i) => {
            const b = BADGE[e.status];
            const disabled = busy === e.id;
            return (
              <div
                key={e.id}
                className="flex flex-col gap-3.5 border-t border-[#EDE6E3] px-4 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3.5">
                  <span
                    className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl text-sm font-black tabular-nums ${
                      i === 0 && e.status === "waiting" ? "bg-[#E5251B] text-white" : "bg-[#F3EEEB] text-[#6B6B6B]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <span className="text-[15px] font-bold sm:text-[16px]">{e.fullName}</span>
                      <Pill tone={b.c}>{b.label}</Pill>
                    </div>
                    <div className="mt-1 text-[12.5px] leading-snug text-[#6B6B6B] sm:text-[13px]">
                      {has("contact") ? "Contact details hidden" : `${e.email} · ${e.mobile}`}
                      {!has("contact") && e.instagram ? ` · @${e.instagram.replace(/^@/, "")}` : ""}
                      {e.age ? ` · ${e.age}` : ""}
                      {e.gender ? ` · ${e.gender}` : ""}
                    </div>
                    <div className="mt-0.5 text-xs text-[#6B6B6B]">
                      {e.tierName ?? "Ticket"} · joined {when(e.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 lg:flex-none [&>button]:h-11 [&>button]:flex-1 lg:[&>button]:h-9 lg:[&>button]:flex-none">
                  {e.status === "waiting" && !has("invite") && (
                    <button
                      onClick={() => invite(e)}
                      disabled={disabled}
                      className="rounded-full bg-[#2F6B45] px-5 text-[13px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(47,107,69,.8)] transition active:scale-[.98] disabled:opacity-35"
                    >
                      Invite
                    </button>
                  )}
                  {e.status === "invited" && !has("invite") && (
                    <button
                      onClick={() => act(e, "PATCH", "waiting", "Moved back to waiting")}
                      disabled={disabled}
                      className="rounded-full border border-[#EDE6E3] bg-white px-5 text-[13px] font-bold disabled:opacity-35"
                    >
                      Undo invite
                    </button>
                  )}
                  {!has("delete") && (
                    <button
                      onClick={() => askDelete(e)}
                      disabled={disabled}
                      className="rounded-full border border-[#F3C9C5] bg-white px-5 text-[13px] font-bold text-[#B71C14] hover:bg-[#B71C14] hover:text-white disabled:opacity-35"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}

        {!loading && !loadError && list.length === 0 && (
          <Empty title="Nobody on the waitlist">People appear here when a ticket is full or closed.</Empty>
        )}
      </Panel>

      {toDelete && (
        <Sheet onClose={() => !deleting && setToDelete(null)} labelledBy="wl-del-title" alert>
          <DangerBar id="wl-del-title">Danger: permanent deletion</DangerBar>
          <div className="px-6 py-5">
            <p className="m-0 text-[15px] leading-relaxed">
              You are about to permanently delete{" "}
              <span className="font-bold">{toDelete.fullName}</span> ({toDelete.email}) from the
              waitlist. This <span className="font-bold text-[#B71C14]">cannot be undone</span>.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#6B6B6B]">
              <li>Their waitlist details and queue position are erased</li>
              {toDelete.status === "invited" && (
                <li>Their held seat is released — they can no longer register through their invite</li>
              )}
              {toDelete.status === "waiting" && (
                <li>
                  They will no longer see the waitlist card in My Tickets, and everyone behind
                  them moves up one place
                </li>
              )}
              {toDelete.status === "registered" && (
                <li>
                  Only this waitlist record is deleted — their registration and ticket are not
                  touched (delete those from Customers)
                </li>
              )}
            </ul>
            <label htmlFor="wl-del-confirm" className="mt-5 block text-sm font-bold">
              Type <span className="rounded bg-[#FDECEA] px-1.5 py-0.5 text-[#B71C14]">DELETE</span> to confirm
            </label>
            <input
              id="wl-del-confirm"
              value={confirmText}
              onChange={(ev) => setConfirmText(ev.target.value)}
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

      {noSeats && (
        <Sheet onClose={() => !raising && setNoSeats(null)} labelledBy="noseats-title" alert width={460}>
          <DangerBar id="noseats-title" color="#8A5A00">
            No seats free to invite
          </DangerBar>
          <div className="px-6 py-5">
            <p className="m-0 text-[15px] leading-relaxed">
              <span className="font-bold">{noSeats.tier.name}</span> is at its limit of{" "}
              <span className="font-bold">{noSeats.tier.limit}</span> seats: {noSeats.tier.accepted} accepted,{" "}
              {noSeats.tier.pending} pending verification
              {noSeats.tier.held > 0 ? `, ${noSeats.tier.held} held for invited customers` : ""}. Inviting{" "}
              <span className="font-bold">{noSeats.entry.fullName}</span> would go over the limit.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[#6B6B6B]">
              Increase the seat limit first, or decline an unverified payment to free a seat instead.
            </p>
            <div className="mt-4 text-[11px] font-bold tracking-[0.12em] text-[#6B6B6B]">NEW SEAT LIMIT</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {[1, 2, 5, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setNewLimit(String((noSeats.tier.limit ?? 0) + n))}
                  className="h-9 rounded-full border border-[#EDE6E3] px-3.5 text-[13px] font-bold text-[#6B6B6B] hover:border-[#141414] hover:text-[#141414]"
                >
                  +{n}
                </button>
              ))}
              <input
                value={newLimit}
                onChange={(ev) => setNewLimit(ev.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                className="ml-auto h-10 w-[96px] rounded-xl border border-[#EDE6E3] px-3.5 text-base font-bold outline-none focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)]"
              />
            </div>
            <SheetActions>
              <button
                onClick={() => setNoSeats(null)}
                disabled={raising}
                className="rounded-full border border-[#EDE6E3] px-5 text-sm font-bold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={raiseAndInvite}
                disabled={raising || !(Number(newLimit) > (noSeats.tier.limit ?? 0))}
                className="rounded-full bg-[#2F6B45] px-5 text-sm font-bold text-white disabled:opacity-35"
              >
                {raising ? "Saving…" : `Raise to ${newLimit || "…"} & invite`}
              </button>
            </SheetActions>
          </div>
        </Sheet>
      )}

      <Toast msg={toastMsg} />
    </AdminShell>
  );
}
