import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { secretKeyEnv } from "@/lib/env.server";
import type { RuleChecks } from "@/lib/checks";

// The only code that uses Cruce's secret key. It bypasses RLS in the whole
// shared project, so the client is never exported: callers get one narrow
// function that writes one column of one cruce_ table.

function adminClient() {
  return createClient(publicEnv().NEXT_PUBLIC_SUPABASE_URL, secretKeyEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// Returns false (and logs why, without values) if the checks couldn't be saved.
export async function saveRuleChecks(attemptId: string, checks: RuleChecks): Promise<boolean> {
  let client;
  try {
    client = adminClient();
  } catch (error) {
    console.error("[admin] secret key unavailable:", (error as Error).message);
    return false;
  }
  const { error } = await client
    .from("cruce_attempts")
    .update({ rule_checks: checks })
    .eq("id", attemptId);
  if (error) {
    console.error("[admin] saveRuleChecks failed", JSON.stringify({ code: error.code, message: error.message }));
    return false;
  }
  return true;
}
