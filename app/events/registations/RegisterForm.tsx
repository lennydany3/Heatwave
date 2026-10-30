"use client";

import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
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
  eventName?: string;
  venue?: string | null;
  startsAt?: string | null;
  amount?: number;
};

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
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
  fieldKey: FieldKey;
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

export default function RegisterPage() {
  const { user } = useAuth();

  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [focus, setFocus] = useState<FieldKey | null>(null);
  const [gender, setGender] = useState<Gender | "">("");
  const [genderTouched, setGenderTouched] = useState(false);

  const [event, setEvent] = useState<EventInfo | null>(null);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [tiersLoading, setTiersLoading] = useState(true);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState("");
  const [razorpayReady, setRazorpayReady] = useState(false);

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

  async function handlePay() {
    if (payLoading || !selectedTier || !gender) return;
    setPayError("");
    setPayLoading(true);

    try {
      const res = await fetch("/api/registrations/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketTierId: selectedTier.id,
          fullName: values.fullName,
          email: values.email,
          mobile: values.mobile,
          instagram: values.instagram,
          age: Number(values.age),
          gender,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPayError(data.error || "Could not start payment");
        setPayLoading(false);
        return;
      }

      if (!window.Razorpay) {
        setPayError("Payment is still loading — try again in a moment.");
        setPayLoading(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount * 100,
        currency: "INR",
        name: "Heatwave",
        description: data.eventName,
        order_id: data.razorpayOrderId,
        prefill: data.prefill,
        theme: { color: "#E5251B" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          const verifyRes = await fetch("/api/registrations/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              registrationId: data.registrationId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const verifyData = await verifyRes.json();
          setPayLoading(false);
          if (!verifyRes.ok) {
            setPayError(verifyData.error || "Payment verification failed");
            return;
          }
          setTicketResult(verifyData);
          go(3);
        },
        modal: {
          ondismiss: () => setPayLoading(false),
        },
      });
      rzp.open();
    } catch {
      setPayError("Something went wrong. Try again.");
      setPayLoading(false);
    }
  }

  const steps = ["Details", "Tickets", "Payment"];

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
            Your ticket has been sent to{" "}
            <span className="font-medium text-[#141414]">{values.email}</span>
          </p>

          <div className="mt-10 w-full overflow-hidden rounded-xl border border-[#EDE6E3] bg-white text-left">
            <div className="px-7 py-6">
              <div className="text-xs font-bold tracking-[0.14em] text-[#E5251B]">E-TICKET</div>
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
                  <div className="mt-1 text-[15px] font-bold">{selectedTier?.name}</div>
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
                Show this code at the entrance.
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
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setRazorpayReady(true)}
      />
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
                <h2 className="m-0 mb-6 text-[22px] font-bold tracking-[-0.02em]">Payment</h2>
                <div className="rounded-xl border border-[#EDE6E3] p-5">
                  <div className="flex justify-between gap-3 text-[15px]">
                    <span>{selectedTier?.name}</span>
                    <span className="tabular-nums font-bold">{fmt(amount)}</span>
                  </div>
                </div>

                {payError && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-[#C8372D]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#E5251B]" />
                    {payError}
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
                    onClick={handlePay}
                    disabled={payLoading || !razorpayReady}
                    className={`min-w-[180px] justify-center ${btn}`}
                  >
                    {payLoading ? (
                      <>
                        <span className="inline-block h-[18px] w-[18px] animate-[hwSpin_0.7s_linear_infinite] rounded-full border-2 border-white/35 border-t-white" />
                        Processing…
                      </>
                    ) : (
                      `Pay ${fmt(amount)}`
                    )}
                  </button>
                </div>
                <div className="mt-4 text-right text-[13px] text-[#6B6B6B]">
                  Secured payment via Razorpay · By paying, you agree to our{" "}
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
