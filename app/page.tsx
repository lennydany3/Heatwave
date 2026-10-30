"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import AuthModal from "@/components/auth/AuthModal";

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

function PlaceholderImage({
  label,
  rounded = "12px",
  className = "",
}: {
  label: string;
  rounded?: string;
  className?: string;
}) {
  return (
    <div
      style={{ borderRadius: rounded, background: "#FAF7F5" }}
      className={`flex flex-col items-center justify-center gap-2 border border-[#EDE6E3] text-[#B4ACA7] ${className}`}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
        <path
          d="M21 15l-5-5-11 11"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

const INFO = [
  { label: "DATE", value: "Sat, 13 Feb 2027" },
  { label: "TIME", value: "9:30 AM – 6 PM" },
  { label: "VENUE", value: "Bangalore Intl. Centre" },
  { label: "PRICE", value: "From ₹999" },
];

const ABOUT_POINTS = [
  "14 talks across product, design and engineering",
  "Hands-on afternoon workshops, capped at 30 seats",
  "Demo showcase from 20 early-stage teams",
  "Meals and evening networking included",
];

const SCHEDULE = [
  { time: "09:30", title: "Registration & coffee", sub: "Foyer, ground floor" },
  {
    time: "10:15",
    title: "Opening keynote",
    sub: "Aditi Rao · Building for the next 500 million",
  },
  {
    time: "11:00",
    title: "Panel: Shipping in small teams",
    sub: "Kabir Mehta, Nisha Verghese, Arjun Iyer",
  },
  { time: "12:30", title: "Lunch", sub: "Garden terrace" },
  {
    time: "13:30",
    title: "Workshops",
    sub: "Research sprints · Design systems · Pricing",
  },
  { time: "15:30", title: "Fireside chat", sub: "Meera Kapoor in conversation" },
  { time: "17:00", title: "Demo showcase", sub: "20 teams, 3 minutes each" },
  { time: "18:00", title: "Close & networking", sub: "Main hall" },
];

const SPEAKERS = [
  { name: "Aditi Rao", role: "Design Director, Kite" },
  { name: "Kabir Mehta", role: "Co-founder, Ledgerly" },
  { name: "Nisha Verghese", role: "VP Product, Orbit Health" },
  { name: "Arjun Iyer", role: "Staff Engineer, Paywise" },
  { name: "Meera Kapoor", role: "Partner, Northlight Ventures" },
];

const FAQS = [
  {
    q: "Who is this for?",
    a: "Product managers, designers, engineers and founders. Students are welcome; group tickets work well for college teams.",
  },
  {
    q: "Is lunch included?",
    a: "Yes — lunch, tea breaks and evening networking snacks are included with every ticket.",
  },
  {
    q: "Can I transfer my ticket?",
    a: "Yes, tickets can be transferred to someone else any time before the event — just email us the new attendee's details.",
  },
  {
    q: "What is the refund policy?",
    a: "Full refund until 30 January 2027. After that, tickets can be transferred but not refunded.",
  },
];

const SEATS_LEFT = 42;

export default function EventPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showBar, setShowBar] = useState(false);
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
    // Reads the proxy's redirect params (window isn't available during SSR,
    // so this can't be computed during render).
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRedirectAfterAuth(params.get("next") || "/events/registations");
      setAuthOpen(true);
    }
  }, []);

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
              <a href="#schedule" className="hover:text-[#E5251B]">
                Schedule
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
              Conference · Bengaluru
            </div>
            <div className="relative mt-5">
              <div className="pointer-events-none absolute -left-6 -right-6 top-[56%] h-[120px] -translate-y-1/2 overflow-hidden">
                <Wave />
              </div>
              <h1 className="relative m-0 text-[56px] font-black leading-[0.9] tracking-[-0.055em] [text-wrap:balance] sm:text-[80px] lg:text-[112px]">
                Product Builders Summit{" "}
                <span className="text-[#E5251B]">2027</span>
              </h1>
            </div>

            <div className="mt-11 grid grid-cols-2 gap-x-7 gap-y-6 border-t border-[#EDE6E3] pt-6 sm:grid-cols-4">
              {INFO.map((item) => (
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
                Register now <span>→</span>
              </button>
              <span className="text-sm text-[#6B6B6B]">
                <span className="font-bold text-[#141414]">{SEATS_LEFT}</span>{" "}
                seats left
              </span>
            </div>
          </div>

          <div className="relative min-w-0 flex-1 basis-[420px] aspect-[4/5] max-h-[620px] w-full overflow-hidden rounded-xl border border-[#EDE6E3]">
            <Image
              src="/images/sample-poster.jpeg"
              alt="Product Builders Summit 2027 event poster"
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
              One day for the people who ship products.
            </h2>
            <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-[#6B6B6B]">
              A single-track day of talks, workshops and demos from founders,
              designers and engineers building in India. Small rooms, real
              case studies, and time to meet the people behind the products
              you use.
            </p>
          </div>
          <div className="flex min-w-0 flex-1 basis-[360px] flex-col">
            {ABOUT_POINTS.map((point, i) => (
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

      <section id="schedule">
        <div className="mx-auto max-w-[880px] px-6 py-24">
          <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
            SCHEDULE
          </div>
          <h2 className="mb-12 mt-4 text-[40px] font-black tracking-[-0.035em]">
            The day
          </h2>
          <div className="relative">
            <div className="absolute left-[96px] top-[10px] bottom-[10px] w-px bg-[#E5251B]" />
            {SCHEDULE.map((item) => (
              <div
                key={item.time}
                className="grid grid-cols-[80px_32px_1fr] items-start pb-8"
              >
                <div className="pt-0.5 text-sm font-bold tabular-nums">
                  {item.time}
                </div>
                <div className="flex justify-center pt-[7px]">
                  <span className="ml-px h-[9px] w-[9px] rounded-full bg-[#E5251B] shadow-[0_0_0_4px_white]" />
                </div>
                <div>
                  <div className="text-lg font-bold tracking-[-0.01em]">
                    {item.title}
                  </div>
                  <div className="mt-1 text-[15px] text-[#6B6B6B]">
                    {item.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#EDE6E3]">
        <div className="mx-auto max-w-[1200px] px-6 py-24">
          <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
            SPEAKERS
          </div>
          <h2 className="mb-12 mt-4 text-[40px] font-black tracking-[-0.035em]">
            On stage
          </h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {SPEAKERS.map((speaker) => (
              <div
                key={speaker.name}
                className="transition-transform duration-200 hover:-translate-y-1"
              >
                <PlaceholderImage
                  label="Speaker photo"
                  rounded="20px"
                  className="aspect-square w-full"
                />
                <div className="mt-3.5 text-[17px] font-bold">
                  {speaker.name}
                </div>
                <div className="mt-0.5 text-sm text-[#6B6B6B]">
                  {speaker.role}
                </div>
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
              <PlaceholderImage
                label="Map screenshot"
                rounded="0px"
                className="absolute inset-0 h-full w-full"
              />
            </div>
            <div className="flex flex-1 basis-[280px] flex-col justify-center gap-4 p-9">
              <div className="text-[26px] font-black leading-[1.1] tracking-[-0.025em]">
                Bangalore International Centre
              </div>
              <div className="text-base leading-relaxed text-[#6B6B6B]">
                7, 4th Main Rd, Stage 2, Domlur
                <br />
                Bengaluru, Karnataka 560071
              </div>
              <a
                href="https://maps.google.com/?q=Bangalore+International+Centre"
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
          <span>© 2027 Heatwave. Event tickets made simple.</span>
          <span className="flex gap-5">
            <Link href="#" className="text-[#6B6B6B]">
              Terms
            </Link>
            <Link href="#" className="text-[#6B6B6B]">
              Privacy
            </Link>
            <Link href="#" className="text-[#6B6B6B]">
              Contact
            </Link>
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
                ₹999
              </div>
            </div>
            <div className="text-sm text-[#6B6B6B]">
              <span className="font-bold text-[#E5251B]">{SEATS_LEFT}</span>{" "}
              seats left · Sat, 13 Feb
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

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={handleAuthenticated}
        next={redirectAfterAuth || "/"}
      />
    </div>
  );
}
