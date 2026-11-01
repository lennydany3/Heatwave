import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// Rate limiting backed by Upstash Redis (UPSTASH_REDIS_REST_URL / _TOKEN). Each
// named limiter is a sliding window: `max` requests per `window` for one key
// (an IP address, an email, or a user id). If Redis isn't configured or is
// unreachable the request is allowed, so an outage never takes the site down.
type Window = `${number} ${"s" | "m" | "h"}`;

const LIMITS = {
  // Blanket per-IP cap on every /api request (applied in proxy.ts).
  api: { max: 240, window: "1 m" },
  // Customer sign-up / log-in codes.
  otpSendIp: { max: 10, window: "10 m" },
  otpSendEmail: { max: 5, window: "15 m" },
  otpVerifyIp: { max: 20, window: "10 m" },
  otpVerifyEmail: { max: 10, window: "10 m" },
  // Admin sign-in: strict, it's the highest-value target.
  adminLoginIp: { max: 10, window: "10 m" },
  adminLoginEmail: { max: 5, window: "10 m" },
  // Registration and waitlist.
  submitUser: { max: 5, window: "10 m" },
  submitIp: { max: 20, window: "10 m" },
  waitlistUser: { max: 10, window: "10 m" },
  // Public read used by the event page.
  availability: { max: 120, window: "1 m" },
  // Sensitive admin actions.
  adminTeam: { max: 15, window: "10 m" },
  adminDelete: { max: 30, window: "10 m" },
} satisfies Record<string, { max: number; window: Window }>;

export type LimiterName = keyof typeof LIMITS;

const hasRedis = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = hasRedis ? Redis.fromEnv() : null;
const limiters = new Map<LimiterName, Ratelimit>();

function limiterFor(name: LimiterName) {
  let l = limiters.get(name);
  if (!l && redis) {
    const { max, window } = LIMITS[name];
    l = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, window),
      prefix: `hw:rl:${name}`,
      // Remembers blocked keys in memory so a flood doesn't hit Redis on every request.
      ephemeralCache: new Map(),
    });
    limiters.set(name, l);
  }
  return l ?? null;
}

let warned = false;

export type LimitResult = { ok: boolean; retryAfter: number };

export async function limit(name: LimiterName, key: string): Promise<LimitResult> {
  const l = limiterFor(name);
  if (!l) {
    if (!warned) {
      warned = true;
      console.warn("[ratelimit] Upstash isn't configured — rate limiting is OFF");
    }
    return { ok: true, retryAfter: 0 };
  }
  try {
    const res = await l.limit(key);
    return { ok: res.success, retryAfter: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)) };
  } catch (e) {
    console.error("[ratelimit] Redis error, allowing the request:", e);
    return { ok: true, retryAfter: 0 };
  }
}

// Best-effort client IP (works behind Vercel and most proxies).
export function clientIp(source: Request | Headers): string {
  const h = source instanceof Request ? source.headers : source;
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "unknown"
  );
}

export function tooManyRequests(retryAfter: number, message?: string) {
  const mins = Math.ceil(retryAfter / 60);
  const wait = retryAfter >= 90 ? `${mins} minutes` : `${retryAfter} seconds`;
  return NextResponse.json(
    { error: message ?? `Too many attempts. Please try again in ${wait}.`, code: "rate_limited", retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

// Checks several limiters at once (e.g. per-IP and per-email); returns the first
// that is exceeded, or null when the request may proceed.
export async function checkLimits(
  checks: [LimiterName, string][]
): Promise<NextResponse | null> {
  for (const [name, key] of checks) {
    const res = await limit(name, key);
    if (!res.ok) return tooManyRequests(res.retryAfter);
  }
  return null;
}
