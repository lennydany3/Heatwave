import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

const PROTECTED_PREFIXES = ["/events/registations", "/dashboard"];
const ADMIN_LOGIN_PATH = "/admin/login";

// Admin role lookups are cached briefly: every admin navigation (and its
// prefetches) passes through here, and a DB round trip each time made the
// sidebar feel slow. A demoted admin loses access within the TTL.
const ADMIN_TTL_MS = 60_000;
const adminCache = new Map<string, number>();

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
  const { supabaseResponse, user, supabase } = await updateSession(request);
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
    let isAdmin = (adminCache.get(user.id) ?? 0) > Date.now();
    if (!isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      isAdmin = profile?.role === "admin";
      if (isAdmin) adminCache.set(user.id, Date.now() + ADMIN_TTL_MS);
      else adminCache.delete(user.id);
    }
    if (!isAdmin) {
      const url = new URL(ADMIN_LOGIN_PATH, request.url);
      url.searchParams.set("error", "not-admin");
      return redirectWithRefreshedCookies(url, supabaseResponse);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
