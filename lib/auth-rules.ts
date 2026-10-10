import type { User } from "@supabase/supabase-js";

// Shared by proxy.ts and server code, so no "server-only" import here.

export const PROTECTED_PATHS = ["/sample", "/proof", "/review"] as const;

export const DEFAULT_NEXT = "/sample";

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

// The Supabase project is shared with other apps and allows anonymous and
// email sign-ins. Cruce only counts a Google identity as signed in.
export function isGoogleUser(user: User | null | undefined): user is User {
  if (!user || user.is_anonymous) return false;
  const providers = user.app_metadata?.providers;
  if (Array.isArray(providers) && providers.includes("google")) return true;
  return user.identities?.some((identity) => identity.provider === "google") ?? false;
}

// Only same-site paths, so ?next= can never send someone to another site.
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return DEFAULT_NEXT;
  }
  const base = "http://cruce.invalid";
  try {
    const url = new URL(raw, base);
    if (url.origin !== base) return DEFAULT_NEXT;
    return `${url.pathname}${url.search}`;
  } catch {
    return DEFAULT_NEXT;
  }
}

export function signInPath(next: string): string {
  return `/?next=${encodeURIComponent(next)}`;
}
