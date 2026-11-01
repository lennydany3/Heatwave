import { NextResponse } from "next/server";
import { getAccess } from "../_lib/auth";

// Who is signed in to the portal and what they may see; drives the sidebar.
export async function GET() {
  const access = await getAccess();
  if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(
    { id: access.id, email: access.email, role: access.role, permissions: access.permissions },
    { headers: { "Cache-Control": "no-store" } }
  );
}
