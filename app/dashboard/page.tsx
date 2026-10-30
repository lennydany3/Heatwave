"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createClient } from "@/utils/supabase/client";

type TicketStatus = "Confirmed" | "Cancelled" | "Checked-in" | "Verifying" | "Payment failed";
type TabId = "upcoming" | "past" | "cancelled";

type Ticket = {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  type: string;
  qty: number;
  price: number;
  bid: string;
  status: TicketStatus;
  note: string | null;
  upiTxnId: string | null;
  tab: TabId;
  startsAt: string | null;
};

type TicketRow = {
  id: string;
  ticket_code: string;
  status: "valid" | "checked_in" | "cancelled";
  created_at: string;
  registrations: {
    amount: number;
    status: "pending" | "paid" | "failed" | "cancelled";
    verification_note: string | null;
    upi_txn_id: string | null;
    ticket_tiers: { name: string } | null;
  } | null;
  events: { name: string; venue: string | null; starts_at: string | null } | null;
};

const BADGE: Record<TicketStatus, { bg: string; fg: string; dot: string }> = {
  Confirmed: { bg: "#EEF4EF", fg: "#2F6B45", dot: "#3F8A5A" },
  Cancelled: { bg: "#FDECEA", fg: "#B71C14", dot: "#E5251B" },
  "Checked-in": { bg: "#141414", fg: "#FFFFFF", dot: "#FFFFFF" },
  Verifying: { bg: "#FFF6E5", fg: "#8A5A00", dot: "#D99A1E" },
  "Payment failed": { bg: "#FDECEA", fg: "#B71C14", dot: "#E5251B" },
};

function PaymentNotice({ t, className = "" }: { t: Ticket; className?: string }) {
  if (t.status === "Verifying") {
    return (
      <div className={`rounded-xl bg-[#FFF6E5] px-4 py-3 text-sm leading-relaxed text-[#8A5A00] ${className}`}>
        <span className="font-bold">Payment verification pending.</span>{" "}
        {t.note || "We're checking your UPI payment. Your QR works at the entrance once it's verified."}
      </div>
    );
  }
  if (t.status === "Payment failed") {
    return (
      <div className={`rounded-xl bg-[#FDECEA] px-4 py-3 text-sm leading-relaxed text-[#B71C14] ${className}`}>
        <span className="font-bold">Payment couldn&apos;t be verified.</span>{" "}
        {t.note || "Please contact support with your UPI transaction ID."}
      </div>
    );
  }
  return null;
}

const fmt = (n: number) => (n ? "₹" + n.toLocaleString("en-IN") : "Free");

