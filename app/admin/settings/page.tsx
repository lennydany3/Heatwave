"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminShell from "../_components/AdminShell";
import { useMe } from "../_lib/access";
import HeatwaveLoader from "@/components/HeatwaveLoader";
import { DangerBar, Empty, INPUT, PageHeader, Panel, Pill, RED_BUTTON, Sheet, SheetActions, Toast } from "../_components/ui";
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
  return <Pill tone={ROLE_INFO[role].color}>{ROLE_LABEL[role]}</Pill>;
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
          <PageHeader
            eyebrow="SETTINGS"
            title="Team & access"
            action={
              !forbidden && (
                <button
                  onClick={startCreate}
                  className={`inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-sm font-bold sm:h-11 sm:w-auto ${RED_BUTTON}`}
                >
                  + Add team member
                </button>
              )
            }
          >
            Add people to the admin portal as an Admin, Manager or Staff. For managers and staff you
            choose which sidebar pages they see and which details stay hidden.
          </PageHeader>

          {!loading && !migrated && (
            <div className="mt-6 rounded-2xl bg-[#FFF6E5] px-5 py-4 text-sm leading-relaxed text-[#8A5A00]">
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

          {!loading && loadError && <Empty bare error title={loadError} />}

          {!loading && !loadError && (
            <div className="mt-6 flex max-w-[900px] flex-col gap-2.5 sm:mt-8 sm:gap-3">
              {list.map((m, i) => (
                <div
                  key={m.id}
                  style={{ animationDelay: `${i * 50}ms` }}
                  className="flex animate-[hwUp_0.4s_ease_both] flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-[#EDE6E3] bg-white p-4 shadow-[0_1px_2px_rgba(20,20,20,.04)] sm:px-5"
                >
                  <span
                    className={`flex h-11 w-11 flex-none items-center justify-center rounded-full text-sm font-bold text-white ${
                      m.role === "admin" ? "bg-[#E5251B]" : "bg-[#141414]"
                    }`}
                  >
                    {(m.fullName || m.email).slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1 basis-[200px]">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                      <span className="min-w-0 truncate text-[15px] font-bold sm:text-[16px]">{m.fullName || m.email}</span>
                      <RoleBadge role={m.role} />
                      {m.id === me?.id && (
                        <span className="rounded-full border border-[#EDE6E3] px-2 py-0.5 text-[11px] font-bold text-[#6B6B6B]">
                          You
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[12.5px] leading-snug text-[#6B6B6B] sm:truncate sm:text-[13px]">
                      {m.fullName ? `${m.email} · ` : ""}
                      {pageSummary(m)}
                      {m.lastSignIn
                        ? ` · last sign-in ${new Date(m.lastSignIn).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                        : " · never signed in"}
                    </div>
                  </div>
                  {!forbidden && (
                    <div className="flex w-full gap-2 sm:w-auto sm:flex-none [&>button]:h-10 [&>button]:flex-1 sm:[&>button]:h-9 sm:[&>button]:flex-none">
                      <button
                        onClick={() => startEdit(m)}
                        className="rounded-full border border-[#EDE6E3] px-5 text-[13px] font-bold transition-colors hover:border-[#141414]"
                      >
                        Edit access
                      </button>
                      {m.id !== me?.id && (
                        <button
                          onClick={() => setToRemove(m)}
                          className="rounded-full border border-[#F3C9C5] px-5 text-[13px] font-bold text-[#B71C14] transition-colors hover:bg-[#B71C14] hover:text-white"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {list.length === 0 && (
                <Panel>
                  <Empty bare title="No team members match" />
                </Panel>
              )}
            </div>
          )}
        </>
      )}

      {draft && (
        <div className="max-w-[900px] animate-[hwUp_0.35s_ease_both]">
          <button
            onClick={() => setDraft(null)}
            className="inline-flex h-9 items-center rounded-full bg-white px-3.5 text-sm font-bold text-[#6B6B6B] shadow-[0_1px_2px_rgba(20,20,20,.06)] hover:text-[#141414]"
          >
            ← Team
          </button>
          <h1 className="m-0 mt-4 text-[30px] font-black leading-[1.02] tracking-[-0.045em] sm:text-[44px]">
            {draft.id ? "Edit access" : "Add team member"}
          </h1>
          <div className="mt-5 grid max-w-[460px] grid-cols-2 gap-3">
            {["Account & role", "Sidebar & masking"].map((l, i) => {
              const on = step >= i + 1;
              return (
                <div key={l}>
                  <div
                    className="h-1 rounded-full transition-colors"
                    style={{ background: on ? "#E5251B" : "#EDE6E3" }}
                  />
                  <div className="mt-2 flex gap-1.5 text-[13px] font-bold" style={{ color: on ? "#141414" : "#6B6B6B" }}>
                    <span style={{ color: on ? "#E5251B" : "#6B6B6B" }}>0{i + 1}</span>
                    {l}
                  </div>
                </div>
              );
            })}
          </div>

          {step === 1 && (
            <Panel className="mt-6 p-4 sm:mt-7 sm:p-6">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[13px] font-bold text-[#6B6B6B]">Full name (optional)</span>
                  <input
                    value={draft.fullName}
                    onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                    className={`mt-1.5 ${INPUT}`}
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
                    className={`mt-1.5 ${INPUT} disabled:bg-[#FAF7F5] disabled:text-[#6B6B6B]`}
                  />
                </label>
              </div>
              <label className="mt-3.5 block">
                <span className="text-[13px] font-bold text-[#6B6B6B]">
                  {draft.id ? "New password (leave empty to keep the current one)" : "Password"}
                </span>
                <div className="mt-1.5 flex flex-wrap gap-2 sm:flex-nowrap">
                  <input
                    value={draft.password}
                    onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className={`${INPUT} basis-full sm:basis-auto sm:flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="h-12 flex-1 rounded-xl border border-[#EDE6E3] bg-white px-4 text-sm font-bold text-[#6B6B6B] sm:flex-none"
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft({ ...draft, password: randomPassword() });
                      setShowPw(true);
                    }}
                    className="h-12 flex-1 rounded-xl border border-[#EDE6E3] bg-white px-4 text-sm font-bold text-[#E5251B] sm:flex-none"
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
                      aria-pressed={on}
                      style={{
                        borderColor: on ? "#E5251B" : "#EDE6E3",
                        boxShadow: on ? "0 0 0 1px #E5251B, 0 10px 24px -14px #E5251B" : "none",
                      }}
                      className="relative rounded-2xl border bg-white p-4 text-left transition-shadow disabled:opacity-40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[15px] font-bold">{ROLE_LABEL[r]}</span>
                        <span
                          className="flex h-5 w-5 flex-none items-center justify-center rounded-full border-2"
                          style={{ borderColor: on ? "#E5251B" : "#EDE6E3" }}
                        >
                          {on && <span className="h-2 w-2 rounded-full bg-[#E5251B]" />}
                        </span>
                      </div>
                      <div className="mt-1 text-[13px] leading-snug text-[#6B6B6B]">{ROLE_INFO[r].desc}</div>
                    </button>
                  );
                })}
              </div>

              {formError && <div className="mt-4 text-sm text-[#C8372D]">{formError}</div>}
              {existsPrompt && (
                <div className="mt-4 rounded-2xl bg-[#FFF6E5] px-5 py-4 text-sm leading-relaxed text-[#8A5A00]">
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
              <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end [&>button]:h-12 sm:[&>button]:h-11">
                <button
                  onClick={() => setDraft(null)}
                  className="rounded-full border border-[#EDE6E3] px-6 text-sm font-bold"
                >
                  Cancel
                </button>
                {draft.id && draft.role !== "admin" && (
                  <button
                    onClick={() => save()}
                    disabled={saving}
                    className="rounded-full border border-[#141414] px-6 text-sm font-bold disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save without changing access"}
                  </button>
                )}
                <button
                  onClick={goStep2}
                  disabled={saving}
                  className="rounded-full bg-[#141414] px-6 text-sm font-bold text-white transition active:scale-[.98] disabled:opacity-50"
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
            </Panel>
          )}

          {step === 2 && draft.role !== "admin" && (
            <section className="mt-6 sm:mt-7">
              <p className="m-0 text-sm leading-relaxed text-[#6B6B6B]">
                Tick the pages <span className="font-bold text-[#141414]">{draft.email || "this person"}</span>{" "}
                should see in the sidebar. Inside each page, tick what should be{" "}
                <span className="font-bold text-[#141414]">hidden</span> from them. Hidden details are
                removed on the server, not just covered up on screen.
              </p>
              <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0 [&>button]:flex-none [&>button]:whitespace-nowrap">
                {(["manager", "staff"] as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setDraft({ ...draft, permissions: defaultPermissions(r) })}
                    className="rounded-full border border-[#EDE6E3] bg-white px-3.5 py-2 text-[13px] font-bold text-[#6B6B6B] hover:border-[#141414] hover:text-[#141414] sm:py-1.5"
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
                  className="rounded-full border border-[#EDE6E3] bg-white px-3.5 py-2 text-[13px] font-bold text-[#6B6B6B] hover:border-[#141414] hover:text-[#141414] sm:py-1.5"
                >
                  All pages, nothing hidden
                </button>
                <button
                  onClick={() => setDraft({ ...draft, permissions: {} })}
                  className="rounded-full border border-[#EDE6E3] bg-white px-3.5 py-2 text-[13px] font-bold text-[#6B6B6B] hover:border-[#141414] hover:text-[#141414] sm:py-1.5"
                >
                  Clear
                </button>
              </div>

              <div className="mt-5 flex flex-col gap-2.5 sm:gap-3">
                {CONFIGURABLE.map((p) => {
                  const perms = draft.permissions as Record<string, string[]>;
                  const visible = Array.isArray(perms[p.key]);
                  const masked = perms[p.key] ?? [];
                  return (
                    <div
                      key={p.key}
                      className="rounded-2xl border bg-white p-4 transition-shadow sm:p-5"
                      style={{
                        borderColor: visible ? "#141414" : "#EDE6E3",
                        boxShadow: visible ? "0 10px 24px -16px rgba(20,20,20,.35)" : "none",
                      }}
                    >
                      <label className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
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
                          <div className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
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
                                  <span className="block text-[12px] leading-snug text-[#6B6B6B]">{mk.hint}</span>
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
                <div className="mt-4 rounded-2xl bg-[#FFF6E5] px-5 py-3.5 text-sm text-[#8A5A00]">
                  No pages ticked: this person won&apos;t be able to open anything after signing in.
                </div>
              )}
              {formError && <div className="mt-4 text-sm text-[#C8372D]">{formError}</div>}
              <div className="mt-6 flex justify-between gap-2.5">
                <button
                  onClick={() => setStep(1)}
                  className="h-12 rounded-full border border-[#EDE6E3] bg-white px-6 text-sm font-bold sm:h-11"
                >
                  ← Back
                </button>
                <button
                  onClick={() => save()}
                  disabled={saving}
                  className={`h-12 min-w-[170px] flex-1 rounded-full px-6 text-sm font-bold disabled:opacity-60 sm:h-11 sm:flex-none ${RED_BUTTON}`}
                >
                  {saving ? "Saving…" : draft.id ? "Save access" : `Create ${ROLE_LABEL[draft.role].toLowerCase()}`}
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {toRemove && (
        <Sheet onClose={() => !removing && setToRemove(null)} alert labelledBy="remove-title" width={440}>
          <DangerBar id="remove-title">Remove portal access?</DangerBar>
          <div className="px-6 py-5">
            <p className="m-0 text-[15px] leading-relaxed">
              <span className="font-bold">{toRemove.email}</span> will no longer be able to open the
              admin portal. Their login stays as an ordinary customer account.
            </p>
            <SheetActions>
              <button
                onClick={() => setToRemove(null)}
                disabled={removing}
                className="rounded-full border border-[#EDE6E3] px-5 text-sm font-bold"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                disabled={removing}
                className="rounded-full bg-[#B71C14] px-5 text-sm font-bold text-white disabled:opacity-50"
              >
                {removing ? "Removing…" : "Remove access"}
              </button>
            </SheetActions>
          </div>
        </Sheet>
      )}

      <Toast msg={toastMsg} />
    </AdminShell>
  );
}
