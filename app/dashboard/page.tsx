"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import SupportModal from "@/components/SupportModal";
import { EVENT } from "@/lib/event";
import { createClient } from "@/utils/supabase/client";

type TicketStatus = "Confirmed" | "Cancelled" | "Checked-in" | "Verifying" | "Payment failed";
type TabId = "upcoming" | "past" | "cancelled";

type WaitlistEntry = {
  id: string;
  status: "waiting" | "invited";
  position: number | null;
  eventName: string | null;
  venue: string | null;
  startsAt: string | null;
  tierName: string | null;
};

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
  /** True when the payment was unsuccessful (not declined), so the customer can register again. */
  canRetry?: boolean;
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
        <span className="font-bold">
          {t.canRetry ? "Payment wasn't successful." : "Registration couldn't be approved."}
        </span>{" "}
        {t.note ||
          (t.canRetry
            ? "We couldn't find your payment. You can register again with a fresh payment."
            : "Please contact support with your UPI transaction ID.")}
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

// The QR area of a ticket, by state: only a verified ticket shows a scannable QR.
// A ticket still being verified shows it locked; a failed one shows no QR at all.
function TicketStub({ t, size }: { t: Ticket; size: number }) {
  const box = size + 24;
  // Small stubs (inside the ticket card) drop the captions and keep just the icon.
  const small = size < 120;
  if (t.status === "Payment failed") {
    return (
      <div
        style={{ width: box, height: box }}
        className="flex flex-none flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#F3C9C5] bg-[#FFF8F7] p-3 text-center"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FDECEA]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="#B71C14" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </span>
        {!small && (
          <>
            <span className="text-sm font-black text-[#B71C14]">Ticket not valid</span>
            <span className="text-[11px] leading-snug text-[#9A6A66]">No QR is issued for a failed payment</span>
          </>
        )}
      </div>
    );
  }
  const locked = t.status === "Verifying";
  return (
    <div
      style={{ width: box, height: box }}
      className="relative flex flex-none items-center justify-center rounded-xl border border-[#EDE6E3] bg-white p-3"
    >
      <div style={locked ? { filter: "blur(5px)", opacity: 0.45 } : undefined}>
        <QRCodeSVG value={t.bid} size={size} />
      </div>
      {locked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF6E5]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="5" y="11" width="14" height="9" rx="2" stroke="#8A5A00" strokeWidth="2" />
              <path d="M8 11V8a4 4 0 018 0v3" stroke="#8A5A00" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          {!small && <span className="text-xs font-black text-[#8A5A00]">Activates once verified</span>}
        </div>
      )}
      {t.status === "Checked-in" && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/80 text-center text-sm font-black text-[#141414]">
          {small ? "Used" : "Already used"}
        </div>
      )}
    </div>
  );
}

const STUB_NOTE: Record<TicketStatus, (t: Ticket) => string> = {
  Confirmed: () => "Show this QR at the gate.",
  Verifying: () => "Your QR activates once we verify your UPI payment.",
  "Payment failed": (t) =>
    t.canRetry ? "We couldn't find your payment." : "This registration couldn't be approved.",
  "Checked-in": () => "You're checked in. Enjoy the night!",
  Cancelled: () => "This ticket was cancelled.",
};

const primaryBtn =
  "inline-flex items-center justify-center rounded-full font-bold text-white transition-[background-position] duration-400 ease-out bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right hover:bg-left";

const glassBtn =
  "inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-3 font-bold text-white backdrop-blur-md transition-colors hover:bg-white hover:text-[#141414]";

// Cuts half-circle notches into the edges of each ticket half, so whatever is
// behind the ticket shows through them.
function notch(edge: "top" | "bottom"): React.CSSProperties {
  const y = edge === "top" ? "0" : "100%";
  const mask =
    `radial-gradient(circle at 0 ${y}, transparent 11px, #000 11.5px) left / 51% 100% no-repeat, ` +
    `radial-gradient(circle at 100% ${y}, transparent 11px, #000 11.5px) right / 51% 100% no-repeat`;
  return { WebkitMask: mask, mask };
}

