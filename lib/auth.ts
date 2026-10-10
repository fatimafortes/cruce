import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isGoogleUser, signInPath } from "@/lib/auth-rules";

// The one place that decides who is signed in. getUser() asks Supabase Auth
// to verify the session instead of trusting the cookie on its own.
export async function getGoogleUser(): Promise<User | null> {
  // Per-request only. With Partial Prefetching, cookies() can resolve while the
  // App Shell is prerendered, and supabase-js then reads Date.now() to check the
  // token's expiry, which Cache Components rejects (Bug 2). Everything below
  // this line runs only for a real request.
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return isGoogleUser(data.user) ? data.user : null;
}

export async function requireGoogleUser(path: string): Promise<User> {
  const user = await getGoogleUser();
  if (!user) redirect(signInPath(path));
  return user;
}
