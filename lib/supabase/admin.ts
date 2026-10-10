import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { secretKeyEnv } from "@/lib/env.server";
import type { RuleChecks } from "@/lib/checks";

// The only code that uses Cruce's secret key. It bypasses RLS in the whole
// shared project, so the client is never exported: callers get narrow
// functions that each write one column of cruce_attempts.

function adminClient() {
  return createClient(publicEnv().NEXT_PUBLIC_SUPABASE_URL, secretKeyEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

type AttemptServerColumns = { rule_checks: RuleChecks } | { ai_suggestion: string };

// Returns false (and logs why, without values) if the column couldn't be saved.
async function updateAttempt(attemptId: string, columns: AttemptServerColumns, label: string): Promise<boolean> {
  let client;
  try {
    client = adminClient();
  } catch (error) {
    console.error("[admin] secret key unavailable:", (error as Error).message);
    return false;
  }
  const { error } = await client.from("cruce_attempts").update(columns).eq("id", attemptId);
  if (error) {
    console.error(`[admin] ${label} failed`, JSON.stringify({ code: error.code, message: error.message }));
    return false;
  }
  return true;
}

export function saveRuleChecks(attemptId: string, checks: RuleChecks): Promise<boolean> {
  return updateAttempt(attemptId, { rule_checks: checks }, "saveRuleChecks");
}

// The AI's draft feedback. Stored as text only; nothing reads it to set a state.
export function saveAiSuggestion(attemptId: string, text: string): Promise<boolean> {
  return updateAttempt(attemptId, { ai_suggestion: text }, "saveAiSuggestion");
}
