import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { eventSeats, myInvite } from "@/lib/seats";

// Public: per-tier registration state for the event page and the registration
// form. Browsers can't count registrations themselves (row-level security), so
// this returns only the numbers that are safe to show.
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing slug" }, { status: 400 });

  const admin = createAdminClient();
  const { data: event } = await admin.from("events").select("id").eq("slug", slug).single();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const seats = await eventSeats(admin, event.id);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const invite = user ? await myInvite(admin, event.id, user) : null;

  const tiers = seats.map((s) => ({
    tierId: s.tierId,
    // An invited customer can register for the tier their seat is held in.
    registrationClosed: invite?.tierId === s.tierId ? false : s.registrationClosed,
    remaining: s.remaining,
    invited: invite?.tierId === s.tierId,
  }));

  return NextResponse.json({ tiers }, { headers: { "Cache-Control": "no-store" } });
}
