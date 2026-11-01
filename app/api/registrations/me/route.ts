import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyState, type Decision, type PaymentStatus } from "@/lib/verification";

// PostgREST / Postgres codes for "column doesn't exist" (supabase/verification-decisions.sql not run yet).
const isMissingColumn = (code?: string) => code === "42703" || code === "PGRST204";

type Row = {
  status: PaymentStatus;
  verification_note: string | null;
  verification_decision?: Decision | null;
  tickets: { ticket_code: string }[] | null;
};

// The signed-in customer's registrations with the admin's outcome, so My Tickets
// can tell "declined" (contact support) from "unsuccessful" (try again).
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const cols = "status, verification_note, tickets(ticket_code)";
  const load = (select: string) =>
    admin.from("registrations").select(select).eq("user_id", userId).neq("status", "cancelled");
  let res = await load(`${cols}, verification_decision`);
  if (res.error && isMissingColumn(res.error.code)) res = await load(cols);
  if (res.error) return NextResponse.json({ error: "Could not load registrations" }, { status: 500 });

  const rows = (res.data ?? []) as unknown as Row[];
  const registrations = rows.map((r) => {
    const decision = verifyState(r.status, r.verification_decision ?? null);
    return {
      ticketCode: r.tickets?.[0]?.ticket_code ?? null,
      decision,
      note: r.verification_note,
      // An unsuccessful payment can be retried; a declined registration can't.
      canRetry: decision === "unsuccessful",
    };
  });
  return NextResponse.json({ registrations }, { headers: { "Cache-Control": "no-store" } });
}
