import { createClient } from "@/utils/supabase/server";

// /api routes aren't covered by the /admin check in proxy.ts, so every admin
// handler re-checks the caller's role before touching the service role.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin" ? user : null;
}

// PostgREST / Postgres codes for "column doesn't exist": supabase/verification-decisions.sql
// hasn't been run yet, so decisions fall back to the plain status.
export const isMissingColumn = (code?: string) => code === "42703" || code === "PGRST204";
