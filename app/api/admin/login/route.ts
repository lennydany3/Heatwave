import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Password sign-in runs on the server so the session cookie is set in the same
// round trip, and so a non-admin account is signed straight back out instead of
// bouncing between /admin and the login page. (Browser-side sign-in can also hang
// on the auth lock when another tab or an old session is holding it.)
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { email, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return NextResponse.json(
      { error: error?.message ?? "Incorrect email or password" },
      { status: 401 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  if (profile?.role !== "admin") {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "That account doesn't have admin access." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
