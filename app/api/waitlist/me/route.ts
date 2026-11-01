import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { myWaitlist } from "@/lib/seats";

// The signed-in customer's own waitlist entries, for My Tickets.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const entries = await myWaitlist(createAdminClient(), user);
  return NextResponse.json({ entries }, { headers: { "Cache-Control": "no-store" } });
}
