"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "hw-cookie-consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // localStorage only exists in the browser, so this can't run during SSR.
    let alreadyAccepted = false;
    try {
      alreadyAccepted = window.localStorage.getItem(STORAGE_KEY) === "accepted";
    } catch {
      // Private browsing / blocked storage — fall back to showing the notice.
    }
    if (!alreadyAccepted) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    }
  }, []);

  function accept() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      // Ignore — worst case the notice reappears next visit.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[65] flex animate-[hwUp_0.3s_ease_both] items-center gap-3 rounded-2xl bg-[#141414] py-2.5 pl-3 pr-2.5 text-white shadow-[0_16px_40px_-12px_rgba(20,20,20,0.5)] sm:inset-x-auto sm:bottom-5 sm:left-5 sm:max-w-[420px]"
      style={{ fontFamily: "var(--font-satoshi)" }}
    >
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white/10">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20.5 12.5A8.5 8.5 0 1111.5 3.5a3 3 0 003.5 3.5 3 3 0 003 3 3 3 0 002.5 2.5z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="10" r="1.1" fill="currentColor" />
          <circle cx="14" cy="15" r="1.1" fill="currentColor" />
          <circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" />
        </svg>
      </span>
      <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-white/75">
        We only use essential cookies to keep you signed in.{" "}
        <Link href="/privacy" className="font-bold text-white underline underline-offset-2">
          Learn more
        </Link>
      </p>
      <button
        onClick={accept}
        className="h-9 flex-none rounded-xl bg-white px-4 text-[13px] font-bold text-[#141414] transition-colors hover:bg-[#F1EAE7]"
      >
        Got it
      </button>
    </div>
  );
}
