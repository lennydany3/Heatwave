import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import RegisterForm, { type ExistingRegistration } from "./RegisterForm";

const EVENT_SLUG = "product-builders-summit-2027";

// One registration per account. Checked on the server so an already-registered
// user gets the "already registered" screen in the first response, instead of
// seeing the form while the browser resolves auth → event → registration.
async function findExistingRegistration(): Promise<ExistingRegistration | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await createAdminClient()
    .from("registrations")
    .select("status, tickets(ticket_code), events!inner(slug, name)")
    .eq("user_id", user.id)
    .eq("events.slug", EVENT_SLUG)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1);

  const row = data?.[0];
  if (!row) return null;

  const tickets = row.tickets as unknown as { ticket_code: string }[] | null;
  const event = row.events as unknown as { name: string } | null;
  return {
    status: row.status as ExistingRegistration["status"],
    ticketCode: tickets?.[0]?.ticket_code ?? null,
    eventName: event?.name ?? null,
  };
}

export default async function RegisterPage() {
  const existing = await findExistingRegistration();
  return <RegisterForm initialExisting={existing} />;
}
