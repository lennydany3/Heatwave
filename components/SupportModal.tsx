"use client";

import { useEffect, useState } from "react";
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_LINK } from "@/lib/support";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // Clipboard can be blocked; the value is still on screen to copy by hand.
        }
      }}
      className="text-[13px] font-bold text-[#E5251B]"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// "Contact support" popup with the support email and phone number.
export default function SupportModal({
  open,
  onClose,
  bookingId,
}: {
  open: boolean;
  onClose: () => void;
  bookingId?: string | null;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const subject = encodeURIComponent(bookingId ? `Registration ${bookingId}` : "Heatwave support");

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[#141414]/40 p-0 sm:items-center sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="support-title"
        style={{ fontFamily: "var(--font-satoshi)" }}
        className="w-full max-w-[440px] animate-[hwUp_0.3s_ease_both] overflow-hidden rounded-t-2xl bg-white text-[#141414] sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#EDE6E3] px-6 py-5">
          <div id="support-title" className="text-lg font-black tracking-[-0.03em]">
            Contact support
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#6B6B6B] hover:bg-[#FAF7F5] hover:text-[#141414]"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-6">
          <p className="m-0 text-[15px] leading-relaxed text-[#6B6B6B]">
            We&apos;re happy to help. Reach us on either of these
            {bookingId ? (
              <>
                {" "}
                and mention your booking ID{" "}
                <span className="font-bold tabular-nums text-[#141414]">{bookingId}</span>
              </>
            ) : null}
            .
          </p>

          <div className="mt-5 flex flex-col gap-3">
            <div className="rounded-xl border border-[#EDE6E3] bg-[#FAF7F5] p-4">
              <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">EMAIL</div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <a href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`} className="min-w-0 truncate text-[16px] font-bold">
                  {SUPPORT_EMAIL}
                </a>
                <CopyButton value={SUPPORT_EMAIL} />
              </div>
            </div>
            <div className="rounded-xl border border-[#EDE6E3] bg-[#FAF7F5] p-4">
              <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">PHONE</div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <a href={`tel:${SUPPORT_PHONE_LINK}`} className="text-[16px] font-bold tabular-nums">
                  {SUPPORT_PHONE}
                </a>
                <CopyButton value={SUPPORT_PHONE} />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-[#E5251B] px-6 text-[15px] font-bold text-white hover:bg-[#B71C14]"
            >
              Send an email
            </a>
            <a
              href={`tel:${SUPPORT_PHONE_LINK}`}
              className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-[#141414] px-6 text-[15px] font-bold hover:bg-[#FAF7F5]"
            >
              Call us
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
