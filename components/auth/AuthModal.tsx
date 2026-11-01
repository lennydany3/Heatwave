"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";

type Mode = "login" | "signup";
type Method = "otp" | "password";
type Step = "form" | "code";

const btn =
  "inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold text-white transition-[background-position] duration-400 ease-out bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right hover:bg-left disabled:opacity-60";

const inputBase =
  "h-[56px] w-full rounded-xl border bg-white px-4 pb-2 pt-6 text-base text-[#141414] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-transparent";

function FloatingField({
  id,
  type = "text",
  label,
  value,
  onChange,
  autoComplete,
  error,
}: {
  id: string;
  type?: string;
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  error?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const up = focused || !!value;
  return (
    <div className="relative">
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        placeholder={label}
        style={{
          borderColor: error ? "#E5251B" : focused ? "#E5251B" : "#EDE6E3",
          boxShadow: focused ? "0 0 0 3px rgba(229,37,27,.12)" : "none",
        }}
        className={inputBase}
      />
      <label
        htmlFor={id}
        style={{
          top: up ? "9px" : "19px",
          fontSize: up ? "12px" : "16px",
          color: error ? "#C8372D" : focused ? "#E5251B" : "#6B6B6B",
        }}
        className="pointer-events-none absolute left-[17px] transition-all duration-150 ease-in-out"
      >
        {label}
      </label>
    </div>
  );
}

export default function AuthModal({
  open,
  onClose,
  onAuthenticated,
  next = "/",
}: {
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
  next?: string;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  // Email-code flow: log-in defaults to a one-time code; sign-up verifies the email with one.
  const [method, setMethod] = useState<Method>("otp");
  const [step, setStep] = useState<Step>("form");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (!open) return;
    // Clear transient form state whenever the modal opens. Mode is
    // intentionally excluded — switching to "login" after a successful
    // signup needs its confirmation message to survive the mode change.
    /* eslint-disable react-hooks/set-state-in-effect */
    setError("");
    setInfo("");
    setLoading(false);
    setGoogleLoading(false);
    setStep("form");
    setCode("");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  function switchMode(next: Mode) {
    setError("");
    setInfo("");
    setStep("form");
    setCode("");
    setMode(next);
  }

  async function sendCode(): Promise<boolean> {
    const res = await fetch("/api/auth/otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), purpose: mode }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Couldn't send the code. Try again.");
      return false;
    }
    setCooldown(data?.resendIn ?? 30);
    return true;
  }

  async function verifyCode(value: string) {
    if (loading) return;
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        code: value,
        purpose: mode,
        fullName: fullName.trim(),
        password,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setLoading(false);
      setCode("");
      setError(data?.error ?? "Couldn't verify the code. Try again.");
      return;
    }
    // Full navigation so the app picks up the new session cookie.
    if (next && next !== "/") window.location.href = next;
    else window.location.reload();
  }

  async function resendCode() {
    if (cooldown > 0 || loading) return;
    setError("");
    setInfo("");
    setLoading(true);
    const ok = await sendCode();
    setLoading(false);
    if (ok) setInfo("We sent you a new code.");
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setInfo("");

    if (step === "code") {
      if (!/^\d{6}$/.test(code)) {
        setError("Enter the 6-digit code from your email");
        return;
      }
      await verifyCode(code);
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address");
      return;
    }
    const usePassword = mode === "signup" || method === "password";
    if (usePassword && password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (mode === "signup" && fullName.trim().length < 2) {
      setError("Enter your full name");
      return;
    }

    setLoading(true);

    // Log in with a password (the older flow, kept as an option).
    if (mode === "login" && method === "password") {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      onAuthenticated();
      return;
    }

    // Everything else starts by emailing a code through Resend.
    const sent = await sendCode();
    setLoading(false);
    if (sent) {
      setStep("code");
      setInfo(`We emailed a 6-digit code to ${email.trim()}.`);
    }
  }

  async function handleGoogle() {
    if (googleLoading) return;
    setError("");
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          next
        )}`,
      },
    });
    if (error) {
      setGoogleLoading(false);
      setError(error.message);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[#141414]/40 p-0 sm:items-center sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="max-h-[92dvh] w-full max-w-[440px] animate-[hwUp_0.3s_ease_both] overflow-y-auto overscroll-contain rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl sm:pb-0"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-[#EDE6E3] sm:hidden" />
        <div className="flex items-center justify-between gap-4 border-b border-[#EDE6E3] px-5 py-3.5 sm:px-6 sm:py-5">
          <div className="flex items-center gap-1.5 text-lg font-black tracking-[-0.04em]">
            heatwave
            <span className="h-[7px] w-[7px] rounded-full bg-[#E5251B]" />
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-[#6B6B6B] hover:bg-[#FAF7F5] hover:text-[#141414]"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-6 pt-5 sm:px-6 sm:py-6">
          <h2 className="m-0 text-[24px] font-black tracking-[-0.03em] sm:text-[26px]">
            {step === "code"
              ? "Enter your code"
              : mode === "login"
                ? "Log in to continue"
                : "Create your account"}
          </h2>
          <p className="mt-1.5 text-sm text-[#6B6B6B]">
            {step === "code"
              ? mode === "signup"
                ? "Confirm your email to finish creating your account."
                : "Enter the code we emailed you to log in."
              : mode === "login"
                ? "Log in to register for Caseano."
                : "Sign up to register and keep your tickets in one place."}
          </p>

          {step === "form" && (
            <div className="mt-6 flex flex-col gap-3.5">
              {mode === "signup" && (
                <FloatingField
                  id="auth-name"
                  label="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              )}
              <FloatingField
                id="auth-email"
                type="email"
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              {(mode === "signup" || method === "password") && (
                <FloatingField
                  id="auth-password"
                  type="password"
                  label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              )}
            </div>
          )}

          {step === "code" && (
            <div className="mt-6">
              <input
                id="auth-code"
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                  if (v.length === 6) verifyCode(v);
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                placeholder="••••••"
                aria-label="6-digit code"
                className="h-[64px] w-full rounded-xl border border-[#EDE6E3] bg-white px-4 text-center font-mono text-[30px] font-black tracking-[0.5em] text-[#141414] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#D5CDC9] focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)]"
              />
              <div className="mt-3 flex items-center justify-between text-[13px]">
                <button
                  type="button"
                  onClick={() => {
                    setStep("form");
                    setCode("");
                    setError("");
                    setInfo("");
                  }}
                  className="font-bold text-[#6B6B6B] hover:text-[#141414]"
                >
                  ← Change email
                </button>
                <button
                  type="button"
                  onClick={resendCode}
                  disabled={cooldown > 0 || loading}
                  className="font-bold text-[#E5251B] disabled:text-[#B5ADA9]"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-[#C8372D]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E5251B]" />
              {error}
            </div>
          )}
          {info && (
            <div className="mt-3 rounded-lg bg-[#FAF7F5] px-3.5 py-2.5 text-sm text-[#6B6B6B]">
              {info}
            </div>
          )}

          <button type="submit" disabled={loading} className={`mt-6 ${btn}`}>
            {loading ? (
              <>
                <span className="inline-block h-[18px] w-[18px] animate-[hwSpin_0.7s_linear_infinite] rounded-full border-2 border-white/35 border-t-white" />
                {step === "code"
                  ? "Verifying…"
                  : mode === "login" && method === "password"
                    ? "Logging in…"
                    : "Sending code…"}
              </>
            ) : step === "code" ? (
              mode === "signup" ? (
                "Verify & create account"
              ) : (
                "Verify & log in"
              )
            ) : mode === "login" && method === "password" ? (
              "Log in"
            ) : mode === "login" ? (
              "Email me a code"
            ) : (
              "Send verification code"
            )}
          </button>

          {mode === "login" && step === "form" && (
            <button
              type="button"
              onClick={() => {
                setMethod(method === "otp" ? "password" : "otp");
                setError("");
                setInfo("");
              }}
              className="mt-3.5 block w-full text-center text-[13px] font-bold text-[#6B6B6B] hover:text-[#141414]"
            >
              {method === "otp" ? "Use password instead" : "Email me a code instead"}
            </button>
          )}

          <div className="my-5 flex items-center gap-3 text-[13px] text-[#6B6B6B]">
            <span className="h-px flex-1 bg-[#EDE6E3]" />
            or
            <span className="h-px flex-1 bg-[#EDE6E3]" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="flex h-[52px] w-full items-center justify-center gap-3 rounded-full border border-[#EDE6E3] text-[15px] font-bold transition-colors hover:bg-[#FAF7F5] disabled:opacity-60"
          >
            {googleLoading ? (
              <span className="inline-block h-[18px] w-[18px] animate-[hwSpin_0.7s_linear_infinite] rounded-full border-2 border-[#EDE6E3] border-t-[#6B6B6B]" />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#EDE6E3] text-xs font-black">
                G
              </span>
            )}
            Continue with Google
          </button>

          <p className="mt-5 text-center text-sm text-[#6B6B6B]">
            {mode === "login" ? (
              <>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="font-bold text-[#141414]"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="font-bold text-[#141414]"
                >
                  Log in
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
