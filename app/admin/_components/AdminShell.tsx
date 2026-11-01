"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { canView, ROLE_LABEL } from "@/lib/permissions";
import { clearMe, useMe } from "../_lib/access";
import { ADMIN_NAV, type AdminPageKey } from "../_lib/data";
import { Sheet } from "./ui";

const ICONS: Record<AdminPageKey, ReactNode> = {
  overview: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </>
  ),
  events: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  verification: (
    <>
      <path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6L12 3z" />
      <path d="M8.8 12.2l2.2 2.2 4.3-4.6" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.8 20c.9-3.4 3.3-5.3 6.2-5.3s5.3 1.9 6.2 5.3M15.5 5.3a3.5 3.5 0 010 6.4M18 14.9c1.6.7 2.7 2.4 3.2 5.1" />
    </>
  ),
  waitlist: (
    <path d="M6.5 3.5h11M6.5 20.5h11M8 3.5v2.2c0 2 1.5 3.4 4 6.3 2.5-2.9 4-4.3 4-6.3V3.5M8 20.5v-2.2c0-2 1.5-3.4 4-6.3 2.5 2.9 4 4.3 4 6.3v2.2" />
  ),
  checkin: (
    <path d="M4 8V5.5A1.5 1.5 0 015.5 4H8M16 4h2.5A1.5 1.5 0 0120 5.5V8M20 16v2.5a1.5 1.5 0 01-1.5 1.5H16M8 20H5.5A1.5 1.5 0 014 18.5V16M4 12h16" />
  ),
  payments: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="3" />
      <path d="M2.5 10h19M6.5 15h3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </>
  ),
};

// Shorter labels for the phone tab bar.
const SHORT: Partial<Record<AdminPageKey, string>> = { overview: "Home", verification: "Verify" };

// Pages that earn a spot in the phone tab bar first; the rest go under "More".
const TAB_PRIORITY: AdminPageKey[] = [
  "overview",
  "verification",
  "checkin",
  "customers",
  "events",
  "waitlist",
  "payments",
  "settings",
];

function Icon({ name, className }: { name: AdminPageKey; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {ICONS[name]}
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </svg>
  );
}

function Brand({ dark }: { dark?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 text-[19px] font-black tracking-[-0.04em]">
        heatwave
        <span className="h-[7px] w-[7px] rounded-full bg-[#E5251B] shadow-[0_0_10px_rgba(229,37,27,.9)]" />
      </span>
      <span
        className={`rounded-md px-1.5 py-[3px] text-[9px] font-bold leading-none tracking-[0.16em] ${
          dark ? "bg-white/10 text-white/70" : "bg-[#141414] text-white"
        }`}
      >
        ADMIN
      </span>
    </span>
  );
}

