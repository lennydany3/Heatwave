"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { useMe } from "../_lib/access";
import HeatwaveLoader from "@/components/HeatwaveLoader";
import {
  PAGES,
  ROLE_LABEL,
  defaultPermissions,
  type Permissions,
  type Role,
} from "@/lib/permissions";

type Member = {
  id: string;
  email: string;
  fullName: string | null;
  role: Role;
  permissions: Permissions | null;
  lastSignIn: string | null;
  createdAt: string;
};

type Draft = {
  id: string | null; // null = creating
  email: string;
  fullName: string;
  password: string;
  role: Role;
  permissions: Permissions;
};

const ROLE_INFO: Record<Role, { desc: string; color: [string, string, string] }> = {
  admin: {
    desc: "Full access to every page, including Settings. Can add and manage the team.",
    color: ["#FDECEA", "#B71C14", "#E5251B"],
  },
  manager: {
    desc: "Runs the event day to day. You choose which pages they see and what stays hidden.",
    color: ["#FFF6E5", "#8A5A00", "#D99A1E"],
  },
  staff: {
    desc: "Front-line access, e.g. check-in at the gate. Start minimal, then add pages.",
    color: ["#EEF4EF", "#2F6B45", "#3F8A5A"],
  },
};

const CONFIGURABLE = PAGES.filter((p) => !p.adminOnly);

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("") + "!7";
}

function RoleBadge({ role }: { role: Role }) {
  const c = ROLE_INFO[role].color;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold"
      style={{ background: c[0], color: c[1] }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c[2] }} />
      {ROLE_LABEL[role]}
    </span>
  );
}

function pageSummary(m: Member) {
  if (m.role === "admin") return "All pages";
  const pages = CONFIGURABLE.filter((p) => Array.isArray(m.permissions?.[p.key]));
  if (pages.length === 0) return "No pages yet";
  const masked = pages.reduce((a, p) => a + (m.permissions?.[p.key]?.length ?? 0), 0);
  return `${pages.length} page${pages.length === 1 ? "" : "s"}${masked ? ` · ${masked} item${masked === 1 ? "" : "s"} hidden` : ""}`;
}

