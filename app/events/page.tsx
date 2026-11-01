import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import BottomNav, { BOTTOM_NAV_SPACE } from "@/components/BottomNav";
import Navbar from "@/components/Navbar";
import { EVENT } from "@/lib/event";
import { getEventData } from "@/lib/eventData";
import { createAdminClient } from "@/utils/supabase/admin";

export const metadata: Metadata = {
  title: "Events — Heatwave",
  description: "Upcoming Heatwave events in Chennai.",
};

// Prices and seat availability change while the event is on sale.
export const dynamic = "force-dynamic";

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN");

function daysUntil(iso: string) {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days < 0) return "Ended";
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export default async function EventsPage() {
  const data = await getEventData(createAdminClient(), EVENT.slug).catch(() => null);
  const tiers = data?.tiers ?? [];
  const openTier = tiers.find(
    (t) => t.status === "open" && !data?.availability[t.id]?.registrationClosed
  );
  const prices = openTier
    ? [openTier.price_male, openTier.price_female].filter((n): n is number => !!n)
    : [];
  const from = prices.length ? fmt(Math.min(...prices)) : null;
  const full = tiers.some((t) => t.status !== "coming_soon") && !openTier;
  const status = full
    ? { label: "Waitlist open", bg: "#FFF6E5", fg: "#8A5A00", dot: "#D99A1E" }
    : { label: "Registration open", bg: "#EEF4EF", fg: "#2F6B45", dot: "#3F8A5A" };

  return (
    <div
      className={`min-h-screen bg-[#FAF7F5] text-[#141414] ${BOTTOM_NAV_SPACE}`}
      style={{ fontFamily: "var(--font-satoshi)" }}
    >
      <Navbar />

      <main className="mx-auto max-w-[1152px] px-5 pb-16 pt-8 sm:px-6 sm:pt-12">
        <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">EVENTS</div>
        <h1 className="m-0 mt-3 text-[36px] font-black leading-none tracking-[-0.05em] sm:text-[56px]">
          What&apos;s on
        </h1>
        <p className="mt-2.5 text-[15px] text-[#6B6B6B] sm:text-base">
          Upcoming Heatwave nights in Chennai.
        </p>

        {/* Featured event */}
        <article className="mt-7 grid animate-[hwUp_0.5s_ease_both] overflow-hidden rounded-[24px] border border-[#EDE6E3] bg-white sm:mt-10 md:grid-cols-[minmax(0,420px)_1fr]">
          <Link href="/" className="relative block aspect-[4/5] overflow-hidden bg-[#141414]">
            <Image
              src={EVENT.poster}
              alt={EVENT.posterAlt}
              fill
              priority
              sizes="(min-width: 768px) 420px, 100vw"
              className="object-cover transition-transform duration-500 hover:scale-[1.03]"
            />
          </Link>

          <div className="flex flex-col p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{ background: status.bg, color: status.fg }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.dot }} />
                {status.label}
              </span>
              <span className="rounded-full bg-[#141414] px-2.5 py-1 text-[11px] font-bold text-white">
                {daysUntil(EVENT.startsAt)}
              </span>
            </div>
            <div className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B]">
              Cruise party · Chennai
            </div>
            <h2 className="m-0 mt-2 text-[34px] font-black leading-none tracking-[-0.05em] sm:text-[48px]">
              {EVENT.name}
            </h2>
            <div className="mt-1.5 text-[15px] font-bold text-[#E5251B]">{EVENT.presenter}</div>
            <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-[#6B6B6B]">
              {EVENT.description[0]}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#EDE6E3] bg-[#EDE6E3]">
              {[
                { label: "DATE", value: EVENT.dateLabel },
                { label: "TIME", value: EVENT.timeLabel },
                { label: "VENUE", value: EVENT.venueShort },
                { label: "PRICE", value: from ? `From ${from}` : full ? "Waitlist" : "Announced soon" },
              ].map((d) => (
                <div key={d.label} className="bg-white px-4 py-3">
                  <div className="text-[10px] font-bold tracking-[0.14em] text-[#9A918D]">{d.label}</div>
                  <div className="mt-0.5 text-[14px] font-bold leading-snug">{d.value}</div>
                </div>
              ))}
            </div>

            {tiers.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tiers.map((t) => {
                  const closed = t.status === "closed" || !!data?.availability[t.id]?.registrationClosed;
                  return (
                    <span
                      key={t.id}
                      className={`rounded-full border px-3 py-1 text-[12px] font-bold ${
                        t.status === "coming_soon"
                          ? "border-dashed border-[#E0D6D2] text-[#9A918D]"
                          : closed
                            ? "border-[#F3C9C5] text-[#B71C14] line-through"
                            : "border-[#141414] text-[#141414]"
                      }`}
                    >
                      {t.name}
                      {t.status === "coming_soon" ? " · soon" : ""}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3 md:mt-auto md:pt-6">
              <Link
                href="/events/registations"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#E5251B] px-4 text-[14px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(229,37,27,0.65)] transition-colors hover:bg-[#CF2017]"
              >
                {full ? "Join waitlist" : "Register"} →
              </Link>
              <Link
                href="/"
                className="inline-flex h-12 items-center justify-center rounded-full border border-[#EDE6E3] px-4 text-[14px] font-bold transition-colors hover:bg-[#FAF7F5]"
              >
                Event details
              </Link>
            </div>
          </div>
        </article>

        {/* Teaser for what's next */}
        <div className="mt-4 flex items-center gap-4 rounded-[24px] border border-dashed border-[#E0D6D2] px-5 py-5 sm:mt-5 sm:px-8">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#FDECEA] text-[#E5251B]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M2 14c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                opacity=".45"
              />
            </svg>
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-black tracking-[-0.02em]">More waves are coming</div>
            <div className="mt-0.5 text-[13px] leading-snug text-[#6B6B6B]">
              New events show up here first. Follow along so you don&apos;t miss the next one.
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
