"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FocusEvent } from "react";

const btn =
  "inline-flex h-14 items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white transition-[background-position] duration-400 ease-out bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right hover:bg-left";

function Wave() {
  const path =
    "M0 70 " +
    Array.from({ length: 8 }, (_, i) =>
      i === 0 ? "Q100 30 200 70 " : `T${200 * (i + 1)} 70 `
    ).join("");
  return (
    <svg
      viewBox="0 0 1600 140"
      preserveAspectRatio="none"
      className="block h-full w-[200%] animate-[hwDrift_24s_linear_infinite]"
    >
      <path
        d={path}
        fill="none"
        stroke="#E5251B"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

type FieldKey = "email" | "pw";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [focus, setFocus] = useState<FieldKey | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!/^\S+@\S+\.\S+$/.test(email) || pw.length < 6) {
      setErr("Incorrect email or password");
      return;
    }
    setErr("");
    setLoading(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 1200);
  }

  function field(key: FieldKey) {
    const value = key === "email" ? email : pw;
    const setValue = key === "email" ? setEmail : setPw;
    const isFocused = focus === key;
    const up = isFocused || !!value;
    const bad = !!err;
    return {
      value,
      onChange: (e: ChangeEvent<HTMLInputElement>) => {
        setValue(e.target.value);
        setErr("");
      },
      onFocus: (_e: FocusEvent<HTMLInputElement>) => setFocus(key),
      onBlur: (_e: FocusEvent<HTMLInputElement>) => setFocus(null),
      border: bad || isFocused ? "#E5251B" : "#EDE6E3",
      ring: isFocused ? "0 0 0 3px rgba(229,37,27,.12)" : "none",
      labelTop: up ? "9px" : "19px",
      labelSize: up ? "12px" : "16px",
      labelColor: bad ? "#C8372D" : isFocused ? "#E5251B" : "#6B6B6B",
    };
  }

  const emailField = field("email");
  const pwField = field("pw");

  return (
    <div
      className="flex min-h-screen flex-wrap bg-white text-[#141414]"
      style={{ fontFamily: "var(--font-satoshi)" }}
    >
      <div className="flex min-w-0 flex-1 basis-[520px] flex-col px-6 py-8 sm:px-10 lg:px-[72px]">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xl font-black tracking-[-0.04em]"
        >
          heatwave
          <span className="h-[7px] w-[7px] rounded-full bg-[#E5251B]" />
        </Link>

        <div className="flex flex-1 items-center py-12">
          <form
            onSubmit={handleSubmit}
            noValidate
            className="mx-auto w-full max-w-[400px] animate-[hwUp_0.6s_ease_both]"
          >
            <h1 className="m-0 text-[40px] font-black leading-[1] tracking-[-0.045em] sm:text-[52px]">
              Welcome back
            </h1>
            <p className="mt-3 text-base text-[#6B6B6B]">
              Log in to see your tickets and bookings.
            </p>

            <div className="mt-9 flex flex-col gap-3.5">
              <div className="relative">
                <input
                  id="cl-email"
                  type="email"
                  placeholder="Email"
                  autoComplete="email"
                  value={emailField.value}
                  onChange={emailField.onChange}
                  onFocus={emailField.onFocus}
                  onBlur={emailField.onBlur}
                  style={{
                    borderColor: emailField.border,
                    boxShadow: emailField.ring,
                  }}
                  className="h-[60px] w-full rounded-xl border bg-white px-4 pb-2 pt-6 text-base text-[#141414] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-transparent"
                />
                <label
                  htmlFor="cl-email"
                  style={{
                    top: emailField.labelTop,
                    fontSize: emailField.labelSize,
                    color: emailField.labelColor,
                  }}
                  className="pointer-events-none absolute left-[17px] transition-all duration-150 ease-in-out"
                >
                  Email
                </label>
              </div>

              <div className="relative">
                <input
                  id="cl-pw"
                  type={showPw ? "text" : "password"}
                  placeholder="Password"
                  autoComplete="current-password"
                  value={pwField.value}
                  onChange={pwField.onChange}
                  onFocus={pwField.onFocus}
                  onBlur={pwField.onBlur}
                  style={{
                    borderColor: pwField.border,
                    boxShadow: pwField.ring,
                  }}
                  className="h-[60px] w-full rounded-xl border bg-white px-4 pr-[72px] pb-2 pt-6 text-base text-[#141414] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-transparent"
                />
                <label
                  htmlFor="cl-pw"
                  style={{
                    top: pwField.labelTop,
                    fontSize: pwField.labelSize,
                    color: pwField.labelColor,
                  }}
                  className="pointer-events-none absolute left-[17px] transition-all duration-150 ease-in-out"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-4 top-5 text-[13px] font-bold text-[#6B6B6B] hover:text-[#141414]"
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {err && (
              <div className="mt-3 flex items-center gap-2 text-sm text-[#C8372D]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#E5251B]" />
                {err}
              </div>
            )}

            <div className="mt-3.5 flex justify-end">
              <Link href="#" className="text-sm font-bold text-[#E5251B]">
                Forgot password?
              </Link>
            </div>

            <button type="submit" className={`mt-6 w-full ${btn}`}>
              {loading ? (
                <>
                  <span className="inline-block h-[18px] w-[18px] animate-[hwSpin_0.7s_linear_infinite] rounded-full border-2 border-white/35 border-t-white" />
                  Logging in…
                </>
              ) : (
                "Log in"
              )}
            </button>

            <div className="my-7 flex items-center gap-3.5 text-[13px] text-[#6B6B6B]">
              <span className="h-px flex-1 bg-[#EDE6E3]" />
              or
              <span className="h-px flex-1 bg-[#EDE6E3]" />
            </div>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-full border border-[#EDE6E3] text-[15px] font-bold transition-colors hover:bg-[#FAF7F5]"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#EDE6E3] text-xs font-black">
                G
              </span>
              Continue with Google
            </button>

            <p className="mt-8 text-center text-[15px] text-[#6B6B6B]">
              New here?{" "}
              <Link href="#" className="font-bold text-[#141414]">
                Create an account
              </Link>
            </p>
          </form>
        </div>

        <div className="relative -mx-6 -mb-8 h-20 overflow-hidden sm:-mx-10 lg:hidden">
          <Wave />
        </div>
      </div>

      <div className="relative hidden min-h-screen min-w-0 flex-1 basis-[520px] flex-col justify-center overflow-hidden border-l border-[#EDE6E3] bg-[#FAF7F5] px-8 py-[72px] lg:flex lg:px-[88px]">
        <div className="pointer-events-none absolute left-0 right-0 top-[38%] h-[140px] overflow-hidden">
          <Wave />
        </div>
        <div className="relative text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
          HEATWAVE TICKETS
        </div>
        <h2 className="relative mt-4 max-w-[11ch] text-[40px] font-black leading-[0.98] tracking-[-0.05em] lg:text-[64px]">
          Your next event, one tap away.
        </h2>
        <div className="relative mt-14 max-w-[420px] -rotate-2 animate-[hwUp_0.8s_0.15s_ease_both] overflow-hidden rounded-xl border border-[#EDE6E3] bg-white">
          <div className="flex">
            <div className="w-1.5 bg-[#E5251B]" />
            <div className="flex-1 px-6 py-[22px]">
              <div className="text-[11px] font-bold tracking-[0.14em] text-[#E5251B]">
                E-TICKET
              </div>
              <div className="mt-1.5 text-xl font-black tracking-[-0.025em]">
                Bay Beats Festival
              </div>
              <div className="mt-3.5 flex gap-6">
                <div>
                  <div className="text-[10px] font-bold tracking-[0.14em] text-[#6B6B6B]">
                    DATE
                  </div>
                  <div className="mt-[3px] text-sm font-bold">Sat, 6 Mar</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-[0.14em] text-[#6B6B6B]">
                    VENUE
                  </div>
                  <div className="mt-[3px] text-sm font-bold">
                    Chennai Trade Centre
                  </div>
                </div>
              </div>
            </div>
            <div className="flex w-24 items-center justify-center border-l border-dashed border-[#EDE6E3] bg-[#FAF7F5]">
              <div
                className="h-14 w-14 rounded-md opacity-85"
                style={{
                  background:
                    "repeating-linear-gradient(90deg,#141414 0 3px,transparent 3px 6px),repeating-linear-gradient(0deg,#141414 0 3px,transparent 3px 6px)",
                  backgroundBlendMode: "multiply",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