export default function AdminShell({
  active,
  search,
  onSearchChange,
  children,
}: {
  active: AdminPageKey;
  search: string;
  onSearchChange: (value: string) => void;
  children: ReactNode;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { user, signOut } = useAuth();
  const me = useMe();
  const router = useRouter();
  const email = user?.email ?? "";
  const initials = email ? email.slice(0, 2).toUpperCase() : "AD";
  const showSearch = searchOpen || search !== "";

  // Only the pages this person may open.
  const items = me ? ADMIN_NAV.filter((n) => canView(me.role, me.permissions, n.key)) : [];
  const ranked = [...items].sort((a, b) => TAB_PRIORITY.indexOf(a.key) - TAB_PRIORITY.indexOf(b.key));
  const hasMore = ranked.length > 5;
  const tabs = hasMore ? ranked.slice(0, 4) : ranked;
  const moreActive = hasMore && !tabs.some((t) => t.key === active);

  function handleSearch(e: ChangeEvent<HTMLInputElement>) {
    onSearchChange(e.target.value);
  }

  function toggleSearch() {
    if (showSearch) {
      onSearchChange("");
      setSearchOpen(false);
      return;
    }
    // Render the field synchronously so focus lands inside the tap and the phone keyboard opens.
    flushSync(() => setSearchOpen(true));
    searchRef.current?.focus();
  }

  async function handleLogout() {
    clearMe();
    await signOut();
    router.push("/admin/login");
  }

  return (
    <div
      className="flex min-h-screen bg-[#F7F4F2] text-[#141414]"
      style={{ fontFamily: "var(--font-satoshi)" }}
    >
      <aside className="sticky top-0 hidden h-screen w-[248px] flex-none flex-col overflow-hidden bg-[#111111] p-3.5 text-white lg:flex">
        <span
          aria-hidden
          className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[#E5251B]/30 blur-3xl"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-20 h-56 w-56 rounded-full bg-[#E5251B]/10 blur-3xl"
        />
        <Link href="/admin/dashboard" className="relative px-2.5 pb-8 pt-2.5">
          <Brand dark />
        </Link>
        <div className="relative px-3 pb-2 text-[10px] font-bold tracking-[0.18em] text-white/35">MENU</div>
        <nav className="relative flex flex-col gap-1">
          {!me &&
            [1, 2, 3, 4, 5].map((k) => (
              <span
                key={k}
                className="mx-3 my-2.5 block h-4 animate-[hwPulse_1.4s_ease_infinite] rounded bg-white/10"
                style={{ width: 60 + ((k * 23) % 50) }}
              />
            ))}
          {items.map((n) => {
            const on = n.key === active;
            return (
              <Link
                key={n.key}
                href={n.href}
                aria-current={on ? "page" : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                  on ? "bg-white/[.09] text-white" : "text-white/55 hover:bg-white/[.05] hover:text-white"
                }`}
              >
                {on && (
                  <span className="absolute -left-3.5 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#E5251B] shadow-[0_0_14px_#E5251B]" />
                )}
                <Icon
                  name={n.key}
                  className={`h-[18px] w-[18px] flex-none transition-colors ${
                    on ? "text-[#FF4A3D]" : "text-white/45 group-hover:text-white/80"
                  }`}
                />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="relative mt-auto rounded-2xl border border-white/10 bg-white/[.04] p-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#E5251B] text-xs font-bold">
              {initials}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-bold">{email}</div>
              {me && (
                <div className="text-[10px] font-bold tracking-[0.12em] text-white/45">
                  {ROLE_LABEL[me.role].toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 h-9 w-full rounded-xl bg-white/[.06] text-[13px] font-bold text-white/80 transition-colors hover:bg-[#E5251B] hover:text-white"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[#EDE6E3]/80 bg-[#F7F4F2]/85 backdrop-blur-xl">
          <div className="flex h-[60px] items-center gap-2.5 px-4 sm:px-6 lg:h-[72px] lg:gap-3.5 lg:px-8">
            <Link
              href="/admin/dashboard"
              className={`${showSearch ? "hidden" : "flex"} min-w-0 flex-1 lg:hidden`}
            >
              <Brand />
            </Link>
            <div className={`${showSearch ? "block" : "hidden"} relative min-w-0 flex-1 lg:block lg:max-w-[440px]`}>
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B6B6B]" />
              <input
                ref={searchRef}
                value={search}
                onChange={handleSearch}
                type="search"
                enterKeyHint="search"
                placeholder="Search bookings, attendees, events"
                className="h-10 w-full rounded-full border border-[#EDE6E3] bg-white pl-10 pr-4 text-base outline-none transition-shadow focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)] lg:h-[42px] lg:text-sm"
              />
            </div>
            <button
              onClick={toggleSearch}
              aria-label={showSearch ? "Close search" : "Search"}
              className={`flex h-10 flex-none items-center justify-center rounded-full text-sm font-bold lg:hidden ${
                showSearch ? "px-2 text-[#6B6B6B]" : "w-10 border border-[#EDE6E3] bg-white"
              }`}
            >
              {showSearch ? "Cancel" : <SearchIcon className="h-[18px] w-[18px]" />}
            </button>
            <span className="hidden flex-1 lg:block" />
            <button
              onClick={() => setMoreOpen(true)}
              aria-label="Account and pages"
              className={`${showSearch ? "hidden" : "flex"} h-10 w-10 flex-none items-center justify-center rounded-full bg-[#141414] text-[13px] font-bold text-white ring-2 ring-[#E5251B]/0 transition hover:ring-[#E5251B]/40 lg:flex`}
            >
              {initials}
            </button>
          </div>
        </header>
        <main className="w-full max-w-[1280px] px-4 pb-[calc(112px+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16 lg:pt-10">
          {children}
        </main>
      </div>

      {me && tabs.length > 0 && (
        <nav className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 lg:hidden">
          <div
            className="mx-auto grid max-w-[520px] rounded-[24px] border border-white/10 bg-[#141414]/95 p-1.5 shadow-[0_18px_40px_-10px_rgba(20,20,20,.55)] backdrop-blur-xl"
            style={{ gridTemplateColumns: `repeat(${tabs.length + (hasMore ? 1 : 0)}, minmax(0, 1fr))` }}
          >
            {tabs.map((n) => {
              const on = n.key === active;
              return (
                <Link
                  key={n.key}
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 rounded-[18px] py-2 text-[10.5px] font-bold transition-colors ${
                    on ? "bg-white/10 text-white" : "text-white/50 active:bg-white/5"
                  }`}
                >
                  <Icon name={n.key} className={`h-[22px] w-[22px] ${on ? "text-[#FF4A3D]" : ""}`} />
                  {SHORT[n.key] ?? n.label}
                </Link>
              );
            })}
            {hasMore && (
              <button
                onClick={() => setMoreOpen(true)}
                className={`flex flex-col items-center gap-1 rounded-[18px] py-2 text-[10.5px] font-bold transition-colors ${
                  moreActive ? "bg-white/10 text-white" : "text-white/50 active:bg-white/5"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={`h-[22px] w-[22px] ${moreActive ? "text-[#FF4A3D]" : ""}`}>
                  <circle cx="5" cy="12" r="1.9" />
                  <circle cx="12" cy="12" r="1.9" />
                  <circle cx="19" cy="12" r="1.9" />
                </svg>
                More
              </button>
            )}
          </div>
        </nav>
      )}

      {moreOpen && (
        <Sheet onClose={() => setMoreOpen(false)} labelledBy="admin-more-title" width={440}>
          <div className="relative overflow-hidden bg-[#141414] px-5 pb-5 pt-7 text-white sm:pt-5">
            <span
              aria-hidden
              className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full bg-[#E5251B]/50 blur-3xl"
            />
            <div className="relative flex items-center gap-3">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#E5251B] text-sm font-bold">
                {initials}
              </span>
              <div className="min-w-0">
                <div id="admin-more-title" className="truncate text-[15px] font-bold">
                  {email}
                </div>
                {me && (
                  <div className="text-[10px] font-bold tracking-[0.14em] text-white/50">
                    SIGNED IN · {ROLE_LABEL[me.role].toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="p-4">
            <div className="px-1 pb-2.5 text-[10px] font-bold tracking-[0.16em] text-[#6B6B6B]">PAGES</div>
            <div className="grid grid-cols-3 gap-2">
              {items.map((n) => {
                const on = n.key === active;
                return (
                  <Link
                    key={n.key}
                    href={n.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={on ? "page" : undefined}
                    className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-3.5 text-[12px] font-bold transition-colors ${
                      on
                        ? "border-[#141414] bg-[#141414] text-white"
                        : "border-[#EDE6E3] bg-[#FCFAF9] text-[#141414] active:bg-[#F3EEEB]"
                    }`}
                  >
                    <Icon name={n.key} className={`h-6 w-6 ${on ? "text-[#FF4A3D]" : "text-[#6B6B6B]"}`} />
                    {n.label}
                  </Link>
                );
              })}
            </div>
            <button
              onClick={handleLogout}
              className="mt-4 h-12 w-full rounded-2xl border border-[#F3C9C5] text-sm font-bold text-[#B71C14] transition-colors active:bg-[#FDECEA]"
            >
              Log out
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
