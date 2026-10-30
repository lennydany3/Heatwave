"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type TicketStatus = "Confirmed" | "Pending" | "Cancelled" | "Checked-in";
type TabId = "upcoming" | "past" | "cancelled";

type Ticket = {
  id: number;
  title: string;
  date: string;
  time: string;
  venue: string;
  area: string;
  type: string;
  qty: number;
  price: number;
  bid: string;
  status: TicketStatus;
  tab: TabId;
  when?: string;
};

const TICKETS: Ticket[] = [
  { id: 1, title: "Bay Beats Festival", date: "Sat, 6 Mar 2027", time: "4:00 PM", venue: "Chennai Trade Centre", area: "Nandambakkam, Chennai", type: "GA Pass", qty: 2, price: 1799, bid: "HW-27-5103", status: "Confirmed", tab: "upcoming", when: "in 12 days" },
  { id: 2, title: "Chennai Product Summit", date: "Fri, 19 Mar 2027", time: "9:30 AM", venue: "IIT Madras Research Park", area: "Taramani, Chennai", type: "Regular", qty: 1, price: 1499, bid: "HW-27-5288", status: "Confirmed", tab: "upcoming" },
  { id: 3, title: "Carnatic Fusion Night", date: "Sun, 28 Mar 2027", time: "7:00 PM", venue: "The Music Academy", area: "Royapettah, Chennai", type: "Balcony", qty: 2, price: 600, bid: "HW-27-5412", status: "Pending", tab: "upcoming" },
  { id: 4, title: "Marina Sunrise 10K", date: "Sun, 11 Apr 2027", time: "5:30 AM", venue: "Marina Beach, Lighthouse", area: "Mylapore, Chennai", type: "Runner", qty: 1, price: 899, bid: "HW-27-5530", status: "Confirmed", tab: "upcoming" },
  { id: 5, title: "Coffee & Code Meetup", date: "Sat, 12 Dec 2026", time: "10:00 AM", venue: "Express Avenue", area: "Royapettah, Chennai", type: "Free", qty: 1, price: 0, bid: "HW-26-4471", status: "Checked-in", tab: "past" },
  { id: 6, title: "Margazhi Dance Evening", date: "Sun, 20 Dec 2026", time: "6:30 PM", venue: "Kalakshetra Foundation", area: "Thiruvanmiyur, Chennai", type: "Front rows", qty: 2, price: 750, bid: "HW-26-4519", status: "Checked-in", tab: "past" },
  { id: 7, title: "Design Leadership Breakfast", date: "Thu, 14 Jan 2027", time: "8:00 AM", venue: "Taj Coromandel", area: "Nungambakkam, Chennai", type: "Invite", qty: 1, price: 0, bid: "HW-27-4802", status: "Checked-in", tab: "past" },
  { id: 8, title: "Stand-up Sunday", date: "Sun, 7 Feb 2027", time: "8:00 PM", venue: "Phoenix Marketcity", area: "Velachery, Chennai", type: "Regular", qty: 2, price: 499, bid: "HW-27-4990", status: "Cancelled", tab: "cancelled" },
];

const BADGE: Record<TicketStatus, { bg: string; fg: string; dot: string }> = {
  Confirmed: { bg: "#EEF4EF", fg: "#2F6B45", dot: "#3F8A5A" },
  Pending: { bg: "#FAF7F5", fg: "#6B6B6B", dot: "#B5ADA9" },
  Cancelled: { bg: "#FDECEA", fg: "#B71C14", dot: "#E5251B" },
  "Checked-in": { bg: "#141414", fg: "#FFFFFF", dot: "#FFFFFF" },
};

const fmt = (n: number) => (n ? "₹" + n.toLocaleString("en-IN") : "Free");

