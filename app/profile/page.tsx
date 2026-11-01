"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import BottomNav, { BOTTOM_NAV_SPACE } from "@/components/BottomNav";
import Navbar from "@/components/Navbar";
import SupportModal from "@/components/SupportModal";
import { createClient } from "@/utils/supabase/client";

function Row({
  label,
  hint,
  href,
  onClick,
  danger = false,
  icon,
}: {
  label: string;
  hint?: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  icon: ReactNode;
}) {
  const body = (
    <>
      <span
        className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${
          danger ? "bg-[#FDECEA] text-[#E5251B]" : "bg-[#FAF7F5] text-[#141414]"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          {icon}
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[15px] font-bold ${danger ? "text-[#E5251B]" : ""}`}>{label}</span>
        {hint && <span className="block truncate text-[13px] text-[#6B6B6B]">{hint}</span>}
      </span>
      {!danger && <span className="text-[#C9BFBB]">→</span>}
    </>
  );
  const cls =
    "flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-[#FCFAF9] active:bg-[#FAF7F5]";
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 px-1 text-[11px] font-bold tracking-[0.14em] text-[#9A918D]">{title}</div>
      <div className="divide-y divide-[#EDE6E3] overflow-hidden rounded-2xl border border-[#EDE6E3] bg-white">
        {children}
      </div>
    </section>
  );
}

export default function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const savedName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ticketCount, setTicketCount] = useState<number | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    createClient()
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => {
        if (!cancelled) setTicketCount(count ?? 0);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const displayName = savedName || user?.email?.split("@")[0] || "";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "U";
  const provider = user?.app_metadata?.provider === "google" ? "Google" : "Email";
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : "";

  function startEdit() {
    setName(savedName);
    setMsg(null);
    setEditing(true);
  }

  async function saveName(e: FormEvent) {
    e.preventDefault();
    const next = name.trim();
    if (next.length < 2) {
      setMsg({ ok: false, text: "Enter your full name" });
      return;
    }
    setSaving(true);
    const { error } = await createClient().auth.updateUser({ data: { full_name: next } });
    setSaving(false);
    if (error) {
      setMsg({ ok: false, text: error.message });
      return;
    }
    setEditing(false);
    setMsg({ ok: true, text: "Name updated" });
  }

  async function logout() {
    await signOut();
    router.push("/");
  }

  return (
    <div
      className={`min-h-screen bg-[#FAF7F5] text-[#141414] ${BOTTOM_NAV_SPACE}`}
      style={{ fontFamily: "var(--font-satoshi)" }}
    >
      <Navbar />

      <main className="mx-auto max-w-[560px] px-5 pb-16 pt-8 sm:pt-12">
        {loading || !user ? (
          <div className="h-[140px] animate-[hwPulse_1.4s_ease_infinite] rounded-2xl bg-white" />
        ) : (
          <>
            <div className="flex animate-[hwUp_0.5s_ease_both] items-center gap-4">
              <span className="relative flex h-[72px] w-[72px] flex-none items-center justify-center rounded-full bg-[#141414] text-[24px] font-black tracking-[-0.03em] text-white">
                {initials}
                <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-[3px] border-[#FAF7F5] bg-[#E5251B]" />
              </span>
              <div className="min-w-0">
                <h1 className="m-0 truncate text-[28px] font-black leading-none tracking-[-0.045em] sm:text-[34px]">
                  {displayName}
                </h1>
                <div className="mt-1.5 truncate text-[14px] text-[#6B6B6B]">{user.email}</div>
                {memberSince && (
                  <div className="mt-0.5 text-[12px] text-[#9A918D]">Member since {memberSince}</div>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Link
                href="/dashboard"
                className="rounded-2xl border border-[#EDE6E3] bg-white px-4 py-3.5 transition-colors hover:bg-[#FCFAF9]"
              >
                <div className="text-[10px] font-bold tracking-[0.14em] text-[#9A918D]">TICKETS</div>
                <div className="mt-0.5 text-[26px] font-black leading-none tracking-[-0.04em] tabular-nums">
                  {ticketCount ?? "–"}
                </div>
              </Link>
              <div className="rounded-2xl border border-[#EDE6E3] bg-white px-4 py-3.5">
                <div className="text-[10px] font-bold tracking-[0.14em] text-[#9A918D]">SIGN-IN</div>
                <div className="mt-1 text-[17px] font-black tracking-[-0.02em]">{provider}</div>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-6">
              <Card title="PERSONAL DETAILS">
                {editing ? (
                  <form onSubmit={saveName} className="p-4">
                    <label htmlFor="pf-name" className="text-[12px] font-bold text-[#6B6B6B]">
                      Full name
                    </label>
                    <input
                      id="pf-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                      autoComplete="name"
                      className="mt-1.5 h-12 w-full rounded-xl border border-[#EDE6E3] bg-white px-4 text-base outline-none transition-[border-color,box-shadow] focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)]"
                    />
                    {msg && !msg.ok && <div className="mt-2 text-[13px] text-[#C8372D]">{msg.text}</div>}
                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="h-11 rounded-full border border-[#EDE6E3] text-[14px] font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="h-11 rounded-full bg-[#E5251B] text-[14px] font-bold text-white transition-colors hover:bg-[#CF2017] disabled:opacity-60"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <Row
                    label="Full name"
                    hint={savedName || "Add your name"}
                    onClick={startEdit}
                    icon={
                      <path
                        d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    }
                  />
                )}
                <div className="flex items-center gap-3.5 px-4 py-3.5">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#FAF7F5]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="2" />
                      <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold">Email</span>
                    <span className="block truncate text-[13px] text-[#6B6B6B]">{user.email}</span>
                  </span>
                </div>
              </Card>
              {msg?.ok && (
                <div className="-mt-3 px-1 text-[13px] font-bold text-[#2F6B45]">✓ {msg.text}</div>
              )}

              <Card title="HELP & LEGAL">
                <Row
                  label="Contact support"
                  hint="Questions about a ticket or payment"
                  onClick={() => setSupportOpen(true)}
                  icon={
                    <path
                      d="M4 12a8 8 0 1116 0v5a2 2 0 01-2 2h-2v-6h4M4 12v1h4v6H6a2 2 0 01-2-2v-5z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  }
                />
                <Row
                  label="Terms & Conditions"
                  href="/terms"
                  icon={
                    <path
                      d="M7 3h7l4 4v14H7V3zM14 3v4h4M10 12h5M10 16h5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  }
                />
                <Row
                  label="Privacy Policy"
                  href="/privacy"
                  icon={
                    <path
                      d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                  }
                />
              </Card>

              <div className="overflow-hidden rounded-2xl border border-[#EDE6E3] bg-white">
                <Row
                  label="Log out"
                  danger
                  onClick={logout}
                  icon={
                    <path
                      d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 8l-4 4 4 4M6 12h10"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  }
                />
              </div>
            </div>
          </>
        )}
      </main>

      <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
      <BottomNav />
    </div>
  );
}
