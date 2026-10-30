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

type TicketResult = {
  ticketCode: string;
  tierName?: string;
  eventName?: string;
  venue?: string | null;
  startsAt?: string | null;
  amount?: number;
};

export type ExistingRegistration = {
  status: "pending" | "paid" | "failed";
  ticketCode: string | null;
  eventName: string | null;
};

const UPI_ID = process.env.NEXT_PUBLIC_UPI_ID ?? "";
const UPI_PAYEE_NAME = process.env.NEXT_PUBLIC_UPI_PAYEE_NAME ?? "Heatwave";
const UPI_TXN_RE = /^\d{12}$/;
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PROOF_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"];
const PREVIEWABLE = ["image/png", "image/jpeg", "image/webp"];

const EXISTING_LABEL: Record<ExistingRegistration["status"], string> = {
  pending: "Payment verification pending",
  paid: "Payment verified",
  failed: "Payment verification failed",
};

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

const btn =
  "inline-flex h-[54px] items-center justify-center gap-2.5 rounded-full px-8 text-base font-bold text-white transition-[background-position] duration-400 ease-out bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right hover:bg-left disabled:opacity-60 disabled:pointer-events-none";

function EventThumb({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-[#EDE6E3] bg-[#F3EEEB] ${className}`}
    >
      <Image
        src="/images/sample-poster.jpeg"
        alt="Product Builders Summit 2027 event poster"
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
}: {
  initialExisting: ExistingRegistration | null;
}) {
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [focus, setFocus] = useState<FieldKey | "upiTxnId" | null>(null);
  const [gender, setGender] = useState<Gender | "">("");
  const [genderTouched, setGenderTouched] = useState(false);

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  const [upiTxnId, setUpiTxnId] = useState("");
  const [txnTouched, setTxnTouched] = useState(false);
  const [proof, setProof] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState("");
  const [proofError, setProofError] = useState("");
  const [payTouched, setPayTouched] = useState(false);
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
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data: eventRow } = await supabase
        .from("events")
        .select("id, name, venue, starts_at")
        .eq("slug", "product-builders-summit-2027")
        .single();
      if (!eventRow) {
        setTiersLoading(false);
        return;
      }
      const { data: tierRows } = await supabase
        .from("ticket_tiers")
        .select("id, code, name, price_male, price_female, status, sort_order")
        .eq("event_id", eventRow.id)
        .order("sort_order");
      if (cancelled) return;
      setEvent(eventRow);
      const list = tierRows ?? [];
      setTiers(list);
      const open = list.find((t) => t.status === "open");
      if (open) setSelectedTierId(open.id);
      setTiersLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
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

  const txnError = UPI_TXN_RE.test(upiTxnId) ? "" : "Enter the 12-digit UPI transaction ID";
  const showTxnError = (txnTouched || payTouched) && focus !== "upiTxnId" ? txnError : "";
  const proofMissing = payTouched && !proof ? "Upload your payment screenshot" : "";

  function onProofChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!PROOF_TYPES.includes(file.type)) {
      setProofError("Screenshot must be a PNG, JPG, WEBP or HEIC image");
      return;
    }
    if (file.size > MAX_PROOF_BYTES) {
      setProofError("Screenshot must be under 5 MB");
      return;
    }
    setProofError("");
    setProof(file);
    setProofPreview(PREVIEWABLE.includes(file.type) ? URL.createObjectURL(file) : "");
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
    if (txnError || !proof) return;
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

  if (existing && !ticketResult) {
    return (
      <Page>
        <main className="mx-auto flex max-w-[640px] flex-col items-center px-6 py-16 text-center sm:py-24">
          <div className="flex h-24 w-24 animate-[hwPop_0.5s_cubic-bezier(.2,.9,.3,1.2)_both] items-center justify-center rounded-full bg-[#141414]">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 000-4V8z"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="M14 6v12" stroke="#fff" strokeWidth="1.8" strokeDasharray="2 2" />
            </svg>
          </div>
          <h1 className="m-0 mt-7 text-[40px] font-black leading-[0.95] tracking-[-0.05em] sm:text-[60px]">
            You&apos;re already registered
          </h1>
          <p className="mt-3.5 text-[17px] leading-relaxed text-[#6B6B6B]">
            This account already has a ticket for{" "}
            <span className="font-medium text-[#141414]">
              {existing.eventName ?? event?.name ?? "this event"}
            </span>
            . Only one registration is allowed per account — check your ticket in My Tickets.
          </p>
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-[#EDE6E3] bg-[#FAF7F5] px-4 py-2 text-sm">
            {existing.ticketCode && (
              <span className="font-bold tabular-nums">{existing.ticketCode}</span>
            )}
            {existing.ticketCode && <span className="text-[#B5ADA9]">·</span>}
            <span className="text-[#6B6B6B]">{EXISTING_LABEL[existing.status]}</span>
          </div>
          <Link href="/dashboard" className={`mt-8 ${btn}`}>
            Go to My Tickets →
          </Link>
          <Link href="/" className="mt-7 text-sm font-bold text-[#6B6B6B]">
            Back to event page
          </Link>
        </main>
      </Page>
    );
  }

  if (step === 3 && ticketResult) {
    const who = values.fullName || user?.email || "";
    const when = ticketResult.startsAt
      ? new Date(ticketResult.startsAt).toLocaleString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "";

    return (
      <Page>
        <main className="mx-auto flex max-w-[640px] flex-col items-center px-6 py-16 text-center sm:py-24">
          <div className="flex h-24 w-24 animate-[hwPop_0.5s_cubic-bezier(.2,.9,.3,1.2)_both] items-center justify-center rounded-full bg-[#E5251B]">
            <svg width="44" height="44" viewBox="0 0 24 24">
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                fill="none"
                stroke="#fff"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="m-0 mt-7 text-[48px] font-black leading-[0.95] tracking-[-0.05em] sm:text-[72px]">
            You&apos;re in!
          </h1>
          <p className="mt-3.5 text-[17px] leading-relaxed text-[#6B6B6B]">
            We&apos;ve received your payment details. Your ticket is below and in{" "}
            <span className="font-medium text-[#141414]">My Tickets</span>.
          </p>

          <div className="mt-6 flex w-full items-start gap-3 rounded-xl bg-[#FFF6E5] px-5 py-4 text-left text-sm leading-relaxed text-[#8A5A00]">
            <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-[#D99A1E]" />
            <span>
              <span className="font-bold">Payment verification pending.</span> We&apos;ll match UPI
              transaction <span className="font-bold tabular-nums">{upiTxnId}</span> with our
              account. Your QR will work at the entrance once it&apos;s verified.
            </span>
          </div>

          <div className="mt-6 w-full overflow-hidden rounded-xl border border-[#EDE6E3] bg-white text-left">
            <div className="px-7 py-6">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-bold tracking-[0.14em] text-[#E5251B]">E-TICKET</div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF6E5] px-2.5 py-0.5 text-xs font-bold text-[#8A5A00]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D99A1E]" />
                  Verification pending
                </span>
              </div>
              <div className="mt-2 text-2xl font-black tracking-[-0.03em]">
                {ticketResult.eventName}
              </div>
              {when && (
                <div className="mt-1 text-sm text-[#6B6B6B]">
                  {when}
                  {ticketResult.venue ? ` · ${ticketResult.venue}` : ""}
                </div>
              )}
              <div className="mt-[22px] grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">
                    ATTENDEE
                  </div>
                  <div className="mt-1 text-[15px] font-bold">{who}</div>
                </div>
                <div>
                  <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">
                    TICKET
                  </div>
                  <div className="mt-1 text-[15px] font-bold">
                    {ticketResult.tierName ?? selectedTier?.name}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">
                    BOOKING ID
                  </div>
                  <div className="mt-1 text-[15px] font-bold tabular-nums">
                    {ticketResult.ticketCode}
                  </div>
                </div>
              </div>
            </div>
            <div className="relative h-0 border-t border-dashed border-[#EDE6E3]">
              <span className="absolute -left-[11px] -top-[11px] h-[22px] w-[22px] rounded-full border border-[#EDE6E3] bg-white" />
              <span className="absolute -right-[11px] -top-[11px] h-[22px] w-[22px] rounded-full border border-[#EDE6E3] bg-white" />
            </div>
            <div className="flex flex-wrap items-center gap-6 bg-[#FAF7F5] px-7 py-6">
              <div className="flex h-[132px] w-[132px] items-center justify-center rounded-lg border border-[#EDE6E3] bg-white p-2.5">
                <QRCodeSVG value={ticketResult.ticketCode} size={112} />
              </div>
              <div className="flex-1 basis-[200px] text-sm leading-relaxed text-[#6B6B6B]">
                Show this code at the entrance. Keep your UPI payment screenshot handy in case
                we need it.
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button onClick={() => downloadIcs(event)} className={btn}>
              Add to calendar
            </button>
            <Link
              href="/dashboard"
              className="inline-flex h-[52px] items-center justify-center rounded-full border border-[#141414] px-7 text-[15px] font-bold transition-colors hover:bg-[#FAF7F5]"
            >
              View in My Tickets
            </Link>
          </div>
          <Link href="/" className="mt-7 text-sm font-bold text-[#6B6B6B]">
            Back to event page
          </Link>
        </main>
      </Page>
    );
  }

  return (
    <Page>
      <main className="mx-auto max-w-[1200px] px-6 py-10 pb-24">
        <div className="flex items-start gap-12">
          <div className="min-w-0 max-w-[720px] flex-1">
            <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">REGISTRATION</div>
            <h1 className="m-0 mt-3 text-[36px] font-black leading-[1] tracking-[-0.045em] sm:text-[52px]">
              Get your ticket
            </h1>

            <div className="mt-8 h-[3px] overflow-hidden rounded-full bg-[#EDE6E3]">
              <div
                className="h-full rounded-full bg-[#E5251B] transition-[width] duration-500 ease-out"
                style={{ width: `${((Math.min(step, 2) + 1) / 3) * 100}%` }}
              />
            </div>
            <div className="mt-3.5 flex flex-wrap gap-7">
              {steps.map((label, i) => (
                <button
                  key={label}
                  onClick={() => i < step && go(i)}
                  disabled={i >= step}
                  style={{ cursor: i < step ? "pointer" : "default" }}
                  className="flex gap-2 text-sm font-bold"
                >
                  <span style={{ color: i <= step ? "#E5251B" : "#6B6B6B" }}>0{i + 1}</span>
                  <span style={{ color: i <= step ? "#141414" : "#6B6B6B" }}>{label}</span>
                </button>
              ))}
            </div>

            {step === 0 && (
              <section className="mt-10">
                <h2 className="m-0 mb-6 text-[22px] font-bold tracking-[-0.02em]">
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
                  <div className="flex gap-3">
                    {(["male", "female"] as Gender[]).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(g)}
                        style={{
                          borderColor: gender === g ? "#E5251B" : "#EDE6E3",
                          boxShadow: gender === g ? "0 0 0 1px #E5251B" : "none",
                        }}
                        className="rounded-full border bg-white px-6 py-3 text-sm font-bold capitalize transition-transform duration-150 hover:-translate-y-0.5"
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

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() =>
                      check(["fullName", "email", "mobile", "instagram", "age"]) && go(1)
                    }
                    className={btn}
                  >
                    Continue to tickets →
                  </button>
                </div>
              </section>
            )}

            {step === 1 && (
              <section className="mt-10">
                <h2 className="m-0 mb-6 text-[22px] font-bold tracking-[-0.02em]">
                  Choose a ticket
                </h2>
                {tiersLoading ? (
                  <div className="h-[140px] animate-[hwPulse_1.4s_ease_infinite] rounded-xl border border-[#EDE6E3] bg-[#FAF7F5]" />
                ) : (
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    {tiers.map((tier) => {
                      const open = tier.status === "open";
                      const on = tier.id === selectedTierId;
                      const price = gender === "male" ? tier.price_male : tier.price_female;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          disabled={!open}
                          onClick={() => open && setSelectedTierId(tier.id)}
                          style={{
                            borderColor: on ? "#E5251B" : "#EDE6E3",
                            boxShadow: on ? "0 0 0 1px #E5251B" : "none",
                            opacity: open ? 1 : 0.55,
                            cursor: open ? "pointer" : "not-allowed",
                          }}
                          className="relative flex flex-col gap-1.5 rounded-xl border bg-white p-[22px] text-left transition-transform duration-200 enabled:hover:-translate-y-0.5"
                        >
                          {on && open && (
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
                            {open && price ? fmt(price) : "× × ×"}
                          </span>
                          <span className="text-sm leading-snug text-[#6B6B6B]">
                            {open ? "Sale ends soon" : "Dates coming soon"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-8 flex items-center justify-between gap-4">
                  <button
                    onClick={() => go(step - 1)}
                    className="text-[15px] font-bold text-[#6B6B6B] hover:text-[#141414]"
                  >
                    ← Back
                  </button>
                  <button onClick={() => selectedTier && go(2)} disabled={!selectedTier} className={btn}>
                    Continue to payment →
                  </button>
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="mt-10">
                <h2 className="m-0 mb-6 text-[22px] font-bold tracking-[-0.02em]">Pay with UPI</h2>
                <div className="rounded-xl border border-[#EDE6E3] p-5">
                  <div className="flex justify-between gap-3 text-[15px]">
                    <span>{selectedTier?.name}</span>
                    <span className="tabular-nums font-bold">{fmt(amount)}</span>
                  </div>
                </div>

                {UPI_ID ? (
                  <div className="mt-4 flex flex-col items-center gap-6 rounded-xl border border-[#EDE6E3] bg-[#FAF7F5] p-6 sm:flex-row">
                    <div className="flex-none rounded-xl border border-[#EDE6E3] bg-white p-3">
                      <QRCodeSVG
                        value={upiLink(amount, `Heatwave ${selectedTier?.name ?? "ticket"}`)}
                        size={184}
                      />
                    </div>
                    <div className="min-w-0 flex-1 text-center sm:text-left">
                      <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
                        SCAN &amp; PAY
                      </div>
                      <div className="mt-1 text-[32px] font-black tracking-[-0.03em] tabular-nums">
                        {fmt(amount)}
                      </div>
                      <div className="mt-1.5 text-sm leading-relaxed text-[#6B6B6B]">
                        Scan with GPay, PhonePe, Paytm or any UPI app. Pay the exact amount, then
                        enter the transaction ID below.
                      </div>
                      <button
                        type="button"
                        onClick={copyUpiId}
                        className="mt-3.5 inline-flex max-w-full items-center gap-2 rounded-full border border-[#EDE6E3] bg-white px-4 py-2 text-sm"
                      >
                        <span className="truncate font-bold">{UPI_ID}</span>
                        <span className="text-[#E5251B]">{copied ? "Copied" : "Copy"}</span>
                      </button>
                      <a
                        href={upiLink(amount, `Heatwave ${selectedTier?.name ?? "ticket"}`)}
                        className="mt-3 flex h-11 items-center justify-center rounded-full border border-[#141414] px-5 text-sm font-bold sm:hidden"
                      >
                        Open UPI app
                      </a>
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
                      Find it as &ldquo;UPI transaction ID&rdquo; or &ldquo;UTR&rdquo; in your UPI
                      app · {upiTxnId.length}/12
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <label
                    htmlFor="hw-screenshot"
                    style={{ borderColor: proofError || proofMissing ? "#E5251B" : "#EDE6E3" }}
                    className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed bg-white p-4 transition-colors hover:bg-[#FCFAF9]"
                  >
                    {proofPreview ? (
                      <Image
                        src={proofPreview}
                        alt="Payment screenshot preview"
                        width={56}
                        height={56}
                        unoptimized
                        className="h-14 w-14 flex-none rounded-lg border border-[#EDE6E3] object-cover"
                      />
                    ) : (
                      <span className="flex h-14 w-14 flex-none items-center justify-center rounded-lg bg-[#FAF7F5] text-[#6B6B6B]">
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
                      <span className="block truncate text-[15px] font-bold">
                        {proof ? proof.name : "Upload payment screenshot"}
                      </span>
                      <span className="block text-[13px] text-[#6B6B6B]">
                        PNG, JPG, WEBP or HEIC · up to 5 MB
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

                {submitError && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-[#C8372D]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#E5251B]" />
                    {submitError}
                  </div>
                )}

                <div className="mt-8 flex items-center justify-between gap-4">
                  <button
                    onClick={() => go(step - 1)}
                    className="text-[15px] font-bold text-[#6B6B6B] hover:text-[#141414]"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !UPI_ID}
                    className={`min-w-[200px] justify-center ${btn}`}
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
                <div className="mt-4 text-right text-[13px] text-[#6B6B6B]">
                  Your ticket is issued right away and activates once we verify the payment · By
                  continuing, you agree to our{" "}
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
            <EventThumb className="aspect-video w-full" />
            <div className="mt-[18px] text-xl font-black leading-[1.15] tracking-[-0.025em]">
              {event?.name ?? "Product Builders Summit 2027"}
            </div>
            <div className="mt-2 text-sm leading-relaxed text-[#6B6B6B]">
              Sat, 13 Feb 2027 · 9:30 AM
              <br />
              {event?.venue ?? "Bangalore International Centre"}
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
      <header className="border-b border-[#EDE6E3]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-6 px-6 py-[18px]">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xl font-black tracking-[-0.04em]"
          >
            heatwave
            <span className="h-[7px] w-[7px] rounded-full bg-[#E5251B]" />
          </Link>
          <Link href="/" className="text-sm font-medium text-[#6B6B6B] hover:text-[#141414]">
            ← Back to event
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
