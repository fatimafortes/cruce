import "server-only";
import { ruleChecksSchema, type ReviewView } from "@/lib/attempts";
import type { RuleChecks } from "@/lib/checks";
import { createClient } from "@/lib/supabase/server";

// An attempt as a reviewer sees it: no user id, name or email (C3, packet swimlane).
export type QueueItem = {
  attemptId: string;
  emailAnswer: string;
  followupAnswer: string;
  ruleChecks: RuleChecks | null;
  aiSuggestion: string | null;
  submittedAt: string;
  review: ReviewView | null;
};

// RLS on cruce_reviewers shows each user only their own row.
export async function isReviewer(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cruce_reviewers")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[reviews] isReviewer failed", JSON.stringify({ code: error.code, message: error.message }));
    return false;
  }
  return data !== null;
}

type QueueRow = {
  attempt_id: string;
  email_answer: string;
  followup_answer: string | null;
  rule_checks: unknown;
  ai_suggestion: string | null;
  submitted_at: string;
  review_explained: boolean | null;
  review_note: string | null;
};

// Attempts ready for review (task 2 answered), from cruce_review_queue(),
// which returns no user id and leaves out the reviewer's own attempts.
export async function getReviewQueue(): Promise<QueueItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cruce_review_queue");
  if (error) {
    console.error("[reviews] queue failed", JSON.stringify({ code: error.code, message: error.message }));
    return [];
  }
  return ((data ?? []) as QueueRow[])
    .filter((row) => row.followup_answer !== null)
    .map((row) => {
      const checks = ruleChecksSchema.safeParse(row.rule_checks);
      return {
        attemptId: row.attempt_id,
        emailAnswer: row.email_answer,
        followupAnswer: row.followup_answer as string,
        ruleChecks: checks.success ? checks.data : null,
        aiSuggestion: row.ai_suggestion,
        submittedAt: row.submitted_at,
        review:
          row.review_explained === null
            ? null
            : { explained: row.review_explained, note: row.review_note ?? "" },
      };
    });
}
