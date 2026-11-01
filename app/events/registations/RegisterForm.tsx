"use client";

import Image from "next/image";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  useEffect,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import Navbar, { NAVBAR_OFFSET } from "@/components/Navbar";
import SupportModal from "@/components/SupportModal";
import { compressImage, formatBytes } from "@/lib/compressImage";
import { EVENT } from "@/lib/event";
import type { EventData } from "@/lib/eventData";
import { createClient } from "@/utils/supabase/client";

type FieldKey = "fullName" | "email" | "mobile" | "instagram" | "age";
type Gender = "male" | "female";
type TicketTierStatus = "open" | "coming_soon" | "closed";

type TicketTier = {
  id: string;
  code: string;
  name: string;
  price_male: number | null;
  price_female: number | null;
  status: TicketTierStatus;
  sort_order: number;
};

type EventInfo = {
  id: string;
  name: string;
  venue: string | null;
  starts_at: string | null;
};

type TierAvailability = {
  tierId: string;
  registrationClosed: boolean;
  remaining: number | null;
  invited: boolean;
};

type TicketResult = {
  ticketCode: string;
  tierName?: string;
  eventName?: string;
  venue?: string | null;
  startsAt?: string | null;
  amount?: number;
};

export type InitialWaitlist = {
  status: "waiting" | "invited";
  position: number | null;
};

export type ExistingRegistration = {
  status: "pending" | "paid" | "failed";
  ticketCode: string | null;
  eventName: string | null;
  /** The admin's reason (declined / unsuccessful payments). */
  note?: string | null;
  /** True when the payment was unsuccessful, so the customer may register again. */
  canRetry?: boolean;
};

const UPI_ID = process.env.NEXT_PUBLIC_UPI_ID ?? "";
const UPI_PAYEE_NAME = process.env.NEXT_PUBLIC_UPI_PAYEE_NAME ?? "Heatwave";
const UPI_TXN_RE = /^\d{12}$/;
// Raw files up to 15 MB are accepted and compressed in the browser; what gets
// uploaded (and must stay under the server's 5 MB cap) is the compressed result.
const MAX_RAW_PROOF_BYTES = 15 * 1024 * 1024;
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PROOF_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
const PREVIEWABLE = ["image/png", "image/jpeg", "image/webp"];

// `pa` is left unencoded: several UPI apps reject a percent-encoded "@".
function upiLink(amount: number, note: string) {
  return (
    `upi://pay?pa=${UPI_ID}` +
    `&pn=${encodeURIComponent(UPI_PAYEE_NAME)}` +
    `&am=${amount.toFixed(2)}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(note)}`
  );
}

const RULES: Record<FieldKey, (v: string) => string> = {
  fullName: (v) => (v.trim().length < 2 ? "Enter your full name" : ""),
  email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? "" : "Enter a valid email address"),
  mobile: (v) =>
    v.replace(/\D/g, "").length === 10 ? "" : "Enter a 10-digit mobile number",
  instagram: () => "",
  age: (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 && n < 120 ? "" : "Enter a valid age";
  },
};

const MASK: Partial<Record<FieldKey, (v: string) => string>> = {
  mobile: (v) => v.replace(/\D/g, "").slice(0, 10),
  age: (v) => v.replace(/\D/g, "").slice(0, 3),
};

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN");

// Prefer a tier that's open for registration; otherwise a full / closed one
// (which leads to the waitlist).
function pickTier(list: TicketTier[], avail: Record<string, TierAvailability>): string | null {
  const t =
    list.find((x) => x.status === "open" && !avail[x.id]?.registrationClosed) ??
    list.find((x) => x.status !== "coming_soon");
  return t?.id ?? null;
}

async function fetchAvailability(): Promise<Record<string, TierAvailability>> {
  try {
    const res = await fetch(`/api/events/availability?slug=${EVENT.slug}`, { cache: "no-store" });
    if (!res.ok) return {};
    const data = (await res.json()) as { tiers: TierAvailability[] };
    return Object.fromEntries(data.tiers.map((t) => [t.tierId, t]));
  } catch {
    return {};
  }
}