function StatusBadge({ status, small = false }: { status: TicketStatus; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold ${
        small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-[11px]"
      }`}
      style={{ background: BADGE[status].bg, color: BADGE[status].fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: BADGE[status].dot }} />
      {status}
    </span>
  );
}

function PinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-none text-[#E5251B]">
      <path
        d="M12 21s-7-6.2-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.8 12 21 12 21z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-none">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
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
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [supportFor, setSupportFor] = useState<string | null>(null);
  // The admin's outcome per ticket code, to tell "try again" from "contact support".
  const [retryable, setRetryable] = useState<Record<string, boolean>>({});
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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/waitlist/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.entries) setWaitlist(d.entries);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/registrations/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.registrations) return;
        setRetryable(
          Object.fromEntries(
            (d.registrations as { ticketCode: string | null; canRetry: boolean }[])
              .filter((r) => r.ticketCode)
              .map((r) => [r.ticketCode as string, r.canRetry])
          )
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

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

  const view = useMemo(
    () => tickets.map((t) => ({ ...t, canRetry: !!retryable[t.bid] })),
    [tickets, retryable]
  );
  const inTab = useMemo(() => view.filter((t) => t.tab === tab), [view, tab]);
  const hl = tab === "upcoming" ? inTab[0] : undefined;
  const rest = hl ? inTab.slice(1) : inTab;
  const cur = open != null ? view.find((t) => t.id === open) ?? null : null;
  const counts = { upcoming: 0, past: 0, cancelled: 0 };
  view.forEach((t) => counts[t.tab]++);

  const posterFor = (title: string) =>
    title.trim().toLowerCase() === EVENT.name.toLowerCase() ? EVENT.poster : null;
  const hlPoster = hl ? posterFor(hl.title) : null;

  return (
    <div
      className="min-h-screen bg-[#FAF7F5] pb-[calc(72px+env(safe-area-inset-bottom))] text-[#141414] lg:pb-0"
      style={{ fontFamily: "var(--font-satoshi)" }}
    >
      <header className="sticky top-0 z-30 border-b border-[#EDE6E3] bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-5 py-3 sm:px-6 sm:py-4">
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
              aria-label="Account menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2.5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#141414] text-sm font-bold text-white">
                {initials}
              </span>
              <span className="hidden text-xs text-[#6B6B6B] lg:inline">▼</span>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-[-1]" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-12 w-[240px] animate-[hwUp_0.2s_ease_both] rounded-xl border border-[#EDE6E3] bg-white p-2 shadow-[0_12px_32px_rgba(20,20,20,.12)]">
                  <div className="mb-1.5 border-b border-[#EDE6E3] px-3 pb-3 pt-2.5">
                    <div className="truncate text-[15px] font-bold">{fullName}</div>
                    <div className="truncate text-[13px] text-[#6B6B6B]">{user?.email}</div>
                  </div>
                  <Link href="#" className="block rounded-lg px-3 py-3 text-sm hover:bg-[#FAF7F5]">
                    Profile settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full rounded-lg px-3 py-3 text-left text-sm text-[#E5251B] hover:bg-[#FDECEA]"
                  >
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero: poster backdrop with the next ticket */}
      <section className="relative isolate overflow-hidden bg-[#120C0B]">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <Image
            src={hlPoster ?? EVENT.poster}
            alt=""
            fill
            priority
            sizes="100vw"
            className="scale-125 object-cover opacity-70 blur-2xl"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,12,11,0.6)_0%,rgba(18,12,11,0.78)_60%,rgba(18,12,11,0.94)_100%)]" />
          <div className="absolute left-1/2 top-[-140px] h-[340px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(229,37,27,0.32),transparent)]" />
        </div>

        <div className="mx-auto max-w-[1200px] px-5 pb-8 pt-7 sm:px-6 sm:pb-12 sm:pt-12">
          <div className="flex animate-[hwUp_0.5s_ease_both] flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="m-0 text-[36px] font-black leading-[1] tracking-[-0.05em] text-white sm:text-[56px]">
                Hi, {firstName}
              </h1>
              <p className="mt-2 text-[14px] text-white/65 sm:text-base">
                {loading
                  ? "Loading your tickets…"
                  : counts.upcoming === 0
                    ? "Your tickets will show up here once you book."
                    : `${counts.upcoming} upcoming ${counts.upcoming === 1 ? "event" : "events"}${
                        hl ? ` · next ${relativeWhen(hl.startsAt)}` : ""
                      }`}
              </p>
            </div>
            <Link
              href="/"
              className="hidden h-11 items-center rounded-full border border-white/30 bg-white/10 px-5 text-sm font-bold text-white backdrop-blur-md transition-colors hover:bg-white hover:text-[#141414] sm:inline-flex"
            >
              Browse events
            </Link>
          </div>

          {loading && (
            <div className="mx-auto mt-6 h-[420px] max-w-[440px] animate-[hwPulse_1.4s_ease_infinite] rounded-[22px] bg-white/10 lg:mx-0" />
          )}

          {!loading && hl && (
            <div className="mx-auto mt-6 max-w-[440px] lg:mx-0">
              <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-white/60">
                <span className="h-1.5 w-1.5 animate-[hwPulse_1.4s_ease_infinite] rounded-full bg-[#E5251B]" />
                NEXT UP · {relativeWhen(hl.startsAt).toUpperCase()}
              </div>

              {/* Ticket */}
              <div className="mt-3 animate-[hwUp_0.6s_0.1s_ease_both] drop-shadow-[0_24px_36px_rgba(0,0,0,0.5)]">
                <div className="overflow-hidden rounded-t-[22px] bg-white" style={notch("bottom")}>
                  <div className="relative h-[160px] overflow-hidden bg-[#1E1716] sm:h-[180px]">
                    {hlPoster ? (
                      <Image
                        src={hlPoster}
                        alt={hl.title}
                        fill
                        priority
                        sizes="440px"
                        className="object-cover object-[center_40%]"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(229,37,27,0.45),transparent_60%)]" />
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,20,20,0.45)_0%,rgba(20,20,20,0)_30%,rgba(20,20,20,0.1)_55%,rgba(20,20,20,0.9)_100%)]" />
                    <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
                      <span className="rounded-full bg-black/35 px-2.5 py-1 font-mono text-[11px] font-bold text-white backdrop-blur-md">
                        {hl.bid}
                      </span>
                      <StatusBadge status={hl.status} />
                    </div>
                    <div className="absolute inset-x-4 bottom-3.5">
                      <div className="truncate text-[32px] font-black leading-[0.95] tracking-[-0.05em] text-white">
                        {hl.title}
                      </div>
                      {hlPoster && (
                        <div className="mt-1 text-[13px] font-bold text-[#FF6A5F]">{EVENT.presenter}</div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pb-5 pt-4 sm:px-5">
                    {[
                      { label: "DATE", value: hl.date },
                      { label: "TIME", value: hl.time },
                      { label: "TICKET", value: hl.type },
                      { label: "PRICE", value: fmt(hl.price) },
                    ].map((d) => (
                      <div key={d.label} className="min-w-0">
                        <div className="text-[10px] font-bold tracking-[0.14em] text-[#9A918D]">{d.label}</div>
                        <div className="mt-0.5 truncate text-[14px] font-bold leading-snug">{d.value}</div>
                      </div>
                    ))}
                    {hl.venue && (
                      <a
                        href={"https://maps.google.com/?q=" + encodeURIComponent(hl.venue)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="col-span-2 flex items-center justify-between gap-3 rounded-xl bg-[#FAF7F5] px-3 py-2.5"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <PinIcon />
                          <span className="truncate text-[13px] font-bold">{hl.venue}</span>
                        </span>
                        <span className="flex-none text-[12px] font-bold text-[#E5251B]">Directions →</span>
                      </a>
                    )}
                    {hl.status === "Payment failed" && <PaymentNotice t={hl} className="col-span-2 !py-2.5 !text-[13px]" />}
                  </div>
                </div>

                <div className="rounded-b-[22px] bg-white" style={notch("top")}>
                  <div className="mx-5 border-t-2 border-dashed border-[#EDE6E3]" />
                  <button
                    type="button"
                    onClick={() => setOpen(hl.id)}
                    className="flex w-full items-center gap-4 px-4 pb-4 pt-4 text-left sm:px-5"
                  >
                    <TicketStub t={hl} size={80} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-bold tracking-[0.14em] text-[#9A918D]">
                        {hl.status === "Confirmed" ? "READY TO SCAN" : "TICKET STATUS"}
                      </span>
                      <span className="mt-1 block text-[13px] font-bold leading-snug">
                        {STUB_NOTE[hl.status](hl)}
                      </span>
                      <span className="mt-1.5 block text-[12px] font-bold text-[#E5251B]">
                        {hl.status === "Payment failed" ? "View details →" : "Tap to open ticket →"}
                      </span>
                    </span>
                  </button>
                </div>
              </div>

              <div className="mt-4 grid animate-[hwUp_0.6s_0.2s_ease_both] grid-cols-2 gap-3">
                {hl.status === "Payment failed" ? (
                  <>
                    <button onClick={() => setOpen(hl.id)} className={`${primaryBtn} h-12 text-sm`}>
                      View details
                    </button>
                    {hl.canRetry ? (
                      <Link href="/events/registations" className={`${glassBtn} h-12 text-sm`}>
                        Register again
                      </Link>
                    ) : (
                      <button onClick={() => setSupportFor(hl.bid)} className={`${glassBtn} h-12 text-sm`}>
                        Contact support
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={() => setOpen(hl.id)} className={`${primaryBtn} h-12 text-sm`}>
                      View ticket
                    </button>
                    <button onClick={() => downloadIcs(hl)} className={`${glassBtn} h-12 gap-2 text-sm`}>
                      <CalendarIcon />
                      Add to calendar
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {!loading && !hl && (
            <Link
              href="/"
              className="mt-6 inline-flex h-11 items-center rounded-full border border-white/30 bg-white/10 px-5 text-sm font-bold text-white backdrop-blur-md sm:hidden"
            >
              Browse events
            </Link>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-[1200px] px-5 pb-16 pt-6 sm:px-6 sm:pt-10">
        {waitlist.map((w) => {
          const invited = w.status === "invited";
          return (
            <div
              key={w.id}
              className="mb-6 flex animate-[hwUp_0.5s_0.05s_ease_both] overflow-hidden rounded-2xl border border-[#EDE6E3] bg-white"
            >
              <div className="w-1.5 flex-none" style={{ background: invited ? "#3F8A5A" : "#D99A1E" }} />
              <div className="min-w-0 flex-1 p-5 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{
                        background: invited ? "#EEF4EF" : "#FFF6E5",
                        color: invited ? "#2F6B45" : "#8A5A00",
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: invited ? "#3F8A5A" : "#D99A1E" }}
                      />
                      {invited ? "Seat held for you" : "On the waitlist"}
                    </span>
                    <div className="mt-2.5 truncate text-[22px] font-black leading-[1.1] tracking-[-0.03em] sm:text-[26px]">
                      {w.eventName ?? "Event"}
                    </div>
                    <div className="mt-0.5 truncate text-[13px] text-[#6B6B6B] sm:text-sm">
                      {w.tierName ?? "Ticket"}
                      {w.venue ? ` · ${w.venue}` : ""}
                    </div>
                  </div>
                  {!invited && w.position && (
                    <div className="flex-none text-right">
                      <div className="text-[10px] font-bold tracking-[0.14em] text-[#9A918D]">PLACE</div>
                      <div className="text-[34px] font-black leading-none tracking-[-0.04em] tabular-nums">
                        #{w.position}
                      </div>
                    </div>
                  )}
                </div>
                <p className="mt-3 max-w-[60ch] text-[14px] leading-relaxed text-[#6B6B6B] sm:text-[15px]">
                  {invited
                    ? "A seat opened up and it's being held for you. Complete your registration and payment to lock it in."
                    : "Hang tight — when a seat frees up we'll invite you in order, and it'll show up right here."}
                </p>
                {invited && (
                  <Link href="/events/registations" className={`${primaryBtn} mt-4 h-12 w-full px-6 text-sm sm:w-auto`}>
                    Complete registration →
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        <div className="grid grid-cols-3 gap-1 rounded-full bg-[#EFE8E5] p-1 sm:inline-grid sm:min-w-[420px]">
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
              className={`flex h-10 items-center justify-center gap-1.5 rounded-full text-[13px] font-bold transition-all duration-200 sm:text-sm ${
                tab === id ? "bg-white text-[#141414] shadow-[0_2px_8px_rgba(20,20,20,0.08)]" : "text-[#6B6B6B]"
              }`}
            >
              {l}
              <span
                className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                  tab === id ? "bg-[#FDECEA] text-[#E5251B]" : "text-[#9A918D]"
                }`}
              >
                {counts[id]}
              </span>
            </button>
          ))}
        </div>

        {loading && (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2].map((k) => (
              <div
                key={k}
                className="flex animate-[hwPulse_1.4s_ease_infinite] gap-3.5 rounded-2xl border border-[#EDE6E3] bg-white p-3"
              >
                <div className="aspect-[4/5] w-[72px] rounded-xl bg-[#F3EEEB]" />
                <div className="flex flex-1 flex-col justify-center gap-2.5">
                  <div className="h-3 w-2/5 rounded-full bg-[#F3EEEB]" />
                  <div className="h-4 w-4/5 rounded-full bg-[#F3EEEB]" />
                  <div className="h-3 w-3/5 rounded-full bg-[#F3EEEB]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && rest.length > 0 && (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rest.map((c) => {
              const poster = posterFor(c.title);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setOpen(c.id)}
                  className="flex animate-[hwUp_0.5s_ease_both] items-center gap-3.5 rounded-2xl border border-[#EDE6E3] bg-white p-3 text-left transition-transform duration-200 active:scale-[0.99] sm:hover:-translate-y-0.5"
                >
                  <div className="relative aspect-[4/5] w-[72px] flex-none overflow-hidden rounded-xl">
                    {poster ? (
                      <Image
                        src={poster}
                        alt=""
                        fill
                        sizes="72px"
                        className={`object-cover ${c.status === "Cancelled" ? "grayscale" : ""}`}
                      />
                    ) : (
                      <PlaceholderThumb className="h-full w-full" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <StatusBadge status={c.status} small />
                    <div className="mt-1.5 truncate text-[17px] font-black tracking-[-0.02em]">{c.title}</div>
                    <div className="mt-0.5 truncate text-[13px] text-[#6B6B6B]">
                      {c.date} · {c.time}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[11px] text-[#9A918D]">
                      {c.type} · {c.bid}
                    </div>
                  </div>
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#FAF7F5] text-[#E5251B]">
                    →
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {!loading && inTab.length === 0 && (
          <div className="mt-5 flex animate-[hwUp_0.5s_ease_both] flex-col items-center rounded-2xl border border-[#EDE6E3] bg-white px-6 py-12 text-center">
            <div className="h-10 w-[200px] overflow-hidden">
              <Wave />
            </div>
            <div className="mt-4 text-[22px] font-black tracking-[-0.03em]">
              {tab === "upcoming" ? "No tickets yet" : tab === "past" ? "No past events" : "Nothing cancelled"}
            </div>
            <div className="mt-1.5 text-[15px] text-[#6B6B6B]">
              {tab === "upcoming"
                ? "Find something worth going to this weekend."
                : "Events you attend or cancel will appear here."}
            </div>
            {tab === "upcoming" && (
              <Link href="/" className={`${primaryBtn} mt-5 h-12 px-6 text-sm`}>
                Explore events
              </Link>
            )}
          </div>
        )}

        {!loading && tab === "upcoming" && hl && rest.length === 0 && (
          <p className="mt-5 text-center text-[13px] text-[#9A918D]">
            That&apos;s all your upcoming tickets.
          </p>
        )}
      </main>

      {cur && (
        <div
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#141414]/50 p-0 backdrop-blur-[2px] lg:items-center lg:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className="max-h-[92dvh] w-full max-w-[820px] animate-[hwUp_0.3s_ease_both] overflow-y-auto overscroll-contain rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] lg:max-h-[90vh] lg:rounded-2xl lg:pb-0"
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-[#EDE6E3] lg:hidden" />
            <div className="flex items-center justify-between gap-4 border-b border-[#EDE6E3] px-5 py-3.5 lg:px-6 lg:py-5">
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">TICKET</span>
                <StatusBadge status={cur.status} />
              </div>
              <button
                onClick={() => setOpen(null)}
                aria-label="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-[#6B6B6B] hover:bg-[#FAF7F5] hover:text-[#141414]"
              >
                ×
              </button>
            </div>
            <div className="grid lg:grid-cols-[1fr_1.4fr]">
              <div className="flex flex-col items-center gap-4 border-b border-[#EDE6E3] bg-[#FAF7F5] px-5 py-6 lg:border-b-0 lg:border-r lg:p-7">
                <TicketStub t={cur} size={196} />
                <div className="grid w-full max-w-[300px] grid-cols-2 gap-3 text-center">
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.14em] text-[#9A918D]">BOOKING ID</div>
                    <div className="mt-0.5 font-mono text-[15px] font-bold tabular-nums">{cur.bid}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold tracking-[0.14em] text-[#9A918D]">ATTENDEE</div>
                    <div className="mt-0.5 truncate text-[15px] font-bold">{fullName}</div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-4 px-5 py-5 lg:gap-5 lg:p-7">
                <div>
                  <div className="text-[26px] font-black leading-[1.05] tracking-[-0.035em] lg:text-[28px]">
                    {cur.title}
                  </div>
                  <div className="mt-1.5 text-[14px] leading-relaxed text-[#6B6B6B] lg:text-[15px]">
                    {cur.date} · {cur.time}
                    <br />
                    {cur.venue}
                  </div>
                </div>
                <PaymentNotice t={cur} />
                <div className="flex flex-col gap-2 rounded-xl border border-[#EDE6E3] p-4 text-[14px] lg:text-[15px]">
                  <div className="text-[10px] font-bold tracking-[0.14em] text-[#9A918D]">PAYMENT</div>
                  <div className="flex justify-between">
                    <span>{cur.type}</span>
                    <span className="tabular-nums">{fmt(cur.price)}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#EDE6E3] pt-2 font-black">
                    <span>Paid via UPI</span>
                    <span className="tabular-nums">{fmt(cur.price)}</span>
                  </div>
                  {cur.upiTxnId && (
                    <div className="text-[12px] tabular-nums text-[#6B6B6B]">Transaction ID {cur.upiTxnId}</div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button onClick={() => downloadIcs(cur)} className={`${primaryBtn} h-12 gap-2 text-sm`}>
                    <CalendarIcon />
                    Add to calendar
                  </button>
                  <button
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText("https://heatwave.in/t/" + cur.bid);
                      }
                      showToast("Ticket link copied");
                    }}
                    className="inline-flex h-12 items-center justify-center rounded-full border border-[#EDE6E3] px-5 text-sm font-bold hover:bg-[#FAF7F5]"
                  >
                    Share
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <SupportModal open={supportFor !== null} onClose={() => setSupportFor(null)} bookingId={supportFor} />

      {toastMsg && (
        <div className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] left-1/2 z-[60] flex -translate-x-1/2 animate-[hwUp_0.3s_ease_both] items-center gap-2.5 whitespace-nowrap rounded-full bg-[#141414] px-5 py-3 text-sm text-white lg:bottom-8">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6FBF8A]" />
          {toastMsg}
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-[#EDE6E3] bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md lg:hidden">
        <Link href="/dashboard" className="flex flex-col items-center gap-1 py-1.5 text-[11px] font-bold text-[#E5251B]">
          <span className="flex h-7 w-12 items-center justify-center rounded-full bg-[#FDECEA]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 7a2 2 0 012-2h12a2 2 0 012 2v2a2.5 2.5 0 000 5v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2.5 2.5 0 000-5V7z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path d="M14 5v13" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2.5" />
            </svg>
          </span>
          Tickets
        </Link>
        <Link href="/" className="flex flex-col items-center gap-1 py-1.5 text-[11px] font-bold text-[#6B6B6B]">
          <span className="flex h-7 w-12 items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </span>
          Events
        </Link>
        <Link href="#" className="flex flex-col items-center gap-1 py-1.5 text-[11px] font-bold text-[#6B6B6B]">
          <span className="flex h-7 w-12 items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8.5" r="3.8" stroke="currentColor" strokeWidth="2" />
              <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          Profile
        </Link>
      </nav>
    </div>
  );
}
