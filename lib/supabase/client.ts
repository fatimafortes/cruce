import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

// For Client Components. Uses the anon key; RLS decides what each user can see.
export function createClient() {
  const env = publicEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
