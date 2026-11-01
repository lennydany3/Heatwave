"use client";

import { useEffect, useState } from "react";
import { canView, isMasked, type PageKey, type Permissions, type Role } from "@/lib/permissions";

export type Me = { id: string; email: string | null; role: Role; permissions: Permissions | null };

// Fetched once per browser session and shared by every admin page, so the sidebar
// doesn't flicker or refetch on each navigation.
let cached: Me | null = null;
let inflight: Promise<Me | null> | null = null;

function fetchMe(): Promise<Me | null> {
  inflight ??= fetch("/api/admin/me", { cache: "no-store" })
    .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
    .then((me) => {
      cached = me;
      return me;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function clearMe() {
  cached = null;
}

export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(cached);
  useEffect(() => {
    if (cached) return;
    let live = true;
    fetchMe().then((m) => live && setMe(m));
    return () => {
      live = false;
    };
  }, []);
  return me;
}

export const meCanView = (me: Me | null, page: PageKey) =>
  !!me && canView(me.role, me.permissions, page);
export const meMasked = (me: Me | null, page: PageKey, item: string) =>
  !me || isMasked(me.role, me.permissions, page, item);
