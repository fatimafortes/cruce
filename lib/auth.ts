import "server-only";
import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isGoogleUser, signInPath } from "@/lib/auth-rules";

// The one place that decides who is signed in. getUser() asks Supabase Auth
// to verify the session instead of trusting the cookie on its own.
export async function getGoogleUser(): Promise<User | null> {
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
