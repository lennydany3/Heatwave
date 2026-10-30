"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

type TicketId = "early" | "regular" | "group";
type PayMethod = "upi" | "card";
type FieldKey =
  | "name"
  | "email"
  | "phone"
  | "org"
  | "upi"
  | "cardnum"
  | "exp"
  | "cvv";

const TICKETS: {
  id: TicketId;
  name: string;
  price: number;
  note: string;
  min: number;
}[] = [
  { id: "early", name: "Early bird", price: 999, note: "18 left at this price", min: 1 },
  {
    id: "regular",
    name: "Regular",
    price: 1499,
    note: "Full-day access, meals included",
    min: 1,
  },
  { id: "group", name: "Group", price: 1199, note: "Per person, 4 or more", min: 4 },
];

const RULES: Record<FieldKey, (v: string) => string> = {
  name: (v) => (v.trim().length < 2 ? "Enter your full name" : ""),
  email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? "" : "Enter a valid email address"),
  phone: (v) =>
    v.replace(/\D/g, "").length === 10 ? "" : "Enter a 10-digit mobile number",
  org: (v) => (v.trim() ? "" : "Add your college or organisation"),
  upi: (v) => (/^[\w.-]{2,}@[a-z]{2,}$/i.test(v) ? "" : "Enter a UPI ID like name@okaxis"),
  cardnum: (v) =>
    v.replace(/\D/g, "").length === 16 ? "" : "Enter the 16-digit card number",
  exp: (v) => (/^(0[1-9]|1[0-2])\/\d{2}$/.test(v) ? "" : "Use MM/YY"),
  cvv: (v) => (/^\d{3}$/.test(v) ? "" : "Enter 3 digits"),
};

const MASK: Partial<Record<FieldKey, (v: string) => string>> = {
  phone: (v) => v.replace(/\D/g, "").slice(0, 10),
  cardnum: (v) =>
    v
      .replace(/\D/g, "")
      .slice(0, 16)
      .replace(/(\d{4})(?=\d)/g, "$1 "),
  exp: (v) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d;
  },
  cvv: (v) => v.replace(/\D/g, "").slice(0, 3),
};

const fmt = (n: number) => "₹" + n.toLocaleString("en-IN");

const SEATS_LEFT = 42;

function buildQr(): string {
  const N = 29;
  let s = 9;
  let d = "";
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const ox = x < 8 ? 0 : x >= N - 8 ? N - 7 : null;
      const oy = y < 8 ? 0 : y >= N - 8 ? N - 7 : null;
      const inFinder = ox !== null && oy !== null && !(ox && oy);
      let dark: boolean;
      if (inFinder) {
        const fx = x - (ox as number);
        const fy = y - (oy as number);
        dark =
          fx >= 0 &&
          fy >= 0 &&
          fx < 7 &&
          fy < 7 &&
          (fx === 0 || fx === 6 || fy === 0 || fy === 6 || (fx > 1 && fx < 5 && fy > 1 && fy < 5));
      } else {
        dark = r() < 0.47;
      }
      if (dark) d += `M${x} ${y}h1v1h-1z`;
    }
  }
  return d;
}

function downloadIcs() {
  const text =
    "BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:Product Builders Summit 2027\nDTSTART:20270213T040000Z\nDTEND:20270213T123000Z\nLOCATION:Bangalore International Centre, Domlur, Bengaluru\nEND:VEVENT\nEND:VCALENDAR";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/calendar" }));
  a.download = "heatwave-summit.ics";
  a.click();
}

const inputBase =
  "h-[60px] w-full rounded-xl border bg-white px-4 pb-2 pt-6 text-base text-[#141414] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-transparent";

const btn =
  "inline-flex h-[54px] items-center justify-center gap-2.5 rounded-full px-8 text-base font-bold text-white transition-[background-position] duration-400 ease-out bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right hover:bg-left";

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