function qrPath(seed: number): string {
  const N = 29;
  let s = seed * 7919 + 13;
  let d = "";
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const ox = x < 8 ? 0 : x >= N - 8 ? N - 7 : null;
      const oy = y < 8 ? 0 : y >= N - 8 ? N - 7 : null;
      let dark: boolean;
      if (ox !== null && oy !== null && !(ox && oy)) {
        const fx = x - ox;
        const fy = y - oy;
        dark =
          fx >= 0 &&
          fy >= 0 &&
          fx < 7 &&
          fy < 7 &&
          (fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx > 1 && fx < 5 && fy > 1 && fy < 5));
      } else {
        dark = r() < 0.47;
      }
      if (dark) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return d;
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
  const [tab, setTab] = useState<TabId>("upcoming");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [cancelled, setCancelled] = useState<Record<number, boolean>>({});
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  function showToast(msg: string) {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2400);
  }

  function downloadIcs(t: Ticket) {
    const body = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${t.title}\nLOCATION:${t.venue}, ${t.area}\nDESCRIPTION:Booking ${t.bid}\nEND:VEVENT\nEND:VCALENDAR`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
    a.download = t.bid + ".ics";
    a.click();
    showToast("Calendar file downloaded");
  }

  function deco(t: Ticket) {
    const status: TicketStatus = cancelled[t.id] ? "Cancelled" : t.status;
    const b = BADGE[status];
    return {
      ...t,
      status,
      badge: b,
      qtyL: t.qty + (t.qty > 1 ? " tickets" : " ticket"),
      total: fmt(t.price * t.qty),
      fee: t.price ? "₹49" : "₹0",
      grand: t.price ? fmt(t.price * t.qty + 49) : "Free",
      canCancel: status === "Confirmed" || status === "Pending",
    };
  }

  const list = useMemo(
    () =>
      TICKETS.map(deco).map((t) => ({ ...t, tabNow: t.status === "Cancelled" ? "cancelled" : t.tab })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cancelled]
  );
  const inTab = list.filter((t) => t.tabNow === tab);
  const hl = tab === "upcoming" ? inTab[0] : undefined;
  const rest = hl ? inTab.slice(1) : inTab;
  const cur = open != null ? deco(TICKETS.find((t) => t.id === open)!) : null;
  const counts = { upcoming: 0, past: 0, cancelled: 0 };
  list.forEach((t) => counts[t.tabNow as TabId]++);

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
                PR
              </span>
              <span className="hidden text-xs text-[#6B6B6B] lg:inline">▼</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 w-[220px] animate-[hwUp_0.2s_ease_both] rounded-xl border border-[#EDE6E3] bg-white p-2 shadow-[0_8px_24px_rgba(20,20,20,.06)]">
                <div className="mb-1.5 border-b border-[#EDE6E3] px-3 pb-3 pt-2.5">
                  <div className="text-[15px] font-bold">Priya Raghavan</div>
                  <div className="text-[13px] text-[#6B6B6B]">priya.r@example.com</div>
                </div>
                <Link href="#" className="block rounded-lg px-3 py-2.5 text-sm hover:bg-[#FAF7F5]">
                  Profile settings
                </Link>
                <Link
                  href="/login"
                  className="block rounded-lg px-3 py-2.5 text-sm text-[#E5251B] hover:bg-[#FDECEA]"
                >
                  Log out
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-12 pb-24">
        <div className="flex animate-[hwUp_0.5s_ease_both] flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="m-0 text-[40px] font-black leading-[1] tracking-[-0.05em] sm:text-[64px]">
              Hi, Priya
            </h1>
            <p className="mt-2.5 text-[17px] text-[#6B6B6B]">
              {counts.upcoming === 0
                ? "Your tickets will show up here once you book."
                : `You have ${counts.upcoming} upcoming ${counts.upcoming === 1 ? "event" : "events"}. The next one is ${TICKETS[0].when}.`}
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
              NEXT UP · {hl.when}
            </div>
            <div className="mt-3.5 flex animate-[hwUp_0.5s_0.1s_ease_both] flex-col overflow-hidden rounded-xl border border-[#EDE6E3] bg-white lg:flex-row">
              <div className="flex min-w-0 flex-1">
                <div className="w-1.5 flex-none bg-[#E5251B]" />
                <div className="min-w-0 flex-1 p-6 sm:p-9">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{ background: hl.badge.bg, color: hl.badge.fg }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: hl.badge.dot }} />
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
                      <div className="mt-1 text-base font-bold">
                        {hl.type} · {hl.qtyL}
                      </div>
                    </div>
                  </div>
                  <div className="mt-8 flex flex-wrap gap-2.5">
                    <button
                      onClick={() => {
                        setOpen(hl.id);
                        setConfirm(false);
                      }}
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
                          "https://maps.google.com/?q=" + encodeURIComponent(hl.venue + " Chennai"),
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
                <div className="h-40 w-40 rounded-lg border border-[#EDE6E3] bg-white p-3">
                  <svg viewBox="0 0 29 29" shapeRendering="crispEdges" className="block h-full w-full">
                    <path d={qrPath(hl.id)} fill="#141414" />
                  </svg>
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
                    style={{ background: c.badge.bg, color: c.badge.fg }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.badge.dot }} />
                    {c.status}
                  </span>
                </div>
                <div className="p-5">
                  <div className="text-[13px] text-[#6B6B6B]">
                    {c.date} · {c.time}
                  </div>
                  <div className="mt-1.5 text-[19px] font-black tracking-[-0.02em]">{c.title}</div>
                  <div className="mt-1 text-sm text-[#6B6B6B]">
                    {c.type} · {c.qtyL}
                  </div>
                  <div className="mt-4.5 flex items-center justify-between gap-3 border-t border-[#EDE6E3] pt-3.5">
                    <span className="text-xs tabular-nums text-[#6B6B6B]">{c.bid}</span>
                    <span className="flex gap-4">
                      <button
                        onClick={() => {
                          setOpen(c.id);
                          setConfirm(false);
                        }}
                        className="text-sm font-bold text-[#E5251B] hover:text-[#B71C14]"
                      >
                        View
                      </button>
                      <button
                        onClick={() => showToast("Ticket PDF saved · " + c.bid)}
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
                  style={{ background: cur.badge.bg, color: cur.badge.fg }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: cur.badge.dot }} />
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
                <div className="aspect-square w-full max-w-[240px] rounded-xl border border-[#EDE6E3] bg-white p-4">
                  <svg viewBox="0 0 29 29" shapeRendering="crispEdges" className="block h-full w-full">
                    <path d={qrPath(cur.id)} fill="#141414" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">BOOKING ID</div>
                  <div className="mt-1 text-lg font-black tracking-[0.02em] tabular-nums">{cur.bid}</div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">ATTENDEE</div>
                  <div className="mt-1 text-base font-bold">Priya Raghavan</div>
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
                    {cur.venue}, {cur.area}
                  </div>
                </div>
                <div className="flex flex-col gap-2.5 rounded-xl border border-[#EDE6E3] p-4.5 text-[15px]">
                  <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">PAYMENT</div>
                  <div className="flex justify-between">
                    <span>
                      {cur.type} × {cur.qty}
                    </span>
                    <span>{cur.total}</span>
                  </div>
                  <div className="flex justify-between text-[#6B6B6B]">
                    <span>Booking fee</span>
                    <span>{cur.fee}</span>
                  </div>
                  <div className="flex justify-between border-t border-[#EDE6E3] pt-2.5 font-black">
                    <span>Paid via UPI</span>
                    <span>{cur.grand}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    onClick={() => downloadIcs(cur)}
                    className="inline-flex h-[46px] items-center rounded-full bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right px-5.5 text-sm font-bold text-white transition-[background-position] duration-400 ease-out hover:bg-left"
                  >
                    Download PDF
                  </button>
                  <button
                    onClick={() => downloadIcs(cur)}
                    className="inline-flex h-[46px] items-center rounded-full border border-[#EDE6E3] px-5 text-sm font-bold hover:bg-[#FAF7F5]"
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
                {cur.canCancel && !confirm && (
                  <button
                    onClick={() => setConfirm(true)}
                    className="self-start text-[13px] text-[#6B6B6B] underline decoration-1 underline-offset-[3px] hover:text-[#B71C14]"
                  >
                    Cancel booking
                  </button>
                )}
                {cur.canCancel && confirm && (
                  <div className="flex flex-col gap-3 rounded-xl bg-[#FDECEA] p-4.5">
                    <div className="text-[15px] font-bold">Cancel this booking?</div>
                    <div className="text-sm leading-relaxed text-[#6B6B6B]">
                      {cur.grand} will be refunded to your UPI account in 5–7 working days. This
                      can&apos;t be undone.
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        onClick={() => setConfirm(false)}
                        className="inline-flex h-10 items-center rounded-full border border-[#EDE6E3] bg-white px-4.5 text-sm font-bold"
                      >
                        Keep booking
                      </button>
                      <button
                        onClick={() => {
                          setCancelled((c) => ({ ...c, [cur.id]: true }));
                          setOpen(null);
                          setConfirm(false);
                          showToast("Booking cancelled. Refund in 5–7 days.");
                        }}
                        className="inline-flex h-10 items-center rounded-full bg-[#B71C14] px-4.5 text-sm font-bold text-white"
                      >
                        Yes, cancel
                      </button>
                    </div>
                  </div>
                )}
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