function relativeWhen(iso: string | null): string {
  if (!iso) return "";
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function PlaceholderThumb({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center bg-[#FAF7F5] text-[#B4ACA7] ${className}`}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
        <path
          d="M21 15l-5-5-11 11"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function Wave() {
  const path =
    "M0 40 " +
    Array.from({ length: 8 }, (_, i) =>
      i === 0 ? "Q100 10 200 40 " : `T${200 * (i + 1)} 40 `
    ).join("");
  return (
    <svg
      viewBox="0 0 1600 80"
      preserveAspectRatio="none"
      className="block h-full w-[200%] animate-[hwDrift_22s_linear_infinite]"
    >
      <path d={path} fill="none" stroke="#E5251B" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "there";
  const firstName = fullName.split(" ")[0];
  const initials =
    fullName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "U";

  async function handleLogout() {
    await signOut();
    router.push("/");
  }

  const [tab, setTab] = useState<TabId>("upcoming");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("tickets")
        .select(
          "id, ticket_code, status, created_at, registrations(amount, status, verification_note, upi_txn_id, ticket_tiers(name)), events(name, venue, starts_at)"
        )
        .order("created_at", { ascending: false })
        .returns<TicketRow[]>();

      if (cancelled) return;

      const mapped: Ticket[] = (data ?? []).map((row) => {
        const startsAt = row.events?.starts_at ?? null;
        const isPast = startsAt ? new Date(startsAt).getTime() < Date.now() : false;
        const payment = row.registrations?.status;
        const status: TicketStatus =
          row.status === "cancelled" || payment === "cancelled"
            ? "Cancelled"
            : row.status === "checked_in"
              ? "Checked-in"
              : payment === "failed"
                ? "Payment failed"
                : payment === "paid"
                  ? "Confirmed"
                  : "Verifying";
        return {
          id: row.id,
          title: row.events?.name ?? "Event",
          date: startsAt
            ? new Date(startsAt).toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "",
          time: startsAt
            ? new Date(startsAt).toLocaleTimeString("en-IN", {
                hour: "numeric",
                minute: "2-digit",
              })
            : "",
          venue: row.events?.venue ?? "",
          type: row.registrations?.ticket_tiers?.name ?? "Ticket",
          qty: 1,
          price: row.registrations?.amount ?? 0,
          bid: row.ticket_code,
          status,
          note: row.registrations?.verification_note ?? null,
          upiTxnId: row.registrations?.upi_txn_id ?? null,
          tab: status === "Cancelled" ? "cancelled" : isPast ? "past" : "upcoming",
          startsAt,
        };
      });

      setTickets(mapped);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function showToast(msg: string) {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2400);
  }

  function downloadIcs(t: Ticket) {
    const body = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${t.title}\nLOCATION:${t.venue}\nDESCRIPTION:Booking ${t.bid}\nEND:VEVENT\nEND:VCALENDAR`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
    a.download = t.bid + ".ics";
    a.click();
    showToast("Calendar file downloaded");
  }

  const inTab = useMemo(() => tickets.filter((t) => t.tab === tab), [tickets, tab]);
  const hl = tab === "upcoming" ? inTab[0] : undefined;
  const rest = hl ? inTab.slice(1) : inTab;
  const cur = open != null ? tickets.find((t) => t.id === open) ?? null : null;
  const counts = { upcoming: 0, past: 0, cancelled: 0 };
  tickets.forEach((t) => counts[t.tab]++);

  return (
    <div
      className="min-h-screen bg-white pb-[76px] text-[#141414] lg:pb-0"
      style={{ fontFamily: "var(--font-satoshi)" }}
    >
      <header className="sticky top-0 z-20 border-b border-[#EDE6E3] bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-6 py-4">
          <Link href="/" className="flex items-center gap-1.5 text-xl font-black tracking-[-0.04em]">
            heatwave
            <span className="h-[7px] w-[7px] rounded-full bg-[#E5251B]" />
          </Link>
          <nav className="hidden gap-1.5 text-sm font-bold lg:flex">
            <span className="rounded-full bg-[#FDECEA] px-4 py-2 text-[#E5251B]">My Tickets</span>
            <Link href="/" className="rounded-full px-4 py-2 text-[#6B6B6B] hover:text-[#141414]">
              Events
            </Link>
            <Link href="#" className="rounded-full px-4 py-2 text-[#6B6B6B] hover:text-[#141414]">
              Profile
            </Link>
          </nav>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2.5"
            >
              <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#141414] text-sm font-bold text-white">
                {initials}
              </span>
              <span className="hidden text-xs text-[#6B6B6B] lg:inline">▼</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 w-[220px] animate-[hwUp_0.2s_ease_both] rounded-xl border border-[#EDE6E3] bg-white p-2 shadow-[0_8px_24px_rgba(20,20,20,.06)]">
                <div className="mb-1.5 border-b border-[#EDE6E3] px-3 pb-3 pt-2.5">
                  <div className="text-[15px] font-bold">{fullName}</div>
                  <div className="text-[13px] text-[#6B6B6B]">{user?.email}</div>
                </div>
                <Link href="#" className="block rounded-lg px-3 py-2.5 text-sm hover:bg-[#FAF7F5]">
                  Profile settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-[#E5251B] hover:bg-[#FDECEA]"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-12 pb-24">
        <div className="flex animate-[hwUp_0.5s_ease_both] flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="m-0 text-[40px] font-black leading-[1] tracking-[-0.05em] sm:text-[64px]">
              Hi, {firstName}
            </h1>
            <p className="mt-2.5 text-[17px] text-[#6B6B6B]">
              {counts.upcoming === 0
                ? "Your tickets will show up here once you book."
                : `You have ${counts.upcoming} upcoming ${counts.upcoming === 1 ? "event" : "events"}.${
                    hl ? ` The next one is ${relativeWhen(hl.startsAt)}.` : ""
                  }`}
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex h-[46px] items-center rounded-full border border-[#141414] px-5.5 text-[15px] font-bold hover:bg-[#FAF7F5]"
          >
            Browse events
          </Link>
        </div>

        {loading && (
          <div className="mt-10 h-[280px] animate-[hwPulse_1.4s_ease_infinite] rounded-xl border border-[#EDE6E3] bg-[#FAF7F5]" />
        )}

        {!loading && hl && (
          <>
            <div className="mt-10 text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
              NEXT UP · {relativeWhen(hl.startsAt)}
            </div>
            <div className="mt-3.5 flex animate-[hwUp_0.5s_0.1s_ease_both] flex-col overflow-hidden rounded-xl border border-[#EDE6E3] bg-white lg:flex-row">
              <div className="flex min-w-0 flex-1">
                <div className="w-1.5 flex-none bg-[#E5251B]" />
                <div className="min-w-0 flex-1 p-6 sm:p-9">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{ background: BADGE[hl.status].bg, color: BADGE[hl.status].fg }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: BADGE[hl.status].dot }} />
                      {hl.status}
                    </span>
                    <span className="text-[13px] text-[#6B6B6B]">{hl.bid}</span>
                  </div>
                  <h2 className="m-0 mt-4 text-[32px] font-black leading-[1] tracking-[-0.045em] sm:text-[52px]">
                    {hl.title}
                  </h2>
                  <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
                    <div>
                      <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">DATE</div>
                      <div className="mt-1 text-base font-bold">{hl.date}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">TIME</div>
                      <div className="mt-1 text-base font-bold">{hl.time}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">VENUE</div>
                      <div className="mt-1 text-base font-bold">{hl.venue}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">TICKET</div>
                      <div className="mt-1 text-base font-bold">{hl.type}</div>
                    </div>
                  </div>
                  <PaymentNotice t={hl} className="mt-6" />
                  <div className="mt-8 flex flex-wrap gap-2.5">
                    <button
                      onClick={() => setOpen(hl.id)}
                      className="inline-flex h-12 items-center rounded-full bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right px-6.5 text-[15px] font-bold text-white transition-[background-position] duration-400 ease-out hover:bg-left"
                    >
                      View ticket
                    </button>
                    <button
                      onClick={() => downloadIcs(hl)}
                      className="inline-flex h-12 items-center rounded-full border border-[#EDE6E3] px-5.5 text-[15px] font-bold hover:bg-[#FAF7F5]"
                    >
                      Add to calendar
                    </button>
                    <button
                      onClick={() =>
                        window.open(
                          "https://maps.google.com/?q=" + encodeURIComponent(hl.venue),
                          "_blank"
                        )
                      }
                      className="inline-flex h-12 items-center rounded-full border border-[#EDE6E3] px-5.5 text-[15px] font-bold hover:bg-[#FAF7F5]"
                    >
                      Get directions
                    </button>
                  </div>
                </div>
              </div>
              <div className="relative flex flex-none flex-col items-center justify-center gap-3 border-t border-dashed border-[#E0D6D2] bg-[#FAF7F5] p-7 lg:w-[260px] lg:border-l lg:border-t-0">
                <span className="absolute -left-3 -top-3 h-[22px] w-[22px] rounded-full border border-[#EDE6E3] bg-white" />
                <span className="absolute -right-3 -top-3 h-[22px] w-[22px] rounded-full border border-[#EDE6E3] bg-white lg:-bottom-3 lg:-left-3 lg:right-auto lg:top-auto" />
                <div className="flex h-40 w-40 items-center justify-center rounded-lg border border-[#EDE6E3] bg-white p-3">
                  <QRCodeSVG value={hl.bid} size={136} />
                </div>
                <div className="text-center text-xs text-[#6B6B6B]">Scan at entry</div>
              </div>
            </div>
          </>
        )}

        <div className="mt-14 flex gap-7 border-b border-[#EDE6E3]">
          {(
            [
              ["upcoming", "Upcoming"],
              ["past", "Past"],
              ["cancelled", "Cancelled"],
            ] as [TabId, string][]
          ).map(([id, l]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                color: tab === id ? "#141414" : "#6B6B6B",
                borderColor: tab === id ? "#E5251B" : "transparent",
              }}
              className="-mb-px flex items-center gap-2 border-b-2 pb-3.5 text-base font-bold transition-colors duration-200"
            >
              {l}
              <span className="text-xs font-medium text-[#6B6B6B]">{counts[id]}</span>
            </button>
          ))}
        </div>

        {loading && (
          <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((k) => (
              <div
                key={k}
                className="animate-[hwPulse_1.4s_ease_infinite] overflow-hidden rounded-xl border border-[#EDE6E3]"
              >
                <div className="aspect-video bg-[#FAF7F5]" />
                <div className="flex flex-col gap-2.5 p-4.5">
                  <div className="h-3 w-2/5 rounded-full bg-[#F3EEEB]" />
                  <div className="h-4.5 w-4/5 rounded-full bg-[#F3EEEB]" />
                  <div className="h-3 w-3/5 rounded-full bg-[#F3EEEB]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && rest.length > 0 && (
          <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {rest.map((c) => (
              <div
                key={c.id}
                className="animate-[hwUp_0.5s_ease_both] overflow-hidden rounded-xl border border-[#EDE6E3] bg-white transition-transform duration-250 hover:-translate-y-1"
              >
                <div className="relative aspect-video">
                  <PlaceholderThumb className="h-full w-full" />
                  <span
                    className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
                    style={{ background: BADGE[c.status].bg, color: BADGE[c.status].fg }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: BADGE[c.status].dot }} />
                    {c.status}
                  </span>
                </div>
                <div className="p-5">
                  <div className="text-[13px] text-[#6B6B6B]">
                    {c.date} · {c.time}
                  </div>
                  <div className="mt-1.5 text-[19px] font-black tracking-[-0.02em]">{c.title}</div>
                  <div className="mt-1 text-sm text-[#6B6B6B]">{c.type}</div>
                  <div className="mt-4.5 flex items-center justify-between gap-3 border-t border-[#EDE6E3] pt-3.5">
                    <span className="text-xs tabular-nums text-[#6B6B6B]">{c.bid}</span>
                    <span className="flex gap-4">
                      <button
                        onClick={() => setOpen(c.id)}
                        className="text-sm font-bold text-[#E5251B] hover:text-[#B71C14]"
                      >
                        View
                      </button>
                      <button
                        onClick={() => downloadIcs(c)}
                        className="text-sm font-bold hover:text-[#E5251B]"
                      >
                        Download
                      </button>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && inTab.length === 0 && (
          <div className="mt-7 flex animate-[hwUp_0.5s_ease_both] flex-col items-center rounded-xl border border-[#EDE6E3] bg-[#FAF7F5] px-6 py-16 text-center">
            <div className="h-12 w-[220px] overflow-hidden">
              <Wave />
            </div>
            <div className="mt-5 text-[26px] font-black tracking-[-0.03em]">
              {tab === "upcoming" ? "No tickets yet" : tab === "past" ? "No past events" : "Nothing cancelled"}
            </div>
            <div className="mt-2 text-base text-[#6B6B6B]">
              {tab === "upcoming"
                ? "Find something worth going to this weekend."
                : "Events you attend or cancel will appear here."}
            </div>
            <Link
              href="/"
              className="mt-6 inline-flex h-12 items-center rounded-full bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right px-6.5 text-[15px] font-bold text-white transition-[background-position] duration-400 ease-out hover:bg-left"
            >
              Explore events
            </Link>
          </div>
        )}
      </main>

      {cur && (
        <div
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#141414]/36 p-0 lg:items-center lg:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-[820px] animate-[hwUp_0.3s_ease_both] overflow-auto rounded-t-2xl bg-white lg:max-h-[90vh] lg:rounded-xl"
          >
            <div className="flex items-center justify-between gap-4 border-b border-[#EDE6E3] px-6 py-5">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">TICKET</span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
                  style={{ background: BADGE[cur.status].bg, color: BADGE[cur.status].fg }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: BADGE[cur.status].dot }} />
                  {cur.status}
                </span>
              </div>
              <button
                onClick={() => setOpen(null)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#6B6B6B] hover:bg-[#FAF7F5] hover:text-[#141414]"
              >
                ×
              </button>
            </div>
            <div className="flex flex-wrap">
              <div className="flex flex-1 basis-[280px] flex-col items-center gap-4 border-r border-[#EDE6E3] bg-[#FAF7F5] p-7">
                <div className="flex aspect-square w-full max-w-[240px] items-center justify-center rounded-xl border border-[#EDE6E3] bg-white p-4">
                  <QRCodeSVG value={cur.bid} size={192} />
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">BOOKING ID</div>
                  <div className="mt-1 text-lg font-black tracking-[0.02em] tabular-nums">{cur.bid}</div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">ATTENDEE</div>
                  <div className="mt-1 text-base font-bold">{fullName}</div>
                </div>
              </div>
              <div className="flex flex-[1.4_1_320px] flex-col gap-5.5 p-7">
                <div>
                  <div className="text-[28px] font-black leading-[1.05] tracking-[-0.035em]">
                    {cur.title}
                  </div>
                  <div className="mt-2 text-[15px] leading-relaxed text-[#6B6B6B]">
                    {cur.date} · {cur.time}
                    <br />
                    {cur.venue}
                  </div>
                </div>
                <PaymentNotice t={cur} />
                <div className="flex flex-col gap-2.5 rounded-xl border border-[#EDE6E3] p-4.5 text-[15px]">
                  <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">PAYMENT</div>
                  <div className="flex justify-between">
                    <span>{cur.type}</span>
                    <span>{fmt(cur.price)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#EDE6E3] pt-2.5 font-black">
                    <span>Paid via UPI</span>
                    <span>{fmt(cur.price)}</span>
                  </div>
                  {cur.upiTxnId && (
                    <div className="text-[13px] tabular-nums text-[#6B6B6B]">
                      Transaction ID {cur.upiTxnId}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => downloadIcs(cur)}
                    className="inline-flex h-[46px] items-center rounded-full bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right px-5.5 text-sm font-bold text-white transition-[background-position] duration-400 ease-out hover:bg-left"
                  >
                    Add to calendar
                  </button>
                  <button
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText("https://heatwave.in/t/" + cur.bid);
                      }
                      showToast("Ticket link copied");
                    }}
                    className="inline-flex h-[46px] items-center rounded-full border border-[#EDE6E3] px-5 text-sm font-bold hover:bg-[#FAF7F5]"
                  >
                    Share
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-[92px] left-1/2 z-[60] flex -translate-x-1/2 animate-[hwUp_0.3s_ease_both] items-center gap-2.5 whitespace-nowrap rounded-full bg-[#141414] px-5 py-3 text-sm text-white lg:bottom-8">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6FBF8A]" />
          {toastMsg}
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-[#EDE6E3] bg-white px-2 pb-3.5 pt-2 lg:hidden">
        <Link href="#" className="flex flex-col items-center gap-1.5 p-1.5 text-xs font-bold text-[#E5251B]">
          <span className="h-4 w-[22px] rounded border-2 border-current" />
          Tickets
        </Link>
        <Link href="/" className="flex flex-col items-center gap-1.5 p-1.5 text-xs font-bold text-[#6B6B6B]">
          <span className="h-[18px] w-[18px] rounded-full border-2 border-current" />
          Events
        </Link>
        <Link href="#" className="flex flex-col items-center gap-1.5 p-1.5 text-xs font-bold text-[#6B6B6B]">
          <span className="h-[18px] w-[18px] rounded-t-full rounded-bl-full border-2 border-current" />
          Profile
        </Link>
      </nav>
    </div>
  );
}
