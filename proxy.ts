import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import { clientIp, limit, tooManyRequests } from "@/lib/ratelimit";
import { createAdminClient } from "@/utils/supabase/admin";
import { canView, firstPage, pageForPath, type Permissions, type Role } from "@/lib/permissions";

const PROTECTED_PREFIXES = ["/events/registations", "/dashboard"];
const ADMIN_LOGIN_PATH = "/admin/login";

// Portal role + permissions are cached briefly: every admin navigation (and its
// prefetches) passes through here, and a DB round trip each time made the sidebar
// feel slow. Changes to someone's access take effect within the TTL.
const ACCESS_TTL_MS = 20_000;
const accessCache = new Map<string, { role: Role | null; permissions: Permissions | null; exp: number }>();

async function loadAccess(userId: string) {
  const hit = accessCache.get(userId);
  if (hit && hit.exp > Date.now()) return hit;

  const admin = createAdminClient();
  let res = await admin.from("profiles").select("role, permissions").eq("id", userId).single();
  // permissions column missing (SQL not run yet): fall back to role only.
  if (res.error) res = (await admin.from("profiles").select("role").eq("id", userId).single()) as typeof res;
  const role = res.data?.role as Role | undefined;
  const entry = {
    role: role && ["admin", "manager", "staff"].includes(role) ? role : null,
    permissions: ((res.data as { permissions?: Permissions | null } | null)?.permissions ?? null) as Permissions | null,
    exp: Date.now() + ACCESS_TTL_MS,
  };
  accessCache.set(userId, entry);
  return entry;
}

function redirectWithRefreshedCookies(
  url: URL,
  supabaseResponse: NextResponse
) {
  const response = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  return response;
}

export async function proxy(request: NextRequest) {
  // Blanket per-IP cap on the API; the routes below add stricter per-action limits.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const res = await limit("api", clientIp(request.headers));
    if (!res.ok) return tooManyRequests(res.retryAfter);
  }

  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("auth", "1");
    url.searchParams.set("next", pathname);
    return redirectWithRefreshedCookies(url, supabaseResponse);
  }

  if (pathname.startsWith("/admin")) {
    if (pathname === ADMIN_LOGIN_PATH) {
      return supabaseResponse;
    }
    if (!user) {
      return redirectWithRefreshedCookies(
        new URL(ADMIN_LOGIN_PATH, request.url),
        supabaseResponse
      );
    }
    const { role, permissions } = await loadAccess(user.id);
    if (!role) {
      const url = new URL(ADMIN_LOGIN_PATH, request.url);
      url.searchParams.set("error", "not-admin");
      return redirectWithRefreshedCookies(url, supabaseResponse);
    }
    // Pages this person can't see are blocked here, not just hidden in the sidebar.
    const page = pageForPath(pathname);
    if (page && !canView(role, permissions, page)) {
      const landing = firstPage(role, permissions);
      if (!landing) {
        const url = new URL(ADMIN_LOGIN_PATH, request.url);
        url.searchParams.set("error", "no-access");
        return redirectWithRefreshedCookies(url, supabaseResponse);
      }
      return redirectWithRefreshedCookies(new URL(landing.href, request.url), supabaseResponse);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
