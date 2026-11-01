"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import AuthModal from "@/components/auth/AuthModal";
import { EVENT } from "@/lib/event";

const SECTIONS = [
  { id: "about", label: "About" },
  { id: "tickets", label: "Tickets" },
  { id: "venue", label: "Venue" },
  { id: "faq", label: "FAQ" },
];

const REGISTER_PATH = "/events/registations";

const cta =
  "inline-flex items-center justify-center gap-2 rounded-full bg-[#E5251B] font-bold text-white shadow-[0_8px_18px_-8px_rgba(229,37,27,0.65)] transition-[background-color,transform] duration-200 ease-out hover:bg-[#CF2017] active:scale-[0.98]";

/** Height the floating bar takes up, for pages whose hero runs underneath it. */
export const NAVBAR_OFFSET = "-mt-[68px] pt-[68px] sm:-mt-[76px] sm:pt-[76px]";

export default function Navbar({
  onLogin,
  onRegister,
  ctaLabel = "Register now",
}: {
  /** Overrides the built-in login modal (the event page manages its own). */
  onLogin?: () => void;
  /** Overrides the default register action. */
  onRegister?: () => void;
  ctaLabel?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const onHome = pathname === "/";
  const showCta = !pathname.startsWith(REGISTER_PATH);

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authNext, setAuthNext] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    // Highlights the link for the section currently in the middle of the screen.
    if (!onHome) return;
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => !!el
    );
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveSection(e.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    els.forEach((el) => io.observe(el));
    const onTop = () => window.scrollY < 300 && setActiveSection(null);
    window.addEventListener("scroll", onTop, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onTop);
    };
  }, [onHome]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    const mq = window.matchMedia("(min-width: 768px)");
    const onMq = () => mq.matches && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [menuOpen]);

  function login() {
    setMenuOpen(false);
    if (onLogin) return onLogin();
    setAuthNext(null);
    setAuthOpen(true);
  }

  function register() {
    setMenuOpen(false);
    if (onRegister) return onRegister();
    if (user) {
      router.push(REGISTER_PATH);
      return;
    }
    setAuthNext(REGISTER_PATH);
    setAuthOpen(true);
  }

  async function logout() {
    setMenuOpen(false);
    await signOut();
    if (!onHome) router.push("/");
  }

  function handleAuthenticated() {
    setAuthOpen(false);
    if (authNext) router.push(authNext);
    else router.refresh();
  }

  const href = (id: string) => (onHome ? `#${id}` : `/#${id}`);
  const name =
    (user?.user_metadata?.full_name as string | undefined) || user?.email?.split("@")[0] || "";
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "U";
  const onDashboard = pathname.startsWith("/dashboard");

  return (
    <>
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
        <div
          className={`mx-auto grid h-14 max-w-[1152px] grid-cols-[1fr_auto] items-center gap-4 rounded-full border bg-white/80 pl-5 pr-2 backdrop-blur-xl transition-[box-shadow,border-color,background-color] duration-300 sm:h-[60px] sm:pl-6 md:grid-cols-[1fr_auto_1fr] ${
            scrolled || menuOpen
              ? "border-[#EDE6E3] bg-white/90 shadow-[0_10px_30px_-16px_rgba(20,20,20,0.25)]"
              : "border-[#EDE6E3]/80 shadow-none"
          }`}
        >
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-1.5 justify-self-start text-xl font-black tracking-[-0.04em] text-[#141414]"
          >
            heatwave
            <span className="h-[7px] w-[7px] rounded-full bg-[#E5251B]" />
          </Link>

          {/* Desktop links, centred. The active section gets the brand's red dot. */}
          <nav className="hidden items-center gap-8 text-[14px] font-medium md:flex">
            {SECTIONS.map((s) => {
              const active = activeSection === s.id;
              return (
                <a
                  key={s.id}
                  href={href(s.id)}
                  className={`relative py-2 transition-colors ${
                    active ? "text-[#141414]" : "text-[#6B6B6B] hover:text-[#141414]"
                  }`}
                >
                  {s.label}
                  <span
                    className={`absolute -bottom-0.5 left-1/2 h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-[#E5251B] transition-[opacity,transform] duration-300 ${
                      active ? "scale-100 opacity-100" : "scale-0 opacity-0"
                    }`}
                  />
                </a>
              );
            })}
          </nav>

          <div className="hidden items-center justify-self-end gap-1 md:flex">
            {!authLoading &&
              (user ? (
                <>
                  <button
                    onClick={logout}
                    className="h-10 rounded-full px-4 text-[14px] font-bold text-[#6B6B6B] transition-colors hover:text-[#141414]"
                  >
                    Log out
                  </button>
                  <Link
                    href="/dashboard"
                    aria-current={onDashboard ? "page" : undefined}
                    className={`flex h-10 items-center rounded-full px-5 text-[14px] font-bold transition-colors ${
                      onDashboard
                        ? "bg-[#FDECEA] text-[#E5251B]"
                        : "bg-[#141414] text-white hover:bg-[#E5251B]"
                    }`}
                  >
                    My Tickets
                  </Link>
                  <Link
                    href="/profile"
                    aria-label="Profile"
                    title="Profile"
                    className={`ml-1 flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold transition-shadow ${
                      pathname.startsWith("/profile")
                        ? "bg-[#E5251B] text-white"
                        : "bg-[#F5F0EE] text-[#141414] hover:shadow-[0_0_0_2px_#E5251B]"
                    }`}
                  >
                    {initials}
                  </Link>
                </>
              ) : (
                <>
                  <button
                    onClick={login}
                    className="h-10 rounded-full px-4 text-[14px] font-bold text-[#141414] transition-colors hover:text-[#E5251B]"
                  >
                    Log in
                  </button>
                  {showCta && (
                    <button onClick={register} className={`h-10 px-5 text-[14px] ${cta}`}>
                      {ctaLabel} <span aria-hidden>→</span>
                    </button>
                  )}
                </>
              ))}
          </div>

          {/* Mobile controls */}
          <div className="flex items-center gap-1 justify-self-end md:hidden">
            {!authLoading &&
              (user ? (
                !onDashboard && (
                  <Link
                    href="/dashboard"
                    className="flex h-10 items-center rounded-full bg-[#141414] px-4 text-[14px] font-bold text-white"
                  >
                    My Tickets
                  </Link>
                )
              ) : (
                <button
                  onClick={login}
                  className="h-10 rounded-full px-3.5 text-[14px] font-bold text-[#141414]"
                >
                  Log in
                </button>
              ))}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                menuOpen ? "bg-[#141414]" : "bg-[#F5F0EE]"
              }`}
            >
              <span className="relative block h-3 w-4">
                <span
                  className={`absolute left-0 top-0 h-0.5 w-4 rounded transition-transform duration-200 ${
                    menuOpen ? "bg-white" : "bg-[#141414]"
                  }`}
                  style={{ transform: menuOpen ? "translateY(5px) rotate(45deg)" : "none" }}
                />
                <span
                  className={`absolute bottom-0 left-0 h-0.5 w-4 rounded transition-transform duration-200 ${
                    menuOpen ? "bg-white" : "bg-[#141414]"
                  }`}
                  style={{ transform: menuOpen ? "translateY(-5px) rotate(-45deg)" : "none" }}
                />
              </span>
            </button>
          </div>
        </div>

        {/* Mobile menu: numbered like the About highlights */}
        {menuOpen && (
          <>
            <div
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 -z-10 bg-[#141414]/30 backdrop-blur-[2px] md:hidden"
            />
            <nav
              id="mobile-menu"
              className="mx-auto mt-2 max-w-[1152px] animate-[hwUp_0.25s_ease_both] rounded-[28px] border border-[#EDE6E3] bg-white px-5 pb-5 pt-2 text-[#141414] shadow-[0_24px_48px_-24px_rgba(20,20,20,0.35)] md:hidden"
            >
              {SECTIONS.map((s, i) => (
                <a
                  key={s.id}
                  href={href(s.id)}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-baseline gap-4 border-b border-[#EDE6E3] py-4 text-[26px] font-black leading-none tracking-[-0.035em] active:text-[#E5251B]"
                >
                  <span className="w-6 flex-none text-xs font-bold tracking-[0.08em] text-[#E5251B] tabular-nums">
                    0{i + 1}
                  </span>
                  {s.label}
                </a>
              ))}
              {user && (
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-baseline gap-4 border-b border-[#EDE6E3] py-4 text-[26px] font-black leading-none tracking-[-0.035em] active:text-[#E5251B]"
                >
                  <span className="w-6 flex-none text-xs font-bold tracking-[0.08em] text-[#E5251B] tabular-nums">
                    05
                  </span>
                  My Tickets
                </Link>
              )}
              {user && (
                <Link
                  href="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-baseline gap-4 border-b border-[#EDE6E3] py-4 text-[26px] font-black leading-none tracking-[-0.035em] active:text-[#E5251B]"
                >
                  <span className="w-6 flex-none text-xs font-bold tracking-[0.08em] text-[#E5251B] tabular-nums">
                    06
                  </span>
                  Profile
                </Link>
              )}
              <div className="mt-5">
                {user ? (
                  <button
                    onClick={logout}
                    className="h-12 w-full rounded-full border border-[#EDE6E3] text-[15px] font-bold text-[#6B6B6B]"
                  >
                    Log out
                  </button>
                ) : (
                  showCta && (
                    <button onClick={register} className={`h-12 w-full text-[15px] ${cta}`}>
                      {ctaLabel} <span aria-hidden>→</span>
                    </button>
                  )
                )}
                <div className="mt-3 text-center text-[13px] text-[#6B6B6B]">
                  {EVENT.dateLabel} · {EVENT.gateNote}
                </div>
              </div>
            </nav>
          </>
        )}
      </header>

      {!onLogin && (
        <AuthModal
          open={authOpen}
          onClose={() => setAuthOpen(false)}
          onAuthenticated={handleAuthenticated}
          next={authNext || pathname}
        />
      )}
    </>
  );
}
