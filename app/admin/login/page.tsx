"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ChangeEvent } from "react";
import { createClient } from "@/utils/supabase/client";

const btn =
  "inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-full text-base font-bold text-white transition-[background-position] duration-400 ease-out bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right hover:bg-left disabled:opacity-60";

type FieldKey = "email" | "pw";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [focus, setFocus] = useState<FieldKey | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "not-admin") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setErr("That account doesn't have admin access.");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (!/^\S+@\S+\.\S+$/.test(email) || pw.length < 6) {
      setErr("Incorrect email or password");
      return;
    }
    setErr("");
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) {
      setLoading(false);
      setErr(error.message);
      return;
    }
    router.push("/admin");
  }

  function field(key: FieldKey) {
    const value = key === "email" ? email : pw;
    const isFocused = focus === key;
    const up = isFocused || !!value;
    const bad = !!err;
    return {
      value,
      isFocused,
      up,
      border: bad || isFocused ? "#E5251B" : "#EDE6E3",
      ring: isFocused ? "0 0 0 3px rgba(229,37,27,.12)" : "none",
      labelTop: up ? "9px" : "19px",
      labelSize: up ? "12px" : "16px",
      labelColor: bad ? "#C8372D" : isFocused ? "#E5251B" : "#6B6B6B",
      onFocus: () => setFocus(key),
      onBlur: () => setFocus(null),
    };
  }

  function onEmailChange(e: ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    setErr("");
  }
  function onPwChange(e: ChangeEvent<HTMLInputElement>) {
    setPw(e.target.value);
    setErr("");
  }

  const emailField = field("email");
  const pwField = field("pw");

  return (
    <div
      className="flex min-h-screen flex-wrap bg-white text-[#141414]"
      style={{ fontFamily: "var(--font-satoshi)" }}
    >
      <div className="flex min-w-0 flex-1 basis-[520px] flex-col px-6 py-8 sm:px-10 lg:px-[72px]">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xl font-black tracking-[-0.04em]">
            heatwave
            <span className="h-[7px] w-[7px] rounded-full bg-[#E5251B]" />
          </span>
          <span className="rounded-full border border-[#EDE6E3] px-2.5 py-0.5 text-[11px] font-bold tracking-[0.14em] text-[#6B6B6B]">
            ADMIN
          </span>
        </div>

        <div className="flex flex-1 items-center py-12">
          <form
            onSubmit={handleSubmit}
            noValidate
            className="mx-auto w-full max-w-[400px] animate-[hwUp_0.6s_ease_both]"
          >
            <h1 className="m-0 text-[36px] font-black leading-[1] tracking-[-0.04em] sm:text-[44px]">
              Admin console
            </h1>
            <p className="mt-3 text-[15px] text-[#6B6B6B]">
              Sign in with your organiser account.
            </p>

            <div className="mt-9 flex flex-col gap-3.5">
              <div>
                <div className="relative">
                  <input
                    id="al-email"
                    type="email"
                    inputMode="email"
                    placeholder="Work email"
                    value={emailField.value}
                    onChange={onEmailChange}
                    onFocus={emailField.onFocus}
                    onBlur={emailField.onBlur}
                    style={{ borderColor: emailField.border, boxShadow: emailField.ring }}
                    className="h-[60px] w-full rounded-xl border bg-white px-4 pb-2 pt-6 text-base text-[#141414] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-transparent"
                  />
                  <label
                    htmlFor="al-email"
                    style={{
                      top: emailField.labelTop,
                      fontSize: emailField.labelSize,
                      color: emailField.labelColor,
                    }}
                    className="pointer-events-none absolute left-[17px] transition-all duration-150 ease-in-out"
                  >
                    Work email
                  </label>
                </div>
              </div>

              <div>
                <div className="relative">
                  <input
                    id="al-pw"
                    type={show ? "text" : "password"}
                    placeholder="Password"
                    value={pwField.value}
                    onChange={onPwChange}
                    onFocus={pwField.onFocus}
                    onBlur={pwField.onBlur}
                    style={{ borderColor: pwField.border, boxShadow: pwField.ring }}
                    className="h-[60px] w-full rounded-xl border bg-white px-4 pr-[72px] pb-2 pt-6 text-base text-[#141414] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-transparent"
                  />
                  <label
                    htmlFor="al-pw"
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
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-4 top-5 text-[13px] font-bold text-[#6B6B6B] hover:text-[#141414]"
                  >
                    {show ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

            </div>

            {err && (
              <div className="mt-3 flex items-center gap-2 text-sm text-[#C8372D]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#E5251B]" />
                {err}
              </div>
            )}

            <button type="submit" disabled={loading} className={`mt-7 ${btn}`}>
              {loading ? (
                <>
                  <span className="inline-block h-[18px] w-[18px] animate-[hwSpin_0.7s_linear_infinite] rounded-full border-2 border-white/35 border-t-white" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>

            <div className="mt-5 flex justify-between gap-3 text-[13px] text-[#6B6B6B]">
              <Link href="#" className="font-bold text-[#6B6B6B] hover:text-[#141414]">
                Forgot password?
              </Link>
              <span>Access is logged</span>
            </div>
          </form>
        </div>
      </div>

      <div className="relative hidden min-h-screen min-w-0 flex-1 basis-[440px] flex-col justify-end overflow-hidden border-l border-[#EDE6E3] bg-[#FAF7F5] px-8 py-[72px] lg:flex lg:px-20">
        <svg
          viewBox="0 0 800 120"
          preserveAspectRatio="none"
          className="absolute left-0 top-[42%] h-[120px] w-full"
        >
          <path
            d="M0 60 Q100 30 200 60 T400 60 T600 60 T800 60"
            fill="none"
            stroke="#E5251B"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="relative max-w-[360px]">
          <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">
            ORGANISER TOOLS
          </div>
          <p className="mt-3.5 text-[22px] font-medium leading-[1.35] tracking-[-0.01em]">
            Manage events, bookings, check-ins and payouts from one place.
          </p>
        </div>
      </div>
    </div>
  );
}
