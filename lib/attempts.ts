import "server-only";
import { z } from "zod";
import type { RuleChecks } from "@/lib/checks";
import { createClient } from "@/lib/supabase/server";

export type AttemptView = {
  id: string;
  emailAnswer: string;
  followupAnswer: string | null;
  ruleChecks: RuleChecks | null;
};

const checkSchema = z.object({ item: z.string(), passed: z.boolean(), detail: z.string() });
const ruleChecksSchema = z.object({
  version: z.literal(1),
  task1: z.array(checkSchema),
  task2: z.array(checkSchema).nullable(),
});

// The signed-in worker's most recent attempt (RLS: only their own rows).
export async function getLatestAttempt(): Promise<AttemptView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cruce_attempts")
    .select("id, email_answer, followup_answer, rule_checks")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[attempts] latest failed", JSON.stringify({ code: error.code, message: error.message }));
    return null;
  }
  if (!data) return null;
  const checks = ruleChecksSchema.safeParse(data.rule_checks);
  return {
    id: data.id,
    emailAnswer: data.email_answer,
    followupAnswer: data.followup_answer,
    ruleChecks: checks.success ? checks.data : null,
  };
}
