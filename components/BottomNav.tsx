"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

const ITEMS: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/dashboard",
    label: "Tickets",
    icon: (
      <>
        <path
          d="M4 7a2 2 0 012-2h12a2 2 0 012 2v2a2.5 2.5 0 000 5v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2.5 2.5 0 000-5V7z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M14 5v13" stroke="currentColor" strokeWidth="2" strokeDasharray="2 2.5" />
      </>
    ),
  },
  {
    href: "/events",
    label: "Events",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
        <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      </>
    ),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: (
      <>
        <circle cx="12" cy="8.5" r="3.8" stroke="currentColor" strokeWidth="2" />
        <path
          d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </>
    ),
  },
];

/** Phone-only tab bar for signed-in pages. Pages using it reserve `BOTTOM_NAV_SPACE` at the bottom. */
export const BOTTOM_NAV_SPACE = "pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-0";

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  if (!user) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-[#EDE6E3] bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md lg:hidden">
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-1.5 text-[11px] font-bold ${
              active ? "text-[#E5251B]" : "text-[#6B6B6B]"
            }`}
          >
            <span
              className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                active ? "bg-[#FDECEA]" : ""
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                {item.icon}
              </svg>
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
