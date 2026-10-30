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
      className="fixed inset-x-4 bottom-28 z-[65] animate-[hwUp_0.3s_ease_both] rounded-2xl border border-[#EDE6E3] bg-white p-5 shadow-[0_12px_32px_rgba(20,20,20,.12)] sm:inset-x-auto sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-[360px]"
      style={{ fontFamily: "var(--font-satoshi)" }}
    >
      <p className="text-[13px] leading-relaxed text-[#6B6B6B]">
        We use cookies that are essential to keep you signed in, and Razorpay sets its own
        cookies to process payments securely. See our{" "}
        <Link href="/privacy" className="font-bold text-[#141414] underline">
          Privacy Policy
        </Link>{" "}
        for details.
      </p>
      <div className="mt-3.5 flex justify-end">
        <button
          onClick={accept}
          className="inline-flex h-9 items-center justify-center rounded-full bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right px-5 text-[13px] font-bold text-white transition-[background-position] duration-400 ease-out hover:bg-left"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
