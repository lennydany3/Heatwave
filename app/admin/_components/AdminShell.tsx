"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type ReactNode } from "react";
import { ADMIN_NAV, type AdminPageKey } from "../_lib/data";

const createBtn =
  "ml-auto inline-flex h-[42px] flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-5 text-sm font-bold text-white transition-[background-position] duration-400 ease-out bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right hover:bg-left";

function NavLinks({
  active,
  itemClassName,
  onNavigate,
}: {
  active: AdminPageKey;
  itemClassName: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {ADMIN_NAV.map((n) => {
        const on = n.key === active;
        return (
          <Link
            key={n.key}
            href={n.href}
            onClick={onNavigate}
            style={{
              background: on ? "#fff" : "transparent",
              color: on ? "#141414" : "#6B6B6B",
            }}
            className={itemClassName}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: on ? "#E5251B" : "transparent" }}
            />
            {n.label}
          </Link>
        );
      })}
    </>
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleSearch(e: ChangeEvent<HTMLInputElement>) {
    onSearchChange(e.target.value);
  }

  return (
    <div
      className="flex min-h-screen bg-white text-[#141414]"
      style={{ fontFamily: "var(--font-satoshi)" }}
    >
      <aside className="sticky top-0 hidden h-screen w-[240px] flex-none flex-col border-r border-[#EDE6E3] bg-[#FAF7F5] p-3.5 lg:flex">
        <div className="flex items-center gap-2.5 px-2.5 pb-6">
          <span className="flex items-center gap-1.5 text-[19px] font-black tracking-[-0.04em]">
            heatwave
            <span className="h-[7px] w-[7px] rounded-full bg-[#E5251B]" />
          </span>
          <span className="text-[10px] font-bold tracking-[0.14em] text-[#6B6B6B]">
            ADMIN
          </span>
        </div>
        <nav className="flex flex-col gap-0.5">
          <NavLinks
            active={active}
            itemClassName="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-bold transition-colors hover:bg-white hover:text-[#141414]"
          />
        </nav>
        <div className="mt-auto border-t border-[#EDE6E3] px-3 py-3.5 text-[13px] text-[#6B6B6B]">
          Signed in as
          <br />
          <span className="font-bold text-[#141414]">Lakshmi Venkatesh</span>
        </div>
      </aside>

      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-[60] bg-[#141414]/36 lg:hidden"
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-[272px] animate-[hwIn_0.25s_ease_both] flex-col gap-0.5 border-r border-[#EDE6E3] bg-[#FAF7F5] p-3.5"
          >
            <div className="px-2.5 pb-6 text-[19px] font-black tracking-[-0.04em]">
              heatwave{" "}
              <span className="text-[10px] font-bold tracking-[0.14em] text-[#6B6B6B]">
                ADMIN
              </span>
            </div>
            <NavLinks
              active={active}
              onNavigate={() => setDrawerOpen(false)}
              itemClassName="flex items-center gap-3 rounded-[10px] px-3 py-3 text-[15px] font-bold"
            />
            <Link
              href="/admin/login"
              className="mt-auto px-3 py-3 text-sm font-bold text-[#E5251B]"
            >
              Log out
            </Link>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-[#EDE6E3] bg-white/96 backdrop-blur-sm">
          <div className="flex items-center gap-3.5 px-4 py-3.5 sm:px-6 lg:px-8">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Menu"
              className="flex h-10 w-10 flex-none flex-col items-center justify-center gap-1 rounded-full border border-[#EDE6E3] lg:hidden"
            >
              <span className="h-[1.5px] w-4 bg-[#141414]" />
              <span className="h-[1.5px] w-4 bg-[#141414]" />
              <span className="h-[1.5px] w-4 bg-[#141414]" />
            </button>
            <div className="relative min-w-0 max-w-[420px] flex-1">
              <input
                value={search}
                onChange={handleSearch}
                placeholder="Search bookings, attendees, events"
                className="h-[42px] w-full rounded-full border border-[#EDE6E3] bg-white pl-[38px] pr-4 text-sm outline-none focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)]"
              />
              <span className="pointer-events-none absolute left-[15px] top-[13px] h-3 w-3 rounded-full border-[1.5px] border-[#6B6B6B]" />
            </div>
            <Link href="/admin/events?create=1" className={createBtn}>
              <span className="hidden sm:inline">+ Create event</span>
              <span className="sm:hidden">+ New</span>
            </Link>
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#141414] text-[13px] font-bold text-white">
              LV
            </span>
          </div>
        </header>
        <main className="w-full max-w-[1280px] px-4 pb-16 pt-5 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
          {children}
        </main>
      </div>
    </div>
  );
}