function OrderSummaryLines({
  ticketName,
  qty,
  sub,
  fee,
}: {
  ticketName: string;
  qty: number;
  sub: number;
  fee: number;
}) {
  return (
    <div className="flex flex-col gap-2.5 text-[15px]">
      <div className="flex justify-between gap-3">
        <span>
          {ticketName} × {qty}
        </span>
        <span className="tabular-nums">{fmt(sub)}</span>
      </div>
      <div className="flex justify-between gap-3 text-[#6B6B6B]">
        <span>Booking fee</span>
        <span className="tabular-nums">{fmt(fee)}</span>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Partial<Record<FieldKey, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [focus, setFocus] = useState<FieldKey | null>(null);
  const [ticket, setTicket] = useState<TicketId>("regular");
  const [qty, setQty] = useState(1);
  const [pay, setPay] = useState<PayMethod>("upi");
  const [loading, setLoading] = useState(false);
  const [sumOpen, setSumOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const qr = useMemo(() => buildQr(), []);
  const t = TICKETS.find((x) => x.id === ticket)!;
  const sub = t.price * qty;
  const fee = 49;
  const total = sub + fee;

  function go(nextStep: number) {
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectTicket(id: TicketId) {
    const nt = TICKETS.find((x) => x.id === id)!;
    setTicket(id);
    setQty((q) => Math.max(q, nt.min));
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
    return keys.every((k) => !RULES[k](values[k] ?? ""));
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

  const steps = ["Details", "Tickets", "Payment"];

  if (step === 3) {
    const who = values.name || "Aarav Sharma";
    const email = values.email || "aarav@example.com";
    const ticketId = "HW-27-" + (4821 + qty * 7);

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
            <span className="font-medium text-[#141414]">{email}</span>
          </p>

          <div className="mt-10 w-full overflow-hidden rounded-xl border border-[#EDE6E3] bg-white text-left">
            <div className="px-7 py-6">
              <div className="text-xs font-bold tracking-[0.14em] text-[#E5251B]">E-TICKET</div>
              <div className="mt-2 text-2xl font-black tracking-[-0.03em]">
                Product Builders Summit 2027
              </div>
              <div className="mt-1 text-sm text-[#6B6B6B]">
                Sat, 13 Feb 2027 · 9:30 AM · Bangalore International Centre
              </div>
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
                    {t.name} × {qty}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">
                    BOOKING ID
                  </div>
                  <div className="mt-1 text-[15px] font-bold tabular-nums">{ticketId}</div>
                </div>
              </div>
            </div>
            <div className="relative h-0 border-t border-dashed border-[#EDE6E3]">
              <span className="absolute -left-[11px] -top-[11px] h-[22px] w-[22px] rounded-full border border-[#EDE6E3] bg-white" />
              <span className="absolute -right-[11px] -top-[11px] h-[22px] w-[22px] rounded-full border border-[#EDE6E3] bg-white" />
            </div>
            <div className="flex flex-wrap items-center gap-6 bg-[#FAF7F5] px-7 py-6">
              <div className="h-[132px] w-[132px] rounded-lg border border-[#EDE6E3] bg-white p-2.5">
                <svg viewBox="0 0 29 29" shapeRendering="crispEdges" className="block h-full w-full">
                  <path d={qr} fill="#141414" />
                </svg>
              </div>
              <div className="flex-1 basis-[200px] text-sm leading-relaxed text-[#6B6B6B]">
                Show this code at the entrance. Each person in your booking gets
                their own code by email.
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button onClick={downloadIcs} className={btn}>
              Add to calendar
            </button>
            <button
              onClick={() => {
                setSaved(true);
                setTimeout(() => setSaved(false), 2200);
              }}
              className="inline-flex h-[52px] items-center justify-center rounded-full border border-[#141414] px-7 text-[15px] font-bold transition-colors hover:bg-[#FAF7F5]"
            >
              {saved ? "Saved ✓" : "Download ticket"}
            </button>
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
        <div className="-mt-4 mb-8 rounded-xl border border-[#EDE6E3] bg-[#FAF7F5] lg:hidden">
          <button
            onClick={() => setSumOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-[18px] py-4"
          >
            <span className="flex flex-col gap-0.5 text-left">
              <span className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
                ORDER SUMMARY
              </span>
              <span className="text-[15px] font-medium">
                {t.name} × {qty}
              </span>
            </span>
            <span className="flex items-center gap-2.5 text-lg font-black">
              {fmt(total)}
              <span
                className="text-xs text-[#6B6B6B] transition-transform duration-250"
                style={{ transform: sumOpen ? "rotate(180deg)" : "none" }}
              >
                ▼
              </span>
            </span>
          </button>
          {sumOpen && (
            <div className="flex flex-col gap-3 px-[18px] pb-[18px]">
              <div className="flex items-center gap-3.5">
                <EventThumb className="h-[72px] w-[72px] flex-none" />
                <div>
                  <div className="text-base font-black tracking-[-0.02em]">
                    Product Builders Summit 2027
                  </div>
                  <div className="mt-0.5 text-[13px] text-[#6B6B6B]">
                    Sat, 13 Feb · Bangalore Intl. Centre
                  </div>
                </div>
              </div>
              {SEATS_LEFT < 60 && (
                <div className="self-start rounded-full border border-[#F3C9C5] bg-white px-2.5 py-1 text-xs font-bold text-[#E5251B]">
                  Seats filling fast · {SEATS_LEFT} left
                </div>
              )}
              <div className="flex flex-col gap-2 border-t border-[#EDE6E3] pt-3">
                <OrderSummaryLines ticketName={t.name} qty={qty} sub={sub} fee={fee} />
                <div className="flex justify-between border-t border-[#EDE6E3] pt-2 text-base font-black">
                  <span>Total</span>
                  <span>{fmt(total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-start gap-12">
          <div className="min-w-0 max-w-[720px] flex-1">
            <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
              REGISTRATION
            </div>
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
                  <span style={{ color: i <= step ? "#E5251B" : "#6B6B6B" }}>
                    0{i + 1}
                  </span>
                  <span style={{ color: i <= step ? "#141414" : "#6B6B6B" }}>
                    {label}
                  </span>
                </button>
              ))}
            </div>

            {step === 0 && (
              <section className="mt-10">
                <h2 className="m-0 mb-6 text-[22px] font-bold tracking-[-0.02em]">
                  Your details
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field fieldKey="name" label="Full name" {...fieldProps("name")} />
                  <Field fieldKey="email" label="Email" mode="email" {...fieldProps("email")} />
                  <Field fieldKey="phone" label="Phone (+91)" mode="tel" {...fieldProps("phone")} />
                  <Field fieldKey="org" label="College or organisation" {...fieldProps("org")} />
                </div>
                <div className="mt-8 flex justify-end">
                  <button
                    onClick={() => check(["name", "email", "phone", "org"]) && go(1)}
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
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                  {TICKETS.map((opt) => {
                    const on = opt.id === ticket;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => selectTicket(opt.id)}
                        style={{
                          borderColor: on ? "#E5251B" : "#EDE6E3",
                          boxShadow: on ? "0 0 0 1px #E5251B" : "none",
                        }}
                        className="relative flex flex-col gap-1.5 rounded-xl border bg-white p-[22px] text-left transition-transform duration-200 hover:-translate-y-0.5"
                      >
                        {on && (
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
                          {opt.name}
                        </span>
                        <span className="text-[28px] font-black tracking-[-0.03em]">
                          {fmt(opt.price)}
                        </span>
                        <span className="text-sm leading-snug text-[#6B6B6B]">
                          {opt.note}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#EDE6E3] p-[18px_22px]">
                  <div>
                    <div className="text-base font-bold">Quantity</div>
                    <div className="mt-0.5 text-sm text-[#6B6B6B]">
                      Up to 10 per booking
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-[#EDE6E3] p-1">
                    <button
                      aria-label="Decrease"
                      onClick={() => setQty((q) => Math.max(t.min, q - 1))}
                      style={{ opacity: qty > t.min ? 1 : 0.35 }}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-[#FAF7F5]"
                    >
                      −
                    </button>
                    <span className="min-w-[72px] text-center text-base font-bold tabular-nums">
                      {qty} {ticket === "group" ? "people" : qty === 1 ? "ticket" : "tickets"}
                    </span>
                    <button
                      aria-label="Increase"
                      onClick={() => setQty((q) => Math.min(10, q + 1))}
                      style={{ opacity: qty < 10 ? 1 : 0.35 }}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-[#FAF7F5]"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between gap-4">
                  <button
                    onClick={() => go(step - 1)}
                    className="text-[15px] font-bold text-[#6B6B6B] hover:text-[#141414]"
                  >
                    ← Back
                  </button>
                  <button onClick={() => go(2)} className={btn}>
                    Continue to payment →
                  </button>
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="mt-10">
                <h2 className="m-0 mb-6 text-[22px] font-bold tracking-[-0.02em]">
                  Payment
                </h2>
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  {(
                    [
                      { id: "upi" as const, l: "UPI", d: "GPay, PhonePe, Paytm or any UPI app" },
                      { id: "card" as const, l: "Card", d: "Visa, Mastercard, RuPay" },
                    ]
                  ).map((p) => {
                    const on = pay === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setPay(p.id)}
                        style={{
                          borderColor: on ? "#E5251B" : "#EDE6E3",
                          boxShadow: on ? "0 0 0 1px #E5251B" : "none",
                        }}
                        className="flex items-center gap-4 rounded-xl border bg-white px-[22px] py-5 transition-transform duration-200 hover:-translate-y-0.5"
                      >
                        <span
                          style={{ borderColor: on ? "#E5251B" : "#C9C0BC" }}
                          className="flex h-5 w-5 flex-none items-center justify-center rounded-full border-[1.5px]"
                        >
                          <span
                            style={{ transform: on ? "scale(1)" : "scale(0)" }}
                            className="h-[10px] w-[10px] rounded-full bg-[#E5251B] transition-transform duration-200"
                          />
                        </span>
                        <span className="flex flex-col gap-0.5 text-left">
                          <span className="text-base font-bold">{p.l}</span>
                          <span className="text-sm text-[#6B6B6B]">{p.d}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {pay === "upi" ? (
                  <div className="mt-5">
                    <Field fieldKey="upi" label="UPI ID" {...fieldProps("upi")} />
                    <div className="mt-2.5 text-[13px] text-[#6B6B6B]">
                      You&apos;ll get a payment request in your UPI app.
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Field fieldKey="cardnum" label="Card number" mode="numeric" {...fieldProps("cardnum")} />
                    <Field fieldKey="exp" label="Expiry (MM/YY)" mode="numeric" {...fieldProps("exp")} />
                    <Field fieldKey="cvv" label="CVV" mode="numeric" {...fieldProps("cvv")} />
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
                    onClick={() => {
                      if (loading) return;
                      const ok = check(pay === "upi" ? ["upi"] : ["cardnum", "exp", "cvv"]);
                      if (!ok) return;
                      setLoading(true);
                      setTimeout(() => {
                        setLoading(false);
                        go(3);
                      }, 1700);
                    }}
                    className={`min-w-[180px] justify-center ${btn}`}
                  >
                    {loading ? (
                      <>
                        <span className="inline-block h-[18px] w-[18px] animate-[hwSpin_0.7s_linear_infinite] rounded-full border-2 border-white/35 border-t-white" />
                        Processing…
                      </>
                    ) : (
                      `Pay ${fmt(total)}`
                    )}
                  </button>
                </div>
                <div className="mt-4 text-right text-[13px] text-[#6B6B6B]">
                  Secured payment · Full refund until 30 Jan 2027
                </div>
              </section>
            )}
          </div>

          <aside className="sticky top-6 hidden w-[380px] flex-none rounded-xl border border-[#EDE6E3] bg-[#FAF7F5] p-5 lg:block">
            <EventThumb className="aspect-video w-full" />
            <div className="mt-[18px] text-xl font-black leading-[1.15] tracking-[-0.025em]">
              Product Builders Summit 2027
            </div>
            <div className="mt-2 text-sm leading-relaxed text-[#6B6B6B]">
              Sat, 13 Feb 2027 · 9:30 AM
              <br />
              Bangalore International Centre
            </div>
            {SEATS_LEFT < 60 && (
              <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-full border border-[#F3C9C5] bg-white px-3 py-1 text-xs font-bold text-[#E5251B]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#E5251B]" />
                Seats filling fast · {SEATS_LEFT} left
              </div>
            )}
            <div className="mt-5 border-t border-[#EDE6E3] pt-4">
              <OrderSummaryLines ticketName={t.name} qty={qty} sub={sub} fee={fee} />
            </div>
            <div className="mt-4 flex items-baseline justify-between border-t border-[#EDE6E3] pt-4">
              <span className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">TOTAL</span>
              <span className="text-[26px] font-black tracking-[-0.02em] tabular-nums">
                {fmt(total)}
              </span>
            </div>
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
