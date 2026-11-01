import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  canView,
  isMasked,
  type PageKey,
  type Permissions,
  type Role,
} from "@/lib/permissions";

// /api routes aren't covered by the /admin check in proxy.ts, so every admin
// handler re-checks the caller's role and permissions before touching the
// service role. Masking is applied here on the server, not just hidden in the UI.
export type Access = {
  id: string;
  email: string | null;
  role: Role;
  permissions: Permissions | null;
  can: (page: PageKey) => boolean;
  /** True when this item of the page is masked for the caller. */
  masked: (page: PageKey, item: string) => boolean;
};

const PORTAL_ROLES: Role[] = ["admin", "manager", "staff"];

// PostgREST / Postgres codes for "column doesn't exist": the supabase/*.sql
// migration hasn't been run yet, so the feature falls back to the old behaviour.
export const isMissingColumn = (code?: string) => code === "42703" || code === "PGRST204";

// The signed-in portal user (any role), without a page check.
export async function getAccess(): Promise<Access | null> {
  const supabase = await createClient();
  // The proxy has already validated/refreshed the session; getClaims() verifies
  // the JWT locally instead of calling Supabase Auth on every API request.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const admin = createAdminClient();
  let res = await admin.from("profiles").select("role, permissions").eq("id", claims.sub).single();
  if (res.error && isMissingColumn(res.error.code)) {
    res = (await admin.from("profiles").select("role").eq("id", claims.sub).single()) as typeof res;
  }
  const role = res.data?.role as Role | undefined;
  if (!role || !PORTAL_ROLES.includes(role)) return null;
  const permissions = ((res.data as { permissions?: Permissions | null })?.permissions ?? null) as
    | Permissions
    | null;

  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    role,
    permissions,
    can: (page) => canView(role, permissions, page),
    masked: (page, item) => isMasked(role, permissions, page, item),
  };
}

// The portal user, only if they're allowed to see `page`.
export async function requireAccess(page: PageKey): Promise<Access | null> {
  const access = await getAccess();
  if (!access || !canView(access.role, access.permissions, page)) return null;
  return access;
}

// Admins only (team management).
export async function requireAdmin(): Promise<Access | null> {
  const access = await getAccess();
  return access?.role === "admin" ? access : null;
}