function downloadIcs(event: EventInfo | null) {
  if (!event) return;
  const start = event.starts_at ? new Date(event.starts_at) : new Date();
  const stamp = start.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const text = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${event.name}\nDTSTART:${stamp}\nLOCATION:${event.venue ?? ""}\nEND:VEVENT\nEND:VCALENDAR`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/calendar" }));
  a.download = "heatwave-ticket.ics";
  a.click();
}

const inputBase =
  "h-[60px] w-full rounded-xl border bg-white px-4 pb-2 pt-6 text-base text-[#141414] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-transparent";

// Action row: pinned to the bottom of the screen on phones so the primary button
// is always reachable, inline on larger screens.
const actionBar =
  "sticky bottom-0 z-10 -mx-5 mt-8 flex items-center justify-between gap-4 border-t border-[#EDE6E3] bg-white px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0";

const btn =
  "inline-flex h-[54px] items-center justify-center gap-2.5 rounded-full px-8 text-base font-bold text-white transition-[background-color,transform] duration-200 ease-out bg-[#E5251B] shadow-[0_8px_18px_-8px_rgba(229,37,27,0.65)] hover:bg-[#CF2017] active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none";

// Cuts half-circle notches into the edges of each ticket half, so the poster
// backdrop shows through them.
function notch(edge: "top" | "bottom"): React.CSSProperties {
  const y = edge === "top" ? "0" : "100%";
  const mask =
    `radial-gradient(circle at 0 ${y}, transparent 11px, #000 11.5px) left / 51% 100% no-repeat, ` +
    `radial-gradient(circle at 100% ${y}, transparent 11px, #000 11.5px) right / 51% 100% no-repeat`;
  return { WebkitMask: mask, mask };
}

function EventThumb({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-[#EDE6E3] bg-[#F3EEEB] ${className}`}
    >
      <Image
        src={EVENT.poster}
        alt={EVENT.posterAlt}
        fill
        sizes="380px"
        className="object-cover"
      />
    </div>
  );
}

type FieldProps = {
  fieldKey: string;
  label: string;
  mode?: string;
  value: string;
  isFocused: boolean;
  error: string;
  ok: boolean;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
};

function Field({
  fieldKey,
  label,
  mode,
  value,
  isFocused,
  error,
  ok,
  onChange,
  onFocus,
  onBlur,
}: FieldProps) {
  const up = isFocused || !!value;
  const border = error || isFocused ? "#E5251B" : "#EDE6E3";
  const ring = isFocused ? "0 0 0 3px rgba(229,37,27,.12)" : "none";

  return (
    <div>
      <div className="relative">
        <input
          id={`hw-${fieldKey}`}
          inputMode={mode as React.HTMLAttributes<HTMLInputElement>["inputMode"]}
          placeholder={label}
          value={value}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          style={{ borderColor: border, boxShadow: ring }}
          className={inputBase}
        />
        <label
          htmlFor={`hw-${fieldKey}`}
          style={{
            top: up ? "9px" : "19px",
            fontSize: up ? "12px" : "16px",
            color: error ? "#C8372D" : isFocused ? "#E5251B" : "#6B6B6B",
          }}
          className="pointer-events-none absolute left-[17px] whitespace-nowrap transition-all duration-150 ease-in-out"
        >
          {label}
        </label>
        {ok && (
          <svg width="18" height="18" viewBox="0 0 24 24" className="absolute right-4 top-[21px]">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              fill="none"
              stroke="#141414"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      {error && <div className="ml-1 mt-1.5 text-[13px] text-[#C8372D]">{error}</div>}
    </div>
  );
}

export default function RegisterForm({
  initialExisting,
  initialWaitlist,
  initialData,
}: {
  initialExisting: ExistingRegistration | null;
  initialWaitlist: InitialWaitlist | null;
  // Event, tiers and seat availability, loaded on the server. Null falls back to
  // fetching them in the browser.
  initialData: EventData | null;
}) {
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [focus, setFocus] = useState<FieldKey | "upiTxnId" | null>(null);
  const [gender, setGender] = useState<Gender | "">("");
  const [genderTouched, setGenderTouched] = useState(false);

  const [event, setEvent] = useState<EventInfo | null>(initialData?.event ?? null);
  const [tiers, setTiers] = useState<TicketTier[]>(initialData?.tiers ?? []);
  const [tiersLoading, setTiersLoading] = useState(!initialData);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(
    initialData ? pickTier(initialData.tiers, initialData.availability) : null
  );
  const [availability, setAvailability] = useState<Record<string, TierAvailability>>(
    initialData?.availability ?? {}
  );
  const [joining, setJoining] = useState(false);
  const [waitlistError, setWaitlistError] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  // Already queued (from the server) or just joined: show the waiting screen
  // instead of the form. An invited customer sees the normal form instead.
  const [waitlisted, setWaitlisted] = useState<{ position: number | null } | null>(
    initialWaitlist?.status === "waiting" ? { position: initialWaitlist.position } : null
  );
  const invited = initialWaitlist?.status === "invited";

  const [upiTxnId, setUpiTxnId] = useState("");
  const [txnTouched, setTxnTouched] = useState(false);
  const [proof, setProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState("");
  const [proofError, setProofError] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [proofNote, setProofNote] = useState("");
  const [payTouched, setPayTouched] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [existing, setExisting] = useState<ExistingRegistration | null>(initialExisting);
  const [ticketResult, setTicketResult] = useState<TicketResult | null>(null);

  useEffect(() => {
    // Prefills the email field once the auth session resolves client-side
    // (it isn't known synchronously during the initial render).
    if (user?.email) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValues((v) => (v.email ? v : { ...v, email: user.email ?? "" }));
    }
  }, [user]);

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data: eventRow } = await supabase
        .from("events")
        .select("id, name, venue, starts_at")
        .eq("slug", EVENT.slug)
        .single();
      if (!eventRow) {
        setTiersLoading(false);
        return;
      }
      const [{ data: tierRows }, avail] = await Promise.all([
        supabase
          .from("ticket_tiers")
          .select("id, code, name, price_male, price_female, status, sort_order")
          .eq("event_id", eventRow.id)
          .order("sort_order"),
        fetchAvailability(),
      ]);
      if (cancelled) return;
      setEvent(eventRow);
      const list = tierRows ?? [];
      setTiers(list);
      setAvailability(avail);
      const pick = pickTier(list, avail);
      if (pick) setSelectedTierId(pick);
      setTiersLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  // Server-provided props are fixed for the life of the page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!proofPreview) return;
    return () => URL.revokeObjectURL(proofPreview);
  }, [proofPreview]);

  function go(nextStep: number) {
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function fieldValue(key: FieldKey) {
    return values[key] ?? "";
  }

  function onFieldChange(key: FieldKey) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const masked = MASK[key] ? MASK[key]!(raw) : raw;
      setValues((s) => ({ ...s, [key]: masked }));
    };
  }

  function check(keys: FieldKey[]) {
    setTouched((s) => {
      const next = { ...s };
      keys.forEach((k) => (next[k] = true));
      return next;
    });
    setGenderTouched(true);
    const fieldsOk = keys.every((k) => !RULES[k](values[k] ?? ""));
    return fieldsOk && !!gender;
  }

  function fieldProps(key: FieldKey): Omit<FieldProps, "fieldKey" | "label" | "mode"> {
    const value = fieldValue(key);
    const isFocused = focus === key;
    const error = touched[key] ? RULES[key](value) : "";
    const ok = !error && !!touched[key] && !isFocused && !!value;
    return {
      value,
      isFocused,
      error,
      ok,
      onChange: onFieldChange(key),
      onFocus: () => setFocus(key),
      onBlur: () => {
        setFocus(null);
        setTouched((s) => ({ ...s, [key]: true }));
      },
    };
  }

  const selectedTier = tiers.find((t) => t.id === selectedTierId) ?? null;
  const amount =
    selectedTier && gender
      ? (gender === "male" ? selectedTier.price_male : selectedTier.price_female) ?? 0
      : 0;

  // A tier is "closed" for new registrations when it's manually closed or full.
  // Customers then join the waitlist instead of paying.
  const isClosed = (t: TicketTier) =>
    t.status === "closed" || (t.status === "open" && !!availability[t.id]?.registrationClosed);
  const selectedClosed = !!selectedTier && isClosed(selectedTier);

  async function joinWaitlist() {
    if (!selectedTier || !gender || joining) return;
    setJoining(true);
    setWaitlistError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketTierId: selectedTier.id,
          fullName: values.fullName ?? "",
          email: values.email ?? "",
          mobile: values.mobile ?? "",
          instagram: values.instagram ?? "",
          age: Number(values.age ?? 0),
          gender,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.code === "already_registered") {
          setExisting({ status: "pending", ticketCode: null, eventName: event?.name ?? null });
          return;
        }
        setWaitlistError(data?.error || "Could not join the waitlist");
        return;
      }
      setWaitlisted({ position: data.position ?? null });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setWaitlistError("Something went wrong. Try again.");
    } finally {
      setJoining(false);
    }
  }

  const txnError = UPI_TXN_RE.test(upiTxnId) ? "" : "Enter the 12-digit UPI transaction ID";
  const showTxnError = (txnTouched || payTouched) && focus !== "upiTxnId" ? txnError : "";
  const proofMissing = payTouched && !proof ? "Upload your payment screenshot" : "";
  const confirmMissing = payTouched && !confirmed;

  async function onProofChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!PROOF_TYPES.includes(file.type)) {
      setProofError("Screenshot must be a PNG, JPG, WEBP or HEIC image");
      return;
    }
    if (file.size > MAX_RAW_PROOF_BYTES) {
      setProofError("Screenshot must be under 15 MB");
      return;
    }
    setProofError("");
    setCompressing(true);
    const result = await compressImage(file);
    setCompressing(false);
    if (result.file.size > MAX_PROOF_BYTES) {
      setProofError("This image is still too large after compression. Try a smaller screenshot.");
      return;
    }
    setProof(result.file);
    setProofNote(
      result.compressed
        ? `Compressed ${formatBytes(result.originalBytes)} → ${formatBytes(result.file.size)}`
        : ""
    );
    setProofPreview(PREVIEWABLE.includes(result.file.type) ? URL.createObjectURL(result.file) : "");
  }

  async function copyUpiId() {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked (permissions / insecure origin); the ID is
      // still visible on screen to copy by hand.
    }
  }

  async function handleSubmit() {
    if (submitting || !selectedTier || !gender) return;
    setPayTouched(true);
    if (txnError || !proof || !confirmed) return;
    setSubmitError("");
    setSubmitting(true);

    const form = new FormData();
    form.set("ticketTierId", selectedTier.id);
    form.set("fullName", values.fullName ?? "");
    form.set("email", values.email ?? "");
    form.set("mobile", values.mobile ?? "");
    form.set("instagram", values.instagram ?? "");
    form.set("age", values.age ?? "");
    form.set("gender", gender);
    form.set("upiTxnId", upiTxnId);
    form.set("screenshot", proof);

    try {
      const res = await fetch("/api/registrations/submit", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "already_registered") {
          setExisting({ status: "pending", ticketCode: null, eventName: event?.name ?? null });
          return;
        }
        if (data.code === "registration_full") {
          // Seats ran out while this customer was filling the form.
          setAvailability(await fetchAvailability());
          go(1);
          return;
        }
        setSubmitError(data.error || "Could not complete payment");
        return;
      }
      setTicketResult(data);
      go(3);
    } catch {
      setSubmitError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const steps = ["Details", "Tickets", "Payment"];

  if (waitlisted) {
    return (
      <Page>
        <main className="mx-auto flex max-w-[640px] flex-col items-center px-5 py-10 text-center sm:px-6 sm:py-24">
          <div className="flex h-24 w-24 animate-[hwPop_0.5s_cubic-bezier(.2,.9,.3,1.2)_both] items-center justify-center rounded-full bg-[#141414]">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="1.8" />
              <path d="M12 7v5l3 2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="m-0 mt-7 text-[40px] font-black leading-[0.95] tracking-[-0.05em] sm:text-[60px]">
            You&apos;re on the waitlist
          </h1>
          <p className="mt-3.5 text-[19px] font-bold tracking-[-0.01em]">
            Hang tight — good things come to those who wait. 🌊
          </p>
          {waitlisted.position && (
            <div className="mt-5 inline-flex rounded-full border border-[#EDE6E3] bg-[#FAF7F5] px-4 py-2 text-sm">
              Your place in the queue:{" "}
              <span className="ml-1.5 font-bold tabular-nums">#{waitlisted.position}</span>
            </div>
          )}
          <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-[#6B6B6B]">
            Registration for {EVENT.name} is full right now, but you&apos;re in line. Seats open up
            when a payment can&apos;t be verified, and we invite people in the order they joined.
            When it&apos;s your turn, a seat is held for you and this page turns into your
            registration form — no payment needed until then.
          </p>
          <div className="mt-6 w-full max-w-[460px] rounded-xl bg-[#FFF6E5] px-5 py-4 text-left text-sm leading-relaxed text-[#8A5A00]">
            <span className="font-bold">What happens next:</span> keep an eye on{" "}
            <span className="font-bold">My Tickets</span> and your email
            {values.email ? ` (${values.email})` : ""}. You can leave this page — your place stays
            saved.
          </div>
          <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <Link href="/dashboard" className={btn}>
              Go to My Tickets
            </Link>
            <Link
              href="/"
              className="inline-flex h-[54px] items-center justify-center rounded-full border border-[#141414] px-7 text-[15px] font-bold transition-colors hover:bg-[#FAF7F5]"
            >
              Back to event page
            </Link>
          </div>
        </main>
      </Page>
    );
  }

  if (existing && !ticketResult) {
    const failed = existing.status === "failed";
    const verified = existing.status === "paid";
    const retry = failed && !!existing.canRetry;
    const name = existing.eventName ?? event?.name ?? EVENT.name;
    const tone = failed
      ? { solid: "#E5251B", ring: "rgba(229,37,27,0.2)", bg: "#FDECEA", fg: "#B71C14" }
      : verified
        ? { solid: "#3F8A5A", ring: "rgba(63,138,90,0.22)", bg: "#EEF4EF", fg: "#2F6B45" }
        : { solid: "#D99A1E", ring: "rgba(217,154,30,0.22)", bg: "#FFF6E5", fg: "#8A5A00" };

    const heading = verified
      ? "You're registered"
      : failed
        ? retry
          ? "Payment not found"
          : "Registration declined"
        : "Registration received";
    const lead = verified
      ? "Your payment is verified. See you on the water!"
      : failed
        ? retry
          ? "We couldn't find your payment. You can register again with a fresh payment."
          : "We couldn't approve this registration, so the ticket isn't valid at the gate."
        : "We're verifying your UPI payment. Your QR works at the gate once it's verified.";
    const stubNote = verified
      ? "Show this QR at the gate."
      : failed
        ? "This ticket isn't valid for entry."
        : "Your QR unlocks once the payment is verified.";

    const statusIcon = verified ? (
      <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    ) : failed ? (
      <path d="M7 7l10 10M17 7L7 17" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" />
    ) : (
      <>
        <circle cx="12" cy="12" r="8.5" stroke="#fff" strokeWidth="2" fill="none" />
        <path d="M12 7.5v4.8l3 1.8" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    );

    return (
      <Page>
        <main className={`relative isolate flex min-h-dvh items-center overflow-hidden bg-[#120C0B] ${NAVBAR_OFFSET}`}>
          <div className="pointer-events-none absolute inset-0 -z-10">
            <Image
              src={EVENT.poster}
              alt=""
              fill
              priority
              sizes="100vw"
              className="scale-125 object-cover opacity-80 blur-2xl"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,12,11,0.55)_0%,rgba(18,12,11,0.75)_55%,rgba(18,12,11,0.92)_100%)]" />
            <div
              className="absolute left-1/2 top-[-120px] h-[340px] w-[560px] -translate-x-1/2 rounded-full"
              style={{ background: `radial-gradient(closest-side, ${tone.ring}, transparent)` }}
            />
          </div>

          <div className="relative mx-auto flex w-full max-w-[420px] flex-col items-center px-5 py-6 sm:py-12">
            <div
              className="flex h-12 w-12 animate-[hwPop_0.5s_cubic-bezier(.2,.9,.3,1.2)_both] items-center justify-center rounded-full"
              style={{ background: tone.solid, boxShadow: `0 0 0 6px ${tone.ring}` }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                {statusIcon}
              </svg>
            </div>
            <h1 className="m-0 mt-3.5 animate-[hwUp_0.6s_ease-out_0.15s_both] text-center text-[32px] font-black leading-none tracking-[-0.045em] text-white sm:text-[40px]">
              {heading}
            </h1>
            <p className="mt-2 max-w-[34ch] animate-[hwUp_0.6s_ease-out_0.25s_both] text-center text-[14px] leading-snug text-white/65">
              {lead}
            </p>

            {/* Ticket */}
            <div className="mt-5 w-full animate-[hwUp_0.7s_ease-out_0.35s_both] text-left drop-shadow-[0_24px_36px_rgba(0,0,0,0.5)] sm:mt-7">
              <div className="overflow-hidden rounded-t-[22px] bg-white" style={notch("bottom")}>
                <div className="relative aspect-[19/10] overflow-hidden bg-[#141414]">
                  <Image
                    src={EVENT.poster}
                    alt={EVENT.posterAlt}
                    fill
                    priority
                    sizes="420px"
                    className={`object-cover object-top ${failed ? "grayscale-[0.7]" : ""}`}
                  />
                  <div className="absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(20,20,20,0.45),transparent)]" />
                  <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-white backdrop-blur-md">
                      E-TICKET
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${!verified && !failed ? "animate-[hwPulse_1.4s_ease_infinite]" : ""}`}
                        style={{ background: tone.solid }}
                      />
                      {verified ? "Verified" : failed ? (retry ? "Payment failed" : "Declined") : "Verification pending"}
                    </span>
                  </div>
                </div>

                <div className="px-4 pt-4 sm:px-5">
                  <div className="text-[26px] font-black leading-none tracking-[-0.045em]">{name}</div>
                  <div className="mt-1 text-[13px] font-bold text-[#E5251B]">{EVENT.presenter}</div>
                </div>

                <div className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[#EDE6E3] px-4 pb-5 pt-3.5 sm:px-5">
                  {[
                    { label: "DATE", value: EVENT.dateLabel },
                    { label: "TIME", value: EVENT.timeLabel },
                  ].map((d) => (
                    <div key={d.label} className="min-w-0">
                      <div className="text-[10px] font-bold tracking-[0.14em] text-[#9A918D]">{d.label}</div>
                      <div className="mt-0.5 truncate text-[14px] font-bold leading-snug">{d.value}</div>
                    </div>
                  ))}
                  <a
                    href={EVENT.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="col-span-2 flex items-center justify-between gap-3 rounded-xl bg-[#FAF7F5] px-3 py-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-none text-[#E5251B]">
                        <path
                          d="M12 21s-7-6.2-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.8 12 21 12 21z"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <circle cx="12" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      <span className="truncate text-[13px] font-bold">{EVENT.venue}</span>
                    </span>
                    <span className="flex-none text-[12px] font-bold text-[#E5251B]">Directions →</span>
                  </a>
                  {failed && existing.note && (
                    <div className="col-span-2 rounded-xl bg-[#FDECEA] px-3 py-2.5 text-[13px] leading-snug text-[#B71C14]">
                      <span className="font-bold">Reason:</span> {existing.note}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-b-[22px] bg-white" style={notch("top")}>
                <div className="mx-5 border-t-2 border-dashed border-[#EDE6E3]" />
                <div className="flex items-center gap-4 px-4 pb-4 pt-4 sm:px-5">
                  <div className="relative flex h-[108px] w-[108px] flex-none items-center justify-center overflow-hidden rounded-xl border border-[#EDE6E3] bg-white p-2">
                    {existing.ticketCode && !failed ? (
                      <div style={verified ? undefined : { filter: "blur(5px)", opacity: 0.4 }}>
                        <QRCodeSVG value={existing.ticketCode} size={112} className="h-[92px] w-[92px]" />
                      </div>
                    ) : (
                      <div className="h-full w-full rounded-lg bg-[repeating-linear-gradient(45deg,#FDECEA_0_6px,#FFF8F7_6px_12px)]" />
                    )}
                    {!verified && (
                      <span
                        className="absolute flex h-10 w-10 items-center justify-center rounded-full"
                        style={{ background: tone.bg }}
                      >
                        {failed ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M7 7l10 10M17 7L7 17" stroke={tone.fg} strokeWidth="2.4" strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <rect x="5" y="11" width="14" height="9" rx="2" stroke={tone.fg} strokeWidth="2" />
                            <path d="M8 11V8a4 4 0 018 0v3" stroke={tone.fg} strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold tracking-[0.14em] text-[#9A918D]">BOOKING ID</div>
                    <div
                      className="mt-0.5 font-mono text-[19px] font-bold tracking-[-0.02em] tabular-nums"
                      style={failed ? { textDecoration: "line-through", color: "#9A918D" } : undefined}
                    >
                      {existing.ticketCode ?? "—"}
                    </div>
                    <div className="mt-1.5 text-[12px] leading-snug text-[#6B6B6B]">{stubNote}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid w-full animate-[hwUp_0.6s_ease-out_0.5s_both] grid-cols-2 gap-3 sm:mt-7">
              {retry ? (
                <button onClick={() => setExisting(null)} className={`${btn} col-span-2 !h-12 !px-3 text-sm`}>
                  Register again →
                </button>
              ) : (
                <Link href="/dashboard" className={`${btn} !h-12 !px-3 text-sm ${failed ? "" : "col-span-2"}`}>
                  Go to My Tickets →
                </Link>
              )}
              {failed && !retry && (
                <button
                  type="button"
                  onClick={() => setSupportOpen(true)}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/35 bg-white/10 px-3 text-sm font-bold text-white backdrop-blur-md transition-colors hover:bg-white hover:text-[#141414]"
                >
                  Contact support
                </button>
              )}
            </div>
            <Link
              href={retry ? "/dashboard" : "/"}
              className="mt-4 text-[13px] font-bold text-white/60 hover:text-white"
            >
              {retry ? "Back to My Tickets" : "Back to event page"}
            </Link>
          </div>
        </main>
        <SupportModal
          open={supportOpen}
          onClose={() => setSupportOpen(false)}
          bookingId={existing.ticketCode}
        />
      </Page>
    );
  }

  if (step === 3 && ticketResult) {
    const who = values.fullName || user?.email || "";
    const firstName = values.fullName?.trim().split(/\s+/)[0] ?? "";
    const details = [
      { label: "DATE", value: EVENT.dateLabel },
      { label: "TIME", value: EVENT.timeLabel },
      { label: "ATTENDEE", value: who },
      { label: "TICKET", value: ticketResult.tierName ?? selectedTier?.name ?? "" },
    ];

    return (
      <Page>
        <main className={`relative isolate flex min-h-dvh items-center overflow-hidden bg-[#120C0B] ${NAVBAR_OFFSET}`}>
          {/* Poster backdrop: blurred and darkened so the ticket stays the focus */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <Image
              src={EVENT.poster}
              alt=""
              fill
              priority
              sizes="100vw"
              className="scale-125 object-cover opacity-80 blur-2xl"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,12,11,0.55)_0%,rgba(18,12,11,0.75)_55%,rgba(18,12,11,0.92)_100%)]" />
            <div className="absolute left-1/2 top-[-120px] h-[340px] w-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(229,37,27,0.35),transparent)]" />
          </div>

          <div className="relative mx-auto flex w-full max-w-[420px] flex-col items-center px-5 py-6 sm:py-12">
            <div className="relative flex h-12 w-12 items-center justify-center">
              <span className="hw-celebrate pointer-events-none absolute inset-0 animate-[hwRing_1.2s_ease-out_0.35s_both] rounded-full bg-[#E5251B]" />
              <span className="hw-celebrate pointer-events-none absolute inset-0 animate-[hwRing_1.2s_ease-out_0.6s_both] rounded-full bg-[#E5251B]" />
              {[
                ["-130px", "-40px", "200deg", "#E5251B"],
                ["-80px", "-70px", "-160deg", "#F5A623"],
                ["-25px", "-80px", "240deg", "#FFFFFF"],
                ["40px", "-75px", "-220deg", "#E5251B"],
                ["95px", "-60px", "180deg", "#F5A623"],
                ["140px", "-10px", "-200deg", "#FFFFFF"],
                ["-140px", "20px", "260deg", "#F5A623"],
                ["120px", "45px", "-240deg", "#E5251B"],
                ["-95px", "55px", "220deg", "#FFFFFF"],
                ["-40px", "70px", "-180deg", "#E5251B"],
                ["50px", "75px", "200deg", "#F5A623"],
                ["0px", "-95px", "300deg", "#E5251B"],
              ].map(([dx, dy, rot, color], i) => (
                <span
                  key={i}
                  className="hw-celebrate pointer-events-none absolute left-1/2 top-1/2 -ml-1 -mt-1.5 h-3 w-2 animate-[hwBurst_1.1s_cubic-bezier(.2,.8,.3,1)_both] rounded-[2px]"
                  style={
                    {
                      "--dx": dx,
                      "--dy": dy,
                      "--rot": rot,
                      backgroundColor: color,
                      animationDelay: `${0.3 + (i % 4) * 0.03}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
              <div className="relative flex h-12 w-12 animate-[hwPop_0.5s_cubic-bezier(.2,.9,.3,1.2)_both] items-center justify-center rounded-full bg-[#E5251B] shadow-[0_0_0_6px_rgba(229,37,27,0.18)]">
                <svg viewBox="0 0 24 24" className="h-6 w-6">
                  <path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="30"
                    className="animate-[hwDraw_0.45s_ease-out_0.35s_both]"
                  />
                </svg>
              </div>
            </div>
            <h1 className="m-0 mt-3.5 animate-[hwUp_0.6s_ease-out_0.45s_both] text-center text-[32px] font-black leading-none tracking-[-0.045em] text-white sm:text-[40px]">
              You&apos;re in{firstName ? `, ${firstName}` : ""}!
            </h1>
            <p className="mt-1.5 animate-[hwUp_0.6s_ease-out_0.55s_both] text-center text-[13px] text-white/65 sm:text-sm">
              Booking confirmed · saved to My Tickets
            </p>

            {/* Ticket */}
            <div className="mt-5 w-full animate-[hwUp_0.7s_ease-out_0.7s_both] text-left drop-shadow-[0_24px_36px_rgba(0,0,0,0.5)] sm:mt-7">
              <div className="overflow-hidden rounded-t-[22px] bg-white" style={notch("bottom")}>
                <div className="relative aspect-[19/10] overflow-hidden bg-[#141414]">
                  <Image
                    src={EVENT.poster}
                    alt={EVENT.posterAlt}
                    fill
                    priority
                    sizes="420px"
                    className="object-cover object-top"
                  />
                  <div className="absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,rgba(20,20,20,0.45),transparent)]" />
                  <div className="absolute inset-x-4 top-4 flex items-center justify-between gap-2">
                    <span className="rounded-full bg-black/35 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-white backdrop-blur-md">
                      E-TICKET
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF6E5] px-2.5 py-1 text-[11px] font-bold text-[#8A5A00]">
                      <span className="h-1.5 w-1.5 animate-[hwPulse_1.4s_ease_infinite] rounded-full bg-[#D99A1E]" />
                      Verification pending
                    </span>
                  </div>
                </div>

                <div className="px-4 pt-4 sm:px-5">
                  <div className="text-[26px] font-black leading-none tracking-[-0.045em]">
                    {ticketResult.eventName ?? EVENT.name}
                  </div>
                  <div className="mt-1 text-[13px] font-bold text-[#E5251B]">{EVENT.presenter}</div>
                </div>

                <div className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[#EDE6E3] px-4 pb-5 pt-3.5 sm:px-5">
                  {details.map((d) => (
                    <div key={d.label} className="min-w-0">
                      <div className="text-[10px] font-bold tracking-[0.14em] text-[#9A918D]">
                        {d.label}
                      </div>
                      <div className="mt-0.5 truncate text-[14px] font-bold leading-snug">
                        {d.value}
                      </div>
                    </div>
                  ))}
                  <a
                    href={EVENT.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="col-span-2 flex items-center justify-between gap-3 rounded-xl bg-[#FAF7F5] px-3 py-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-none text-[#E5251B]">
                        <path
                          d="M12 21s-7-6.2-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.8 12 21 12 21z"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <circle cx="12" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="2" />
                      </svg>
                      <span className="truncate text-[13px] font-bold">{EVENT.venue}</span>
                    </span>
                    <span className="flex-none text-[12px] font-bold text-[#E5251B]">Directions →</span>
                  </a>
                </div>
              </div>

              <div className="rounded-b-[22px] bg-white" style={notch("top")}>
                <div className="mx-5 border-t-2 border-dashed border-[#EDE6E3]" />
                <div className="flex items-center gap-4 px-4 pb-4 pt-4 sm:px-5">
                  <div className="flex-none rounded-xl border border-[#EDE6E3] bg-white p-2">
                    <QRCodeSVG value={ticketResult.ticketCode} size={112} className="h-[92px] w-[92px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold tracking-[0.14em] text-[#9A918D]">
                      BOOKING ID
                    </div>
                    <div className="mt-0.5 font-mono text-[19px] font-bold tracking-[-0.02em] tabular-nums">
                      {ticketResult.ticketCode}
                    </div>
                    <div className="mt-1.5 text-[12px] leading-snug text-[#6B6B6B]">
                      Show at the gate. Activates once UPI ref{" "}
                      <span className="font-bold tabular-nums text-[#141414]">{upiTxnId}</span> is
                      verified.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid w-full animate-[hwUp_0.6s_ease-out_0.9s_both] grid-cols-2 gap-3 sm:mt-7">
              <button onClick={() => downloadIcs(event)} className={`${btn} !h-12 !px-3 text-sm`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="2" />
                  <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Add to calendar
              </button>
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/35 bg-white/10 px-3 text-sm font-bold text-white backdrop-blur-md transition-colors hover:bg-white hover:text-[#141414]"
              >
                My Tickets →
              </Link>
            </div>
            <Link
              href="/"
              className="mt-4 text-[13px] font-bold text-white/60 hover:text-white"
            >
              Back to event page
            </Link>
          </div>
        </main>
      </Page>
    );
  }

  return (
    <Page>
      <main className="mx-auto max-w-[1200px] px-5 pb-10 pt-6 sm:px-6 sm:py-10 sm:pb-24">
        <div className="flex items-start gap-12">
          <div className="min-w-0 max-w-[720px] flex-1">
            <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">REGISTRATION</div>
            <h1 className="m-0 mt-3 text-[34px] font-black leading-[1] tracking-[-0.045em] sm:text-[52px]">
              Get your ticket
            </h1>

            <div className="mt-5 flex items-center gap-3.5 rounded-xl border border-[#EDE6E3] bg-[#FAF7F5] p-3 sm:mt-6 sm:gap-4 lg:hidden">
              <EventThumb className="aspect-[4/5] w-16 flex-none" />
              <div className="min-w-0 text-sm leading-relaxed text-[#6B6B6B]">
                <div className="text-[15px] font-black leading-tight tracking-[-0.02em] text-[#141414] sm:text-base">
                  {EVENT.name} · {EVENT.presenter}
                </div>
                {EVENT.dateLabel} · {EVENT.timeLabel}
                <br />
                {EVENT.venueShort}
              </div>
            </div>

            <div className="mt-6 h-[3px] overflow-hidden rounded-full bg-[#EDE6E3] sm:mt-8">
              <div
                className="h-full rounded-full bg-[#E5251B] transition-[width] duration-500 ease-out"
                style={{ width: `${((Math.min(step, 2) + 1) / 3) * 100}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:flex sm:gap-7">
              {steps.map((label, i) => (
                <button
                  key={label}
                  onClick={() => i < step && go(i)}
                  disabled={i >= step}
                  style={{ cursor: i < step ? "pointer" : "default" }}
                  className="flex flex-col items-start gap-0.5 py-1 text-sm font-bold sm:flex-row sm:gap-2 sm:py-0"
                >
                  <span style={{ color: i <= step ? "#E5251B" : "#6B6B6B" }}>0{i + 1}</span>
                  <span style={{ color: i <= step ? "#141414" : "#6B6B6B" }}>{label}</span>
                </button>
              ))}
            </div>

            {step === 0 && (
              <section className="mt-7 sm:mt-10">
                {invited && (
                  <div className="mb-6 flex items-start gap-3 rounded-xl bg-[#EEF4EF] px-5 py-4 text-sm leading-relaxed text-[#2F6B45]">
                    <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-[#3F8A5A]" />
                    <span>
                      <span className="font-bold">Good news — a seat opened up for you!</span> You
                      came off the waitlist and your seat is held. Complete your registration and
                      payment to lock it in.
                    </span>
                  </div>
                )}
                <div className="mb-8 rounded-xl border border-[#EDE6E3] bg-[#FAF7F5] p-5 sm:mb-10 sm:p-6">
                  <div className="text-xs font-bold tracking-[0.14em] text-[#E5251B]">
                    {EVENT.tagline.toUpperCase()}
                  </div>
                  <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[#6B6B6B]">
                    {EVENT.description.map((p, i) => (
                      <p
                        key={p}
                        className={`m-0 ${i > 0 && !descOpen ? "hidden sm:block" : ""}`}
                      >
                        {p}
                      </p>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDescOpen((o) => !o)}
                    className="mt-2 text-sm font-bold text-[#E5251B] sm:hidden"
                  >
                    {descOpen ? "Show less" : "Read more"}
                  </button>
                  <div className="mt-3 text-sm font-bold text-[#141414] sm:mt-4">{EVENT.gateNote}</div>
                </div>
                <h2 className="m-0 mb-5 text-[20px] font-bold tracking-[-0.02em] sm:mb-6 sm:text-[22px]">
                  Your details
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field fieldKey="fullName" label="Full name" {...fieldProps("fullName")} />
                  <Field fieldKey="email" label="Email" mode="email" {...fieldProps("email")} />
                  <Field fieldKey="mobile" label="Mobile number" mode="tel" {...fieldProps("mobile")} />
                  <Field
                    fieldKey="instagram"
                    label="Instagram (optional)"
                    {...fieldProps("instagram")}
                  />
                  <Field fieldKey="age" label="Age" mode="numeric" {...fieldProps("age")} />
                </div>

                <div className="mt-5">
                  <div className="mb-2.5 text-sm font-bold text-[#6B6B6B]">Gender</div>
                  <div className="grid grid-cols-2 gap-3 sm:flex">
                    {(["male", "female"] as Gender[]).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        style={{
                          borderColor: gender === g ? "#E5251B" : "#EDE6E3",
                          boxShadow: gender === g ? "0 0 0 1px #E5251B" : "none",
                        }}
                        className="h-12 rounded-full border bg-white px-6 text-sm font-bold capitalize transition-transform duration-150 hover:-translate-y-0.5"
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                  {genderTouched && !gender && (
                    <div className="mt-1.5 text-[13px] text-[#C8372D]">
                      Select a gender to see your price
                    </div>
                  )}
                </div>

                <div className={`${actionBar} sm:justify-end`}>
                  <button
                    onClick={() =>
                      check(["fullName", "email", "mobile", "instagram", "age"]) && go(1)
                    }
                    className={`flex-1 sm:flex-none ${btn}`}
                  >
                    Continue to tickets →
                  </button>
                </div>
              </section>
            )}

            {step === 1 && (
              <section className="mt-7 sm:mt-10">
                <h2 className="m-0 mb-5 text-[20px] font-bold tracking-[-0.02em] sm:mb-6 sm:text-[22px]">
                  Choose a ticket
                </h2>
                {tiersLoading ? (
                  <div className="h-[140px] animate-[hwPulse_1.4s_ease_infinite] rounded-xl border border-[#EDE6E3] bg-[#FAF7F5]" />
                ) : (
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    {tiers.map((tier) => {
                      const closed = isClosed(tier);
                      const open = tier.status === "open" && !closed;
                      const selectable = tier.status !== "coming_soon";
                      const on = tier.id === selectedTierId;
                      const price = gender === "male" ? tier.price_male : tier.price_female;
                      const left = availability[tier.id]?.remaining;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          disabled={!selectable}
                          onClick={() => selectable && setSelectedTierId(tier.id)}
                          style={{
                            borderColor: on ? "#E5251B" : "#EDE6E3",
                            boxShadow: on ? "0 0 0 1px #E5251B" : "none",
                            opacity: selectable ? 1 : 0.55,
                            cursor: selectable ? "pointer" : "not-allowed",
                          }}
                          className="relative flex flex-col gap-1.5 rounded-xl border bg-white p-5 text-left transition-transform sm:p-[22px] duration-200 enabled:hover:-translate-y-0.5"
                        >
                          {on && selectable && (
                            <span className="absolute right-4 top-4 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#E5251B]">
                              <svg width="12" height="12" viewBox="0 0 24 24">
                                <path
                                  d="M5 12.5l4.5 4.5L19 7.5"
                                  fill="none"
                                  stroke="#fff"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          )}
                          <span className="text-xs font-bold uppercase tracking-[0.12em] text-[#6B6B6B]">
                            {tier.name}
                          </span>
                          <span className="text-[28px] font-black tracking-[-0.03em]">
                            {selectable && price ? fmt(price) : "× × ×"}
                          </span>
                          <span
                            className="text-sm leading-snug"
                            style={{ color: closed ? "#B71C14" : "#6B6B6B" }}
                          >
                            {!selectable
                              ? "Announced soon"
                              : closed
                                ? "Registration full · join the waitlist"
                                : left !== null && left !== undefined && left <= 10
                                  ? `Only ${left} seat${left === 1 ? "" : "s"} left`
                                  : "Limited early-bird price"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedClosed && (
                  <div className="mt-5 rounded-xl bg-[#FFF6E5] px-5 py-4 text-sm leading-relaxed text-[#8A5A00]">
                    <span className="font-bold">
                      Registration for {selectedTier?.name} is full right now.
                    </span>{" "}
                    Join the waitlist with the details you just entered. Seats free up when payments
                    can&apos;t be verified, and we&apos;ll invite people in order. You won&apos;t be
                    charged now.
                  </div>
                )}
                {waitlistError && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-[#C8372D]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#E5251B]" />
                    {waitlistError}
                  </div>
                )}

                <div className={actionBar}>
                  <button
                    onClick={() => go(step - 1)}
                    className="h-12 flex-none pr-2 text-[15px] font-bold text-[#6B6B6B] hover:text-[#141414]"
                  >
                    ← Back
                  </button>
                  {selectedClosed ? (
                    <button
                      onClick={joinWaitlist}
                      disabled={joining || !selectedTier}
                      className={`flex-1 sm:min-w-[200px] sm:flex-none ${btn}`}
                    >
                      {joining ? "Joining…" : "Join waitlist →"}
                    </button>
                  ) : (
                    <button onClick={() => selectedTier && go(2)} disabled={!selectedTier} className={`flex-1 sm:flex-none ${btn}`}>
                      Continue to payment →
                    </button>
                  )}
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="mt-7 sm:mt-10">
                <h2 className="m-0 mb-5 text-[20px] font-bold tracking-[-0.02em] sm:mb-6 sm:text-[22px]">Pay with UPI</h2>
                <div className="rounded-xl border border-[#EDE6E3] px-4 py-3.5 sm:p-5">
                  <div className="flex justify-between gap-3 text-[15px]">
                    <span>{selectedTier?.name}</span>
                    <span className="tabular-nums font-bold">{fmt(amount)}</span>
                  </div>
                </div>

                {UPI_ID ? (
                  <div className="mt-4 flex flex-col items-stretch gap-5 rounded-xl border border-[#EDE6E3] bg-[#FAF7F5] p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
                    <div className="order-2 flex flex-col items-center gap-2.5 sm:order-1">
                      <div className="flex-none rounded-xl border border-[#EDE6E3] bg-white p-2 sm:p-3">
                        <QRCodeSVG
                          value={upiLink(amount, `Heatwave ${selectedTier?.name ?? "ticket"}`)}
                          size={184}
                          className="h-[132px] w-[132px] sm:h-[184px] sm:w-[184px]"
                        />
                      </div>
                      <div className="text-xs text-[#6B6B6B] sm:hidden">
                        Or scan from another device
                      </div>
                    </div>
                    <div className="order-1 min-w-0 flex-1 text-center sm:order-2 sm:text-left">
                      <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
                        PAY VIA UPI
                      </div>
                      <div className="mt-1 text-[36px] font-black leading-none tracking-[-0.03em] tabular-nums sm:text-[32px]">
                        {fmt(amount)}
                      </div>
                      <a
                        href={upiLink(amount, `Heatwave ${selectedTier?.name ?? "ticket"}`)}
                        className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-[#141414] px-5 text-[15px] font-bold text-white sm:hidden"
                      >
                        Open UPI app
                      </a>
                      <div className="mt-3 text-sm leading-relaxed text-[#6B6B6B] sm:mt-1.5">
                        <span className="sm:hidden">Pay the exact amount, then enter the ID below.</span>
                        <span className="hidden sm:inline">
                          Scan with GPay, PhonePe, Paytm or any UPI app. Pay the exact amount, then
                          enter the transaction ID below.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={copyUpiId}
                        className="mt-3 inline-flex h-11 max-w-full items-center gap-2 rounded-full border border-[#EDE6E3] bg-white px-4 text-sm sm:mt-3.5"
                      >
                        <span className="truncate font-bold">{UPI_ID}</span>
                        <span className="text-[#E5251B]">{copied ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl bg-[#FDECEA] px-5 py-4 text-sm text-[#B71C14]">
                    UPI payments aren&apos;t set up yet. Please try again later.
                  </div>
                )}

                <div className="mt-6">
                  <Field
                    fieldKey="upiTxnId"
                    label="UPI transaction ID (12 digits)"
                    mode="numeric"
                    value={upiTxnId}
                    isFocused={focus === "upiTxnId"}
                    error={showTxnError}
                    ok={!txnError && focus !== "upiTxnId"}
                    onChange={(e) => setUpiTxnId(e.target.value.replace(/\D/g, "").slice(0, 12))}
                    onFocus={() => setFocus("upiTxnId")}
                    onBlur={() => {
                      setFocus(null);
                      setTxnTouched(true);
                    }}
                  />
                  {!showTxnError && (
                    <div className="ml-1 mt-1.5 text-[13px] text-[#6B6B6B]">
                      <span className="hidden sm:inline">
                        Find it as &ldquo;UPI transaction ID&rdquo; or &ldquo;UTR&rdquo; in your UPI
                        app ·{" "}
                      </span>
                      <span className="sm:hidden">UTR from your UPI app · </span>
                      {upiTxnId.length}/12
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <label
                    htmlFor="hw-screenshot"
                    style={{ borderColor: proofError || proofMissing ? "#E5251B" : "#EDE6E3" }}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed bg-white px-3.5 py-3 sm:gap-4 sm:p-4 transition-colors hover:bg-[#FCFAF9]"
                  >
                    {proofPreview ? (
                      <Image
                        src={proofPreview}
                        alt="Payment screenshot preview"
                        width={56}
                        height={56}
                        unoptimized
                        className="h-11 w-11 flex-none rounded-lg border border-[#EDE6E3] object-cover sm:h-14 sm:w-14"
                      />
                    ) : (
                      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-[#FAF7F5] sm:h-14 sm:w-14 text-[#6B6B6B]">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M12 16V4m0 0l-4.5 4.5M12 4l4.5 4.5M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold sm:text-[15px]">
                        {compressing ? "Compressing…" : proof ? proof.name : "Upload payment screenshot"}
                      </span>
                      <span className="block truncate text-xs text-[#6B6B6B] sm:text-[13px]">
                        {proofNote || (
                          <>
                            <span className="sm:hidden">Image · max 15 MB</span>
                            <span className="hidden sm:inline">PNG, JPG, WEBP or HEIC · up to 15 MB</span>
                          </>
                        )}
                      </span>
                    </span>
                    <span className="flex-none text-sm font-bold text-[#E5251B]">
                      {proof ? "Change" : "Browse"}
                    </span>
                  </label>
                  <input
                    id="hw-screenshot"
                    type="file"
                    accept={PROOF_TYPES.join(",")}
                    onChange={onProofChange}
                    className="sr-only"
                  />
                  {(proofError || proofMissing) && (
                    <div className="ml-1 mt-1.5 text-[13px] text-[#C8372D]">
                      {proofError || proofMissing}
                    </div>
                  )}
                </div>

                <label
                  htmlFor="hw-confirm"
                  style={{
                    borderColor: confirmMissing ? "#E5251B" : confirmed ? "#141414" : "#EDE6E3",
                    background: confirmMissing ? "#FFF8F7" : "#fff",
                  }}
                  className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors sm:p-4"
                >
                  <input
                    id="hw-confirm"
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className={`mt-px flex h-5 w-5 flex-none items-center justify-center rounded-md border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#E5251B]/40 ${
                      confirmed ? "border-[#E5251B] bg-[#E5251B]" : confirmMissing ? "border-[#E5251B] bg-white" : "border-[#C9BFBB] bg-white"
                    }`}
                  >
                    {confirmed && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="text-[13px] leading-snug text-[#141414] sm:text-sm">
                    I confirm that all details provided are accurate. Incorrect or incomplete
                    credentials may result in ticket rejection, with no refund.
                  </span>
                </label>
                {confirmMissing && (
                  <div className="ml-1 mt-1.5 text-[13px] text-[#C8372D]">
                    Tick the box to confirm your details
                  </div>
                )}

                {submitError && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-[#C8372D]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#E5251B]" />
                    {submitError}
                  </div>
                )}

                <div className={actionBar}>
                  <button
                    onClick={() => go(step - 1)}
                    className="h-12 flex-none pr-2 text-[15px] font-bold text-[#6B6B6B] hover:text-[#141414]"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || compressing || !UPI_ID}
                    className={`flex-1 justify-center sm:min-w-[200px] sm:flex-none ${btn}`}
                  >
                    {submitting ? (
                      <>
                        <span className="inline-block h-[18px] w-[18px] animate-[hwSpin_0.7s_linear_infinite] rounded-full border-2 border-white/35 border-t-white" />
                        Submitting…
                      </>
                    ) : (
                      "Complete payment"
                    )}
                  </button>
                </div>
                <div className="mt-4 pb-2 text-[13px] leading-relaxed text-[#6B6B6B] sm:text-right">
                  <span className="mb-1.5 block">
                    <span className="font-bold text-[#141414]">Disclaimer:</span> Incorrect or
                    incomplete credentials may result in ticket rejection, with no refund.
                  </span>
                  <span className="hidden sm:inline">
                    Your ticket is issued right away and activates once we verify the payment ·{" "}
                  </span>
                  By continuing, you agree to our{" "}
                  <Link href="/terms" className="font-bold text-[#141414] underline">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="font-bold text-[#141414] underline">
                    Privacy Policy
                  </Link>
                </div>
              </section>
            )}
          </div>

          <aside className="sticky top-6 hidden w-[380px] flex-none rounded-xl border border-[#EDE6E3] bg-[#FAF7F5] p-5 lg:block">
            <EventThumb className="aspect-[4/5] w-full" />
            <div className="mt-[18px] text-xs font-bold tracking-[0.14em] text-[#E5251B]">
              {EVENT.presenter.toUpperCase()}
            </div>
            <div className="mt-1 text-xl font-black leading-[1.15] tracking-[-0.025em]">
              {EVENT.name}
            </div>
            <div className="mt-2 text-sm leading-relaxed text-[#6B6B6B]">
              {EVENT.dateLabel} · {EVENT.timeLabel}
              <br />
              {EVENT.venue}
            </div>
            {selectedTier && (
              <div className="mt-5 flex items-baseline justify-between border-t border-[#EDE6E3] pt-4">
                <span className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">TOTAL</span>
                <span className="text-[26px] font-black tracking-[-0.02em] tabular-nums">
                  {fmt(amount)}
                </span>
              </div>
            )}
          </aside>
        </div>
      </main>
    </Page>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen bg-white text-[#141414]"
      style={{ fontFamily: "var(--font-satoshi)" }}
    >
      <Navbar />
      {children}
    </div>
  );
}