export default function AdminSettingsPage() {
  const me = useMe();
  const [q, setQ] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [migrated, setMigrated] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  // The email already has a (customer) account: ask before reusing it.
  const [existsPrompt, setExistsPrompt] = useState(false);
  const [toRemove, setToRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function showToast(msg: string) {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(""), 2800);
  }

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/team", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      setLoadError(data?.error ?? "Couldn't load the team");
    } else {
      setLoadError("");
      setMembers(data.members);
      setMigrated(data.migrated);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Data fetch on mount; state is set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function startCreate() {
    setDraft({
      id: null,
      email: "",
      fullName: "",
      password: "",
      role: "staff",
      permissions: defaultPermissions("staff"),
    });
    setStep(1);
    setShowPw(false);
    setFormError("");
  }

  function startEdit(m: Member) {
    setDraft({
      id: m.id,
      email: m.email,
      fullName: m.fullName ?? "",
      password: "",
      role: m.role,
      permissions: m.permissions ?? {},
    });
    setStep(1);
    setShowPw(false);
    setFormError("");
  }

  function setRole(role: Role) {
    setDraft((d) => (d ? { ...d, role, permissions: role === "admin" ? {} : d.permissions } : d));
  }

  function togglePage(key: string, on: boolean) {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d.permissions } as Record<string, string[]>;
      if (on) next[key] = next[key] ?? [];
      else delete next[key];
      return { ...d, permissions: next as Permissions };
    });
  }

  function toggleMask(page: string, item: string, masked: boolean) {
    setDraft((d) => {
      if (!d) return d;
      const cur = (d.permissions as Record<string, string[]>)[page] ?? [];
      const next = masked ? Array.from(new Set([...cur, item])) : cur.filter((x) => x !== item);
      return { ...d, permissions: { ...d.permissions, [page]: next } as Permissions };
    });
  }

  function goStep2() {
    if (!draft) return;
    setFormError("");
    if (!draft.id) {
      if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) return setFormError("Enter a valid email address");
      if (draft.password.length < 8) return setFormError("Password must be at least 8 characters");
    } else if (draft.password && draft.password.length < 8) {
      return setFormError("New password must be at least 8 characters");
    }
    if (draft.role === "admin") {
      save();
      return;
    }
    setStep(2);
  }

  async function save(useExisting = false) {
    if (!draft) return;
    setSaving(true);
    setFormError("");
    setExistsPrompt(false);
    const payload = {
      id: draft.id,
      email: draft.email.trim(),
      fullName: draft.fullName.trim(),
      password: draft.password || undefined,
      role: draft.role,
      permissions: draft.role === "admin" ? null : draft.permissions,
      useExisting,
    };
    const res = await fetch("/api/admin/team", {
      method: draft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      if (data?.code === "email_exists") {
        setExistsPrompt(true);
        setStep(1);
        return;
      }
      setFormError(data?.error ?? "Couldn't save — try again");
      if (step === 2 && /email|password/i.test(data?.error ?? "")) setStep(1);
      return;
    }
    showToast(draft.id ? "Access updated" : `${draft.email.trim()} added as ${ROLE_LABEL[draft.role]}`);
    setDraft(null);
    await load();
  }

  async function confirmRemove() {
    if (!toRemove) return;
    setRemoving(true);
    const res = await fetch("/api/admin/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: toRemove.id }),
    });
    const data = await res.json().catch(() => null);
    setRemoving(false);
    if (!res.ok) {
      showToast(data?.error ?? "Couldn't remove — try again");
      return;
    }
    showToast(`${toRemove.email} no longer has portal access`);
    setToRemove(null);
    await load();
  }

  const forbidden = me && me.role !== "admin";
  const list = members.filter(
    (m) => !q.trim() || (m.email + (m.fullName ?? "")).toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <AdminShell active="settings" search={q} onSearchChange={setQ}>
      {!draft && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold tracking-[0.14em] text-[#6B6B6B]">SETTINGS</div>
              <h1 className="m-0 mt-2 text-[30px] font-black leading-[1] tracking-[-0.04em] sm:text-[40px]">
                Team &amp; access
              </h1>
              <p className="mt-2 max-w-[620px] text-sm leading-relaxed text-[#6B6B6B]">
                Add people to the admin portal as an Admin, Manager or Staff. For managers and
                staff you choose which sidebar pages they see and which details stay hidden.
              </p>
            </div>
            {!forbidden && (
              <button
                onClick={startCreate}
                className="inline-flex h-11 items-center rounded-full bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right px-6 text-sm font-bold text-white transition-[background-position] duration-400 ease-out hover:bg-left"
              >
                + Add team member
              </button>
            )}
          </div>

          {!loading && !migrated && (
            <div className="mt-6 rounded-xl bg-[#FFF6E5] px-5 py-4 text-sm leading-relaxed text-[#8A5A00]">
              <span className="font-bold">One-time setup needed.</span> Run{" "}
              <span className="font-bold">supabase/roles-permissions.sql</span> in the Supabase SQL
              editor (step 1, then step 2) to turn on the Manager and Staff roles.
            </div>
          )}

          {loading && (
            <div className="mt-16">
              <HeatwaveLoader label="Loading team" />
            </div>
          )}

          {!loading && loadError && (
            <div className="mt-10 text-center text-lg font-bold text-[#B71C14]">{loadError}</div>
          )}

          {!loading && !loadError && (
            <div className="mt-7 flex max-w-[860px] flex-col gap-3">
              {list.map((m) => (
                <div
                  key={m.id}
                  className="flex animate-[hwUp_0.4s_ease_both] flex-wrap items-center gap-4 rounded-xl border border-[#EDE6E3] bg-white px-5 py-4"
                >
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#141414] text-sm font-bold text-white">
                    {(m.fullName || m.email).slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1 basis-[220px]">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="truncate text-[16px] font-bold">{m.fullName || m.email}</span>
                      <RoleBadge role={m.role} />
                      {m.id === me?.id && (
                        <span className="rounded-full border border-[#EDE6E3] px-2 py-0.5 text-[11px] font-bold text-[#6B6B6B]">
                          You
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[13px] text-[#6B6B6B]">
                      {m.fullName ? `${m.email} · ` : ""}
                      {pageSummary(m)}
                      {m.lastSignIn
                        ? ` · last sign-in ${new Date(m.lastSignIn).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                        : " · never signed in"}
                    </div>
                  </div>
                  {!forbidden && (
                    <div className="flex flex-none gap-2">
                      <button
                        onClick={() => startEdit(m)}
                        className="h-9 rounded-full border border-[#EDE6E3] px-5 text-[13px] font-bold hover:border-[#141414]"
                      >
                        Edit access
                      </button>
                      {m.id !== me?.id && (
                        <button
                          onClick={() => setToRemove(m)}
                          className="h-9 rounded-full border border-[#F3C9C5] px-5 text-[13px] font-bold text-[#B71C14] hover:bg-[#B71C14] hover:text-white"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {list.length === 0 && (
                <div className="rounded-xl border border-[#EDE6E3] px-6 py-14 text-center text-sm text-[#6B6B6B]">
                  No team members match.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {draft && (
        <div className="max-w-[860px]">
          <button
            onClick={() => setDraft(null)}
            className="text-sm font-bold text-[#6B6B6B] hover:text-[#141414]"
          >
            ← Team
          </button>
          <h1 className="m-0 mt-3.5 text-[30px] font-black leading-[1] tracking-[-0.04em] sm:text-[40px]">
            {draft.id ? "Edit access" : "Add team member"}
          </h1>
          <div className="mt-5 flex gap-7 text-sm font-bold">
            {["Account & role", "Sidebar & masking"].map((l, i) => (
              <span key={l} className="flex gap-2" style={{ color: step >= i + 1 ? "#141414" : "#6B6B6B" }}>
                <span style={{ color: step >= i + 1 ? "#E5251B" : "#6B6B6B" }}>0{i + 1}</span>
                {l}
              </span>
            ))}
          </div>

          {step === 1 && (
            <section className="mt-7 rounded-xl border border-[#EDE6E3] p-6">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[13px] font-bold text-[#6B6B6B]">Full name (optional)</span>
                  <input
                    value={draft.fullName}
                    onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                    className="mt-1.5 h-12 w-full rounded-xl border border-[#EDE6E3] px-4 text-base outline-none focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)]"
                  />
                </label>
                <label className="block">
                  <span className="text-[13px] font-bold text-[#6B6B6B]">Email</span>
                  <input
                    value={draft.email}
                    onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                    disabled={!!draft.id}
                    type="email"
                    autoComplete="off"
                    className="mt-1.5 h-12 w-full rounded-xl border border-[#EDE6E3] px-4 text-base outline-none focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)] disabled:bg-[#FAF7F5] disabled:text-[#6B6B6B]"
                  />
                </label>
              </div>
              <label className="mt-3.5 block">
                <span className="text-[13px] font-bold text-[#6B6B6B]">
                  {draft.id ? "New password (leave empty to keep the current one)" : "Password"}
                </span>
                <div className="mt-1.5 flex gap-2">
                  <input
                    value={draft.password}
                    onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="h-12 min-w-0 flex-1 rounded-xl border border-[#EDE6E3] px-4 text-base outline-none focus:border-[#E5251B] focus:shadow-[0_0_0_3px_rgba(229,37,27,.12)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="h-12 rounded-xl border border-[#EDE6E3] px-4 text-sm font-bold text-[#6B6B6B]"
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft({ ...draft, password: randomPassword() });
                      setShowPw(true);
                    }}
                    className="h-12 rounded-xl border border-[#EDE6E3] px-4 text-sm font-bold text-[#E5251B]"
                  >
                    Generate
                  </button>
                </div>
              </label>

              <div className="mt-6 text-[13px] font-bold text-[#6B6B6B]">Role</div>
              <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {(["admin", "manager", "staff"] as Role[]).map((r) => {
                  const on = draft.role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      disabled={draft.id === me?.id && r !== "admin"}
                      style={{
                        borderColor: on ? "#E5251B" : "#EDE6E3",
                        boxShadow: on ? "0 0 0 1px #E5251B" : "none",
                      }}
                      className="rounded-xl border p-4 text-left disabled:opacity-40"
                    >
                      <div className="text-[15px] font-bold">{ROLE_LABEL[r]}</div>
                      <div className="mt-1 text-[13px] leading-snug text-[#6B6B6B]">{ROLE_INFO[r].desc}</div>
                    </button>
                  );
                })}
              </div>

              {formError && <div className="mt-4 text-sm text-[#C8372D]">{formError}</div>}
              {existsPrompt && (
                <div className="mt-4 rounded-xl bg-[#FFF6E5] px-5 py-4 text-sm leading-relaxed text-[#8A5A00]">
                  <span className="font-bold">{draft.email} already has an account</span> (for example a
                  customer who registered for the event). You can give that same account portal access
                  as {ROLE_LABEL[draft.role]}. Their password will be changed to the one you entered,
                  so they can sign in at the admin console with it.
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => save(true)}
                      disabled={saving}
                      className="h-10 rounded-full bg-[#8A5A00] px-5 text-[13px] font-bold text-white disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Use this account"}
                    </button>
                    <button
                      onClick={() => setExistsPrompt(false)}
                      className="h-10 rounded-full border border-[#8A5A00]/30 px-5 text-[13px] font-bold"
                    >
                      Use a different email
                    </button>
                  </div>
                </div>
              )}
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  onClick={() => setDraft(null)}
                  className="h-11 rounded-full border border-[#EDE6E3] px-6 text-sm font-bold"
                >
                  Cancel
                </button>
                {draft.id && draft.role !== "admin" && (
                  <button
                    onClick={() => save()}
                    disabled={saving}
                    className="h-11 rounded-full border border-[#141414] px-6 text-sm font-bold disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save without changing access"}
                  </button>
                )}
                <button
                  onClick={goStep2}
                  disabled={saving}
                  className="h-11 rounded-full bg-[#141414] px-6 text-sm font-bold text-white disabled:opacity-50"
                >
                  {draft.role === "admin"
                    ? saving
                      ? "Saving…"
                      : draft.id
                        ? "Save"
                        : "Create admin"
                    : "Next: choose access →"}
                </button>
              </div>
            </section>
          )}

          {step === 2 && draft.role !== "admin" && (
            <section className="mt-7">
              <p className="m-0 text-sm leading-relaxed text-[#6B6B6B]">
                Tick the pages <span className="font-bold text-[#141414]">{draft.email || "this person"}</span>{" "}
                should see in the sidebar. Inside each page, tick what should be{" "}
                <span className="font-bold text-[#141414]">hidden</span> from them. Hidden details are
                removed on the server, not just covered up on screen.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["manager", "staff"] as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setDraft({ ...draft, permissions: defaultPermissions(r) })}
                    className="rounded-full border border-[#EDE6E3] px-3.5 py-1.5 text-[13px] font-bold text-[#6B6B6B] hover:border-[#141414] hover:text-[#141414]"
                  >
                    {ROLE_LABEL[r]} preset
                  </button>
                ))}
                <button
                  onClick={() =>
                    setDraft({
                      ...draft,
                      permissions: Object.fromEntries(CONFIGURABLE.map((p) => [p.key, []])) as Permissions,
                    })
                  }
                  className="rounded-full border border-[#EDE6E3] px-3.5 py-1.5 text-[13px] font-bold text-[#6B6B6B] hover:border-[#141414] hover:text-[#141414]"
                >
                  All pages, nothing hidden
                </button>
                <button
                  onClick={() => setDraft({ ...draft, permissions: {} })}
                  className="rounded-full border border-[#EDE6E3] px-3.5 py-1.5 text-[13px] font-bold text-[#6B6B6B] hover:border-[#141414] hover:text-[#141414]"
                >
                  Clear
                </button>
              </div>

              <div className="mt-5 flex flex-col gap-3">
                {CONFIGURABLE.map((p) => {
                  const perms = draft.permissions as Record<string, string[]>;
                  const visible = Array.isArray(perms[p.key]);
                  const masked = perms[p.key] ?? [];
                  return (
                    <div
                      key={p.key}
                      className="rounded-xl border bg-white p-5"
                      style={{ borderColor: visible ? "#141414" : "#EDE6E3" }}
                    >
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={(e) => togglePage(p.key, e.target.checked)}
                          className="h-5 w-5 accent-[#E5251B]"
                        />
                        <span className="text-[16px] font-bold">{p.label}</span>
                        <span className="text-[13px] text-[#6B6B6B]">
                          {visible
                            ? masked.length
                              ? `${masked.length} item${masked.length === 1 ? "" : "s"} hidden`
                              : "nothing hidden"
                            : "not in sidebar"}
                        </span>
                      </label>
                      {visible && (
                        <div className="mt-4 border-t border-dashed border-[#EDE6E3] pt-4">
                          <div className="text-[11px] font-bold tracking-[0.12em] text-[#6B6B6B]">
                            HIDE FROM THIS PERSON
                          </div>
                          <div className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                            {p.masks.map((mk) => (
                              <label key={mk.key} className="flex cursor-pointer items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={masked.includes(mk.key)}
                                  onChange={(e) => toggleMask(p.key, mk.key, e.target.checked)}
                                  className="mt-0.5 h-4 w-4 flex-none accent-[#B71C14]"
                                />
                                <span>
                                  <span className="block text-sm font-bold">{mk.label}</span>
                                  <span className="block text-[12px] leading-snug text-[#6B6B6B]">
                                    {mk.hint}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {Object.keys(draft.permissions).length === 0 && (
                <div className="mt-4 rounded-xl bg-[#FFF6E5] px-5 py-3.5 text-sm text-[#8A5A00]">
                  No pages ticked: this person won&apos;t be able to open anything after signing in.
                </div>
              )}
              {formError && <div className="mt-4 text-sm text-[#C8372D]">{formError}</div>}
              <div className="mt-6 flex justify-between gap-2.5">
                <button
                  onClick={() => setStep(1)}
                  className="h-11 rounded-full border border-[#EDE6E3] px-6 text-sm font-bold"
                >
                  ← Back
                </button>
                <button
                  onClick={() => save()}
                  disabled={saving}
                  className="h-11 min-w-[170px] rounded-full bg-[linear-gradient(90deg,#B71C14_50%,#E5251B_50%)] bg-[length:202%_100%] bg-right px-6 text-sm font-bold text-white transition-[background-position] duration-400 ease-out hover:bg-left disabled:opacity-60"
                >
                  {saving ? "Saving…" : draft.id ? "Save access" : `Create ${ROLE_LABEL[draft.role].toLowerCase()}`}
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {toRemove && (
        <div
          onClick={() => !removing && setToRemove(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#141414]/60 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            className="w-full max-w-[440px] animate-[hwUp_0.25s_ease_both] overflow-hidden rounded-xl bg-white"
          >
            <div className="bg-[#B71C14] px-6 py-4 text-[17px] font-black text-white">
              Remove portal access?
            </div>
            <div className="px-6 py-5">
              <p className="m-0 text-[15px] leading-relaxed">
                <span className="font-bold">{toRemove.email}</span> will no longer be able to open the
                admin portal. Their login stays as an ordinary customer account.
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  onClick={() => setToRemove(null)}
                  disabled={removing}
                  className="h-11 rounded-full border border-[#EDE6E3] px-5 text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemove}
                  disabled={removing}
                  className="h-11 rounded-full bg-[#B71C14] px-5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {removing ? "Removing…" : "Remove access"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-7 left-1/2 z-[80] flex -translate-x-1/2 animate-[hwUp_0.3s_ease_both] items-center gap-2.5 whitespace-nowrap rounded-full bg-[#141414] px-5 py-3 text-sm text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-[#6FBF8A]" />
          {toastMsg}
        </div>
      )}
    </AdminShell>
  );
}
