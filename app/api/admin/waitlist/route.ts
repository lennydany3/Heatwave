import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { eventSeats } from "@/lib/seats";
import { requireAccess } from "../_lib/auth";

export async function GET() {
  const access = await requireAccess("waitlist");
  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const m = (item: string) => access.masked("waitlist", item);
  const { data, error } = await createAdminClient()
    .from("waitlist")
    .select(
      "id, ticket_tier_id, full_name, email, mobile, instagram, age, gender, status, created_at, ticket_tiers(name)"
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
    tierId: w.ticket_tier_id as string | null,
    fullName: w.full_name,
    email: m("contact") ? "Hidden" : w.email,
    mobile: m("contact") ? "Hidden" : w.mobile,
    instagram: m("contact") ? null : w.instagram,
    age: w.age,
    gender: w.gender,
    status: w.status as "waiting" | "invited" | "registered",
    createdAt: w.created_at,
    tierName: (w.ticket_tiers as unknown as { name: string } | null)?.name ?? null,
  }));
  const masks = ["contact", "invite", "delete"].filter(m);
  return NextResponse.json({ entries, migrated: true, masks });
}

// Invite (release a seat for them) or move back to waiting.
export async function PATCH(request: Request) {
  const access = await requireAccess("waitlist");
  if (!access || access.masked("waitlist", "invite")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (typeof body?.id !== "string" || (body.status !== "waiting" && body.status !== "invited")) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const admin = createAdminClient();

  // Inviting holds a seat, so there has to be one free: the admin must raise the
  // seat limit (or free a seat) first.
  if (body.status === "invited") {
    const { data: entry } = await admin
      .from("waitlist")
      .select("event_id, ticket_tier_id, status")
      .eq("id", body.id)
      .single();
    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    if (entry.status === "waiting" && entry.ticket_tier_id) {
      const seats = (await eventSeats(admin, entry.event_id)).find(
        (s) => s.tierId === entry.ticket_tier_id
      );
      if (seats && seats.remaining !== null && seats.remaining < 1) {
        return NextResponse.json(
          {
            error: "No seats are free. Increase the seat limit first.",
            code: "no_seats",
            tierId: seats.tierId,
            limit: seats.limit,
          },
          { status: 409 }
        );
      }
    }
  }

  const { error } = await admin
    .from("waitlist")
    .update({ status: body.status })
    .eq("id", body.id)
    .neq("status", "registered");
  if (error) return NextResponse.json({ error: "Could not update the entry" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const access = await requireAccess("waitlist");
  if (!access || access.masked("waitlist", "delete")) {
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
