import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "../_lib/auth";

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data, error } = await createAdminClient()
    .from("waitlist")
    .select(
      "id, full_name, email, mobile, instagram, age, gender, status, created_at, ticket_tiers(name)"
    )
    .order("created_at");
  if (error) {
    // 42P01 / PGRST205: the table doesn't exist yet.
    if (error.code === "42P01" || error.code === "PGRST205") {
      return NextResponse.json({ entries: [], migrated: false });
    }
    return NextResponse.json({ error: "Could not load the waitlist" }, { status: 500 });
  }
  const entries = (data ?? []).map((w) => ({
    id: w.id,
    fullName: w.full_name,
    email: w.email,
    mobile: w.mobile,
    instagram: w.instagram,
    age: w.age,
    gender: w.gender,
    status: w.status as "waiting" | "invited" | "registered",
    createdAt: w.created_at,
    tierName: (w.ticket_tiers as unknown as { name: string } | null)?.name ?? null,
  }));
  return NextResponse.json({ entries, migrated: true });
}

// Invite (release a seat for them) or move back to waiting.
export async function PATCH(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (typeof body?.id !== "string" || (body.status !== "waiting" && body.status !== "invited")) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { error } = await createAdminClient()
    .from("waitlist")
    .update({ status: body.status })
    .eq("id", body.id)
    .neq("status", "registered");
  if (error) return NextResponse.json({ error: "Could not update the entry" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof body?.id !== "string") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { error } = await createAdminClient().from("waitlist").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: "Could not remove the entry" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
