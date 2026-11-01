"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import AuthModal from "@/components/auth/AuthModal";
import SupportModal from "@/components/SupportModal";
import { EVENT } from "@/lib/event";
import { createClient } from "@/utils/supabase/client";

const btn =
  "inline-flex items-center justify-center gap-2.5 rounded-full text-white font-bold transition-[background-position] duration-400 ease-out bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right hover:bg-left";

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
  coming_soon: "Announced soon",
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
    a: "Gate closes at 7:00 PM sharp on Saturday, 12 December, so plan to reach Muthukadu Boat House before then.",
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
    a: "Pricing is set per gender for each ticket phase. The current prices are listed in the Tickets section above, and the next phase will be announced soon.",
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
  const { user, loading: authLoading, signOut } = useAuth();
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
  const info = [
    { label: "DATE", value: EVENT.dateLabel },
    { label: "TIME", value: EVENT.timeLabel },
    { label: "VENUE", value: EVENT.venueShort },
    { label: "PRICE", value: openPrices.length ? `From ${fromPrice}` : "Announced soon" },
  ];

  function handleRegisterClick(e: MouseEvent) {
    e.preventDefault();
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
      <header className="sticky top-0 z-20 border-b border-[#EDE6E3] bg-white">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-6 py-[18px]">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xl font-black tracking-[-0.04em]"
          >
            heatwave
            <span className="h-[7px] w-[7px] rounded-full bg-[#E5251B]" />
          </Link>
          <div className="flex items-center gap-7">
            <nav className="flex items-center gap-7 text-sm font-medium">
              <a href="#about" className="hover:text-[#E5251B]">
                About
              </a>
              <a href="#tickets" className="hover:text-[#E5251B]">
                Tickets
              </a>
              <a href="#venue" className="hover:text-[#E5251B]">
                Venue
              </a>
              <a href="#faq" className="hover:text-[#E5251B]">
                FAQ
              </a>
              {user && (
                <Link href="/dashboard" className="hover:text-[#E5251B]">
                  My Tickets
                </Link>
              )}
            </nav>
            {!authLoading &&
              (user ? (
                <button
                  onClick={() => signOut()}
                  className="text-sm font-bold text-[#6B6B6B] hover:text-[#141414]"
                >
                  Log out
                </button>
              ) : (
                <button
                  onClick={openLogin}
                  className="text-sm font-bold text-[#141414] hover:text-[#E5251B]"
                >
                  Log in
                </button>
              ))}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-14 px-6 py-[72px] pb-[88px]">
          <div className="relative min-w-0 flex-1 basis-[480px] animate-[hwUp_0.6s_ease_both]">
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#6B6B6B]">
              Cruise party · Chennai
            </div>
            <div className="relative mt-5">
              <div className="pointer-events-none absolute -left-6 -right-6 top-[56%] h-[120px] -translate-y-1/2 overflow-hidden">
                <Wave />
              </div>
              <h1 className="relative m-0 text-[56px] font-black leading-[0.9] tracking-[-0.055em] [text-wrap:balance] sm:text-[80px] lg:text-[112px]">
                {EVENT.name}
                <span className="block text-[0.32em] leading-[1.1] tracking-[-0.03em] text-[#E5251B]">
                  {EVENT.presenter}
                </span>
              </h1>
            </div>

            <div className="mt-11 grid grid-cols-2 gap-x-7 gap-y-6 border-t border-[#EDE6E3] pt-6 sm:grid-cols-4">
              {info.map((item) => (
                <div key={item.label}>
                  <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">
                    {item.label}
                  </div>
                  <div className="mt-1.5 text-base font-medium">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-5">
              <button
                onClick={handleRegisterClick}
                className={`h-14 px-8 text-base ${btn}`}
              >
                {openTier || !tiers.some((t) => t.status !== "coming_soon") ? "Register now" : "Join waitlist"}{" "}
                <span>→</span>
              </button>
              <span className="text-sm text-[#6B6B6B]">{EVENT.gateNote}</span>
            </div>
          </div>

          <div className="relative min-w-0 flex-1 basis-[420px] aspect-[4/5] max-h-[620px] w-full overflow-hidden rounded-xl border border-[#EDE6E3]">
            <Image
              src={EVENT.poster}
              alt={EVENT.posterAlt}
              fill
              priority
              sizes="(min-width: 1024px) 420px, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section
        id="about"
        className="border-y border-[#EDE6E3] bg-[#FAF7F5]"
      >
        <div className="mx-auto flex max-w-[1200px] flex-wrap gap-14 px-6 py-24">
          <div className="min-w-0 flex-1 basis-[440px]">
            <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
              ABOUT
            </div>
            <h2 className="mt-4 text-[40px] font-black leading-[1.05] tracking-[-0.035em] [text-wrap:balance]">
              Chennai&apos;s first-ever cruise party.
            </h2>
            <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-[#6B6B6B]">
              {EVENT.description[0]} {EVENT.description[1]}
            </p>
          </div>
          <div className="flex min-w-0 flex-1 basis-[360px] flex-col">
            {HIGHLIGHTS.map((point, i) => (
              <div
                key={point}
                className="flex items-baseline gap-5 border-b border-[#EDE6E3] py-[22px] text-lg font-medium"
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

      <section id="tickets">
        <div className="mx-auto max-w-[880px] px-6 py-24">
          <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
            TICKETS
          </div>
          <h2 className="mb-10 mt-4 text-[40px] font-black tracking-[-0.035em]">
            Pick your wave
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                style={{ opacity: tier.status === "coming_soon" ? 0.6 : 1 }}
                className="rounded-xl border border-[#EDE6E3] p-7"
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

      <section id="venue" className="border-y border-[#EDE6E3] bg-[#FAF7F5]">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
            VENUE
          </div>
          <div className="mt-6 flex flex-wrap overflow-hidden rounded-xl border border-[#EDE6E3] bg-white">
            <div className="relative min-h-[300px] flex-[2_1_420px]">
              <Image
                src="/images/location.png"
                alt="Aerial view of a boat on the waters off Muthukadu"
                fill
                sizes="(min-width: 1024px) 760px, 100vw"
                className="object-cover"
              />
            </div>
            <div className="flex flex-1 basis-[280px] flex-col justify-center gap-4 p-9">
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

      <section id="faq">
        <div className="mx-auto max-w-[880px] px-6 py-24">
          <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
            FAQ
          </div>
          <h2 className="mb-8 mt-4 text-[40px] font-black tracking-[-0.035em]">
            Questions
          </h2>
          <div className="border-t border-[#EDE6E3]">
            {FAQS.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q} className="border-b border-[#EDE6E3]">
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-6 py-6 text-left text-lg font-bold"
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
                    <p className="m-0 max-w-[none] pb-6 pr-12 text-base leading-relaxed text-[#6B6B6B]">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#EDE6E3] px-6 pb-28 pt-6">
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
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-5 px-6 py-3.5">
          <div className="flex flex-wrap items-center gap-7">
            <div>
              <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">
                FROM
              </div>
              <div className="text-xl font-black tracking-[-0.02em]">
                {fromPrice}
              </div>
            </div>
            <div className="text-sm text-[#6B6B6B]">
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
