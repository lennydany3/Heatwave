import { checkLimits, clientIp } from "@/lib/ratelimit";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { sanitizePermissions, type Role } from "@/lib/permissions";
import { isMissingColumn, requireAdmin } from "../_lib/auth";

const ROLES: Role[] = ["admin", "manager", "staff"];
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const NEEDS_SQL = "Run supabase/roles-permissions.sql in Supabase first (both steps)";

// Postgres: 22P02 = invalid enum value (the 'manager' / 'staff' roles don't exist yet).
const isMissingRole = (code?: string) => code === "22P02";

type Body = Record<string, unknown>;

const isRole = (v: unknown): v is Role => typeof v === "string" && ROLES.includes(v as Role);

// Everything here is admin-only: managers and staff never manage the team.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createAdminClient();

  let res = await admin
    .from("profiles")
    .select("id, full_name, role, permissions, created_at")
    .in("role", ROLES);
  let migrated = true;
  if (res.error && isMissingColumn(res.error.code)) {
    migrated = false;
    res = (await admin
      .from("profiles")
      .select("id, full_name, role, created_at")
      .eq("role", "admin")) as typeof res;
  } else if (res.error) {
    // The enum doesn't have manager / staff yet: only admins can exist so far.
    migrated = false;
    res = (await admin
      .from("profiles")
      .select("id, full_name, role, permissions, created_at")
      .eq("role", "admin")) as typeof res;
  }
  if (res.error) return NextResponse.json({ error: "Could not load the team" }, { status: 500 });

  const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
  const byId = new Map((users?.users ?? []).map((u) => [u.id, u]));

  const members = (res.data ?? []).map((p) => {
    const u = byId.get(p.id);
    return {
      id: p.id,
      email: u?.email ?? "",
      fullName: p.full_name as string | null,
      role: p.role as Role,
      permissions: ((p as { permissions?: unknown }).permissions ?? null) as unknown,
      lastSignIn: u?.last_sign_in_at ?? null,
      createdAt: p.created_at as string,
    };
  });
  members.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return NextResponse.json({ members, migrated });
}

// Create a team member: an auth account (email + password, already confirmed)
// and a profile carrying the role and the page / masking permissions.
export async function POST(request: Request) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const limited = await checkLimits([["adminTeam", me.id]]);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as Body | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (!isRole(body?.role)) return NextResponse.json({ error: "Pick a role" }, { status: 400 });
  const role = body.role;
  const permissions = role === "admin" ? null : sanitizePermissions(body?.permissions);

  const admin = createAdminClient();
  const useExisting = body?.useExisting === true;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined,
  });

  let id: string;
  if (created.error || !created.data.user) {
    const msg = created.error?.message ?? "Could not create the account";
    if (!/already|registered|exists/i.test(msg)) return NextResponse.json({ error: msg }, { status: 500 });

    // The email already has a login (usually a customer who registered for the
    // event). Only reuse it when the admin has explicitly confirmed.
    if (!useExisting) {
      return NextResponse.json(
        {
          code: "email_exists",
          error:
            "This email already has an account. You can give that account portal access and set the password you entered.",
        },
        { status: 409 }
      );
    }
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = users?.users.find((u) => u.email?.toLowerCase() === email);
    if (!existing) return NextResponse.json({ error: "Could not find that account" }, { status: 404 });

    const { data: prof } = await admin.from("profiles").select("role").eq("id", existing.id).single();
    if (prof?.role && ROLES.includes(prof.role as Role)) {
      return NextResponse.json({ error: "This person is already on the team — use Edit access" }, { status: 409 });
    }
    const upd = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (upd.error) return NextResponse.json({ error: "Could not set the password" }, { status: 500 });
    id = existing.id;
  } else {
    id = created.data.user.id;
  }
  const isNewAccount = !created.error;

  // A signup trigger may already have created a customer profile: upsert over it.
  const { error } = await admin
    .from("profiles")
    .upsert({ id, role, permissions, ...(fullName ? { full_name: fullName } : {}) });
  if (error) {
    if (isNewAccount) await admin.auth.admin.deleteUser(id); // don't leave a half-created account behind
    if (isMissingColumn(error.code) || isMissingRole(error.code)) {
      return NextResponse.json({ error: NEEDS_SQL }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not save the team member" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id });
}

// Change someone's role, permissions, name or password.
export async function PATCH(request: Request) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const limited = await checkLimits([["adminTeam", me.id]]);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as Body | null;
  const id = body?.id;
  if (typeof id !== "string") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const admin = createAdminClient();
  const profile: Record<string, unknown> = {};
  if ("role" in (body ?? {})) {
    if (!isRole(body?.role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    // An admin can't demote themselves: that could leave nobody able to manage the team.
    if (id === me.id && body.role !== "admin") {
      return NextResponse.json({ error: "You can't change your own role" }, { status: 400 });
    }
    profile.role = body.role;
    if (body.role === "admin") profile.permissions = null;
  }
  if ("permissions" in (body ?? {}) && profile.role !== "admin") {
    profile.permissions = sanitizePermissions(body?.permissions);
  }
  if (typeof body?.fullName === "string") profile.full_name = body.fullName.trim() || null;

  if (typeof body?.password === "string" && body.password) {
    if (body.password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    const { error } = await admin.auth.admin.updateUserById(id, { password: body.password });
    if (error) return NextResponse.json({ error: "Could not change the password" }, { status: 500 });
  }

  if (Object.keys(profile).length > 0) {
    const { error } = await admin.from("profiles").update(profile).eq("id", id);
    if (error) {
      if (isMissingColumn(error.code) || isMissingRole(error.code)) {
        return NextResponse.json({ error: NEEDS_SQL }, { status: 409 });
      }
      return NextResponse.json({ error: "Could not update the team member" }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}

// Remove portal access. The login itself isn't deleted; the account goes back to
// being an ordinary customer.
export async function DELETE(request: Request) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const limited = await checkLimits([["adminTeam", me.id]]);
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof body?.id !== "string") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  if (body.id === me.id) {
    return NextResponse.json({ error: "You can't remove your own access" }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ role: "customer", permissions: null })
    .eq("id", body.id);
  if (error) {
    if (isMissingColumn(error.code)) {
      // No permissions column yet: just drop the role.
      const retry = await createAdminClient().from("profiles").update({ role: "customer" }).eq("id", body.id);
      if (!retry.error) return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Could not remove access" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
