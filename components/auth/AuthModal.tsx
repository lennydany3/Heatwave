"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";

type Mode = "login" | "signup";

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
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  function switchMode(next: Mode) {
    setError("");
    setInfo("");
    setMode(next);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setInfo("");

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (mode === "signup" && fullName.trim().length < 2) {
      setError("Enter your full name");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      onAuthenticated();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      onAuthenticated();
      return;
    }
    setInfo("Account created. Check your email to confirm it, then log in.");
    setMode("login");
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
        className="w-full max-w-[440px] animate-[hwUp_0.3s_ease_both] overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#EDE6E3] px-6 py-5">
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

        <form onSubmit={handleSubmit} className="px-6 py-6">
          <h2 className="m-0 text-[26px] font-black tracking-[-0.03em]">
            {mode === "login" ? "Log in to continue" : "Create your account"}
          </h2>
          <p className="mt-1.5 text-sm text-[#6B6B6B]">
            {mode === "login"
              ? "Log in to register for Product Builders Summit 2027."
              : "Sign up to register and keep your tickets in one place."}
          </p>

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
            <FloatingField
              id="auth-password"
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </div>

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
                {mode === "login" ? "Logging in…" : "Creating account…"}
              </>
            ) : mode === "login" ? (
              "Log in"
            ) : (
              "Create account"
            )}
          </button>

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
