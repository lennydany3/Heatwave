"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import AuthModal from "@/components/auth/AuthModal";
import Navbar from "@/components/Navbar";
import SupportModal from "@/components/SupportModal";
import { EVENT } from "@/lib/event";
import { createClient } from "@/utils/supabase/client";

const btn =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#E5251B] font-bold text-white shadow-[0_8px_18px_-8px_rgba(229,37,27,0.65)] transition-[background-color,transform] duration-200 ease-out hover:bg-[#CF2017] active:scale-[0.98]";

function Wave({ className = "" }: { className?: string }) {
  const path =
    "M0 60 " +
    Array.from({ length: 8 }, (_, i) =>
      i === 0 ? "Q100 18 200 60 " : `T${200 * (i + 1)} 60 `
    ).join("");
  return (
    <svg
      viewBox="0 0 1600 120"
      preserveAspectRatio="none"
      className={`block h-full w-[200%] animate-[hwDrift_22s_linear_infinite] opacity-90 ${className}`}
    >
      <path
        d={path}
        fill="none"
        stroke="#E5251B"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

type Tier = {
  id: string;
  name: string;
  price_male: number | null;
  price_female: number | null;
  status: "open" | "coming_soon" | "closed";
};

// Shown until the live tiers load (or if they can't be fetched).
const FALLBACK_TIERS: Tier[] = [
  { id: "early_bird", name: "Early Bird", price_male: 999, price_female: 899, status: "open" },
  { id: "phase_1", name: "Phase 1", price_male: null, price_female: null, status: "coming_soon" },
];

const TIER_NOTE: Record<Tier["status"], string> = {
  open: "Limited early-bird price",
  coming_soon: "Comeing Soon",
  closed: "Sold out",
};

const money = (n: number | null) => (n ? "₹" + n.toLocaleString("en-IN") : "× × ×");

const HIGHLIGHTS = [
  "A 4-hour cruise on the waters of Muthukadu",
  "Electrifying vibes and incredible music",
  "Exclusive activities and experiences onboard",
  "A few surprises we're keeping under wraps",
];

const FAQS = [
  {
    q: "When should I arrive?",
    a: "Boarding closes at 7:30 PM sharp on Saturday, 12 December, so plan to reach Muthukadu Boat House before then.",
  },
  {
    q: "What's happening onboard?",
    a: "Four hours of music and electrifying vibes on the water, plus exclusive activities and a few surprises. Some things are better experienced than explained.",
  },
  {
    q: "How do I get my ticket?",
    a: "Register with your details, pay via UPI and upload the screenshot. Your ticket with a QR code appears in My Tickets and activates once we verify the payment.",
  },
  {
    q: "Why are prices different for male and female?",
    a: "Pricing is set per gender for each ticket phase. The current prices are listed in the Tickets section above, and the next phase will be Comeing Soon.",
  },
];

export default function EventPage({
  initialTiers,
  initialClosed,
}: {
  initialTiers?: Tier[];
  initialClosed?: Record<string, boolean>;
}) {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showBar, setShowBar] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [tiers, setTiers] = useState<Tier[]>(
    initialTiers && initialTiers.length > 0 ? initialTiers : FALLBACK_TIERS
  );
  // Tiers that are full or manually closed: registration is replaced by the waitlist.
  const [closedIds, setClosedIds] = useState<Record<string, boolean>>(
    initialClosed ?? {}
  );
  const { user } = useAuth();
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [redirectAfterAuth, setRedirectAfterAuth] = useState<string | null>(
    null
  );

  useEffect(() => {
    const onScroll = () => setShowBar(window.scrollY > 520);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // The server already supplied the tiers; only fetch in the browser as a fallback.
    if (initialTiers) return;
    let cancelled = false;
    async function loadTiers() {
      const supabase = createClient();
      const availabilityReq = fetch(`/api/events/availability?slug=${EVENT.slug}`, {
        cache: "no-store",
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      const { data: ev } = await supabase
        .from("events")
        .select("id")
        .eq("slug", EVENT.slug)
        .single();
      if (!ev || cancelled) return;
      const avail = (await availabilityReq) as {
        tiers: { tierId: string; registrationClosed: boolean }[];
      } | null;
      if (!cancelled && avail) {
        setClosedIds(Object.fromEntries(avail.tiers.map((t) => [t.tierId, t.registrationClosed])));
      }
      const { data } = await supabase
        .from("ticket_tiers")
        .select("id, name, price_male, price_female, status")
        .eq("event_id", ev.id)
        .order("sort_order");
      if (!cancelled && data && data.length > 0) setTiers(data as Tier[]);
    }
    loadTiers();
    return () => {
      cancelled = true;
    };
  // Server-provided props are fixed for the life of the page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Reads the proxy's redirect params (window isn't available during SSR,
    // so this can't be computed during render).
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRedirectAfterAuth(params.get("next") || "/events/registations");
      setAuthOpen(true);
    }
  }, []);

  const openTier = tiers.find((t) => t.status === "open" && !closedIds[t.id]);
  const openPrices = openTier
    ? [openTier.price_male, openTier.price_female].filter((n): n is number => !!n)
    : [];
  const fromPrice = openPrices.length ? "₹" + Math.min(...openPrices).toLocaleString("en-IN") : "TBA";
  const ctaLabel =
    openTier || !tiers.some((t) => t.status !== "coming_soon") ? "Register now" : "Join waitlist";
  const info = [
    { label: "DATE", value: EVENT.dateLabel },
    { label: "TIME", value: EVENT.timeLabel },
    { label: "VENUE", value: EVENT.venueShort },
    { label: "PRICE", value: openPrices.length ? `From ${fromPrice}` : "Comeing Soon" },
  ];

  function handleRegisterClick(e?: MouseEvent) {
    e?.preventDefault();
    if (user) {
      router.push("/events/registations");
      return;
    }
    setRedirectAfterAuth("/events/registations");
    setAuthOpen(true);
  }

  function openLogin() {
    setRedirectAfterAuth(null);
    setAuthOpen(true);
  }

  function handleAuthenticated() {
    setAuthOpen(false);
    if (redirectAfterAuth) {
      router.push(redirectAfterAuth);
    }
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-white text-[#141414]"
      style={{ fontFamily: "var(--font-satoshi)" }}
    >
      <Navbar onLogin={openLogin} onRegister={handleRegisterClick} ctaLabel={ctaLabel} />

      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-[1200px] items-center gap-8 px-5 pb-12 pt-6 sm:px-6 sm:pt-10 lg:grid-cols-2 lg:gap-14 lg:py-[72px] lg:pb-[88px]">
          <div className="relative min-w-0 lg:order-last">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-[420px] overflow-hidden rounded-2xl border border-[#EDE6E3] shadow-[0_20px_40px_-24px_rgba(20,20,20,0.35)] sm:max-w-[460px] lg:mr-0 lg:max-w-[496px]">
              <Image
                src={EVENT.poster}
                alt={EVENT.posterAlt}
                fill
                priority
                sizes="(min-width: 1024px) 560px, (min-width: 640px) 460px, 100vw"
                className="object-cover"
              />
            </div>
          </div>

          <div className="relative min-w-0 animate-[hwUp_0.6s_ease_both]">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B6B6B] sm:text-xs">
              Cruise party · Chennai
            </div>
            <div className="relative mt-3 sm:mt-5">
              <div className="pointer-events-none absolute -left-5 -right-5 top-[50%] h-[80px] -translate-y-1/2 overflow-hidden sm:-left-6 sm:-right-6 sm:top-[56%] sm:h-[120px]">
                <Wave />
              </div>
              <h1 className="relative m-0 text-[clamp(56px,19vw,88px)] font-black leading-[0.9] tracking-[-0.055em] [text-wrap:balance] sm:text-[88px] lg:text-[112px]">
                {EVENT.name}
                <span className="block text-[0.32em] leading-[1.1] tracking-[-0.03em] text-[#E5251B]">
                  {EVENT.presenter}
                </span>
              </h1>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#EDE6E3] bg-[#EDE6E3] sm:mt-9 sm:grid-cols-4 sm:gap-x-7 sm:overflow-visible sm:rounded-none sm:border-0 sm:border-t sm:bg-transparent sm:pt-6 lg:mt-11 lg:grid-cols-2 xl:grid-cols-4">
              {info.map((item) => (
                <div
                  key={item.label}
                  className="bg-white px-4 py-3.5 sm:p-0 lg:py-0"
                >
                  <div className="text-[10px] font-bold tracking-[0.14em] text-[#6B6B6B] sm:text-[11px]">
                    {item.label}
                  </div>
                  <div className="mt-1 text-[15px] font-medium leading-snug sm:mt-1.5 sm:text-base">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col items-stretch gap-3 sm:mt-9 sm:flex-row sm:items-center sm:gap-5">
              <button
                onClick={handleRegisterClick}
                className={`h-14 px-8 text-base ${btn}`}
              >
                {ctaLabel}{" "}
                <span>→</span>
              </button>
              <span className="text-center text-sm text-[#6B6B6B] sm:text-left">
                {EVENT.gateNote}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section
        id="about"
        className="scroll-mt-20 border-y border-[#EDE6E3] bg-[#FAF7F5]"
      >
        <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-14 sm:px-6 sm:py-20 md:grid-cols-2 md:gap-14 lg:py-24">
          <div className="min-w-0">
            <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
              ABOUT
            </div>
            <h2 className="mt-3 text-[30px] font-black leading-[1.08] tracking-[-0.035em] [text-wrap:balance] sm:mt-4 sm:text-[40px]">
              Chennai&apos;s first-ever cruise party.
            </h2>
            <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-[#6B6B6B] sm:mt-5 sm:text-lg">
              {EVENT.description[0]} {EVENT.description[1]}
            </p>
          </div>
          <div className="flex min-w-0 flex-col border-t border-[#EDE6E3] md:border-t-0">
            {HIGHLIGHTS.map((point, i) => (
              <div
                key={point}
                className="flex items-baseline gap-4 border-b border-[#EDE6E3] py-[18px] text-base font-medium leading-snug sm:gap-5 sm:py-[22px] sm:text-lg"
              >
                <span className="text-xs font-bold tracking-[0.08em] text-[#E5251B]">
                  0{i + 1}
                </span>
                {point}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="tickets" className="scroll-mt-20">
        <div className="mx-auto max-w-[880px] px-5 py-14 sm:px-6 sm:py-20 lg:py-24">
          <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
            TICKETS
          </div>
          <h2 className="mb-7 mt-3 text-[30px] font-black tracking-[-0.035em] sm:mb-10 sm:mt-4 sm:text-[40px]">
            Pick your wave
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                style={{ opacity: tier.status === "coming_soon" ? 0.6 : 1 }}
                className="rounded-xl border border-[#EDE6E3] p-5 sm:p-7"
              >
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#6B6B6B]">
                  {tier.name}
                </div>
                <div className="mt-4 flex justify-between text-base">
                  <span className="text-[#6B6B6B]">Female</span>
                  <span className="text-[26px] font-black tracking-[-0.03em]">
                    {money(tier.status !== "coming_soon" ? tier.price_female : null)}
                  </span>
                </div>
                <div className="mt-2 flex justify-between text-base">
                  <span className="text-[#6B6B6B]">Male</span>
                  <span className="text-[26px] font-black tracking-[-0.03em]">
                    {money(tier.status !== "coming_soon" ? tier.price_male : null)}
                  </span>
                </div>
                {tier.status !== "coming_soon" && (tier.status === "closed" || closedIds[tier.id]) ? (
                  <div className="mt-4 text-sm font-bold text-[#B71C14]">
                    Registration full · waitlist open
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-[#6B6B6B]">{TIER_NOTE[tier.status]}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="venue" className="scroll-mt-20 border-y border-[#EDE6E3] bg-[#FAF7F5]">
        <div className="mx-auto max-w-[1200px] px-5 py-14 sm:px-6 sm:py-20 lg:py-24">
          <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
            VENUE
          </div>
          <div className="mt-5 grid overflow-hidden rounded-xl border border-[#EDE6E3] bg-white sm:mt-6 md:grid-cols-[2fr_1fr]">
            <div className="relative aspect-[16/10] min-h-[220px] md:aspect-auto md:min-h-[300px]">
              <Image
                src="/images/location.png"
                alt="Aerial view of a boat on the waters off Muthukadu"
                fill
                sizes="(min-width: 1024px) 760px, 100vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col justify-center gap-3 p-6 sm:gap-4 sm:p-9">
              <div className="text-[26px] font-black leading-[1.1] tracking-[-0.025em]">
                {EVENT.venueShort}
              </div>
              <div className="text-base leading-relaxed text-[#6B6B6B]">
                East Coast Road (ECR)
                <br />
                Chennai, Tamil Nadu
              </div>
              <a
                href={EVENT.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[15px] font-bold text-[#E5251B]"
              >
                Get directions →
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-20">
        <div className="mx-auto max-w-[880px] px-5 py-14 sm:px-6 sm:py-20 lg:py-24">
          <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
            FAQ
          </div>
          <h2 className="mb-6 mt-3 text-[30px] font-black tracking-[-0.035em] sm:mb-8 sm:mt-4 sm:text-[40px]">
            Questions
          </h2>
          <div className="border-t border-[#EDE6E3]">
            {FAQS.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q} className="border-b border-[#EDE6E3]">
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left text-base font-bold sm:gap-6 sm:py-6 sm:text-lg"
                  >
                    {item.q}
                    <span
                      className="text-[26px] font-normal leading-none text-[#E5251B] transition-transform duration-200"
                      style={{ transform: open ? "rotate(45deg)" : "none" }}
                    >
                      +
                    </span>
                  </button>
                  {open && (
                    <p className="m-0 max-w-[none] pb-5 pr-4 text-[15px] sm:pb-6 sm:pr-12 sm:text-base leading-relaxed text-[#6B6B6B]">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#EDE6E3] px-5 pb-28 pt-6 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 text-[13px] text-[#6B6B6B]">
          <span>© 2026 Heatwave. Event tickets made simple.</span>
          <span className="flex gap-5">
            <Link href="/terms" className="text-[#6B6B6B] hover:text-[#141414]">
              Terms
            </Link>
            <Link href="/privacy" className="text-[#6B6B6B] hover:text-[#141414]">
              Privacy
            </Link>
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              className="text-[#6B6B6B] hover:text-[#141414]"
            >
              Contact
            </button>
          </span>
        </div>
      </footer>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#EDE6E3] bg-white/96 backdrop-blur-sm transition-transform duration-350"
        style={{ transform: showBar ? "none" : "translateY(110%)" }}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-5 sm:px-6 sm:py-3.5">
          <div className="flex min-w-0 items-center gap-7">
            <div>
              <div className="text-[10px] font-bold tracking-[0.14em] text-[#6B6B6B] sm:text-[11px]">
                FROM
              </div>
              <div className="text-xl font-black tracking-[-0.02em]">
                {fromPrice}
              </div>
            </div>
            <div className="hidden text-sm text-[#6B6B6B] sm:block">
              <span className="font-bold text-[#E5251B]">{openTier?.name ?? "Tickets"}</span>{" "}
              · Sat, 12 Dec
            </div>
          </div>
          <button
            onClick={handleRegisterClick}
            className={`h-12 whitespace-nowrap px-7 text-[15px] ${btn}`}
          >
            Register
          </button>
        </div>
      </div>

      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={handleAuthenticated}
        next={redirectAfterAuth || "/"}
      />
    </div>
  );
}
