import "server-only";
import { ruleChecksSchema, type ReviewView } from "@/lib/attempts";
import type { RuleChecks } from "@/lib/checks";
import type { StateSummary } from "@/lib/states";
import { createClient } from "@/lib/supabase/server";

export type ShareLink = { id: string; token: string; displayName: string | null; includeAnswers: boolean };

export type ProofItem = {
  id: string;
  createdAt: string;
  emailAnswer: string;
  followupAnswer: string | null;
  ruleChecks: RuleChecks | null;
  aiSuggestion: string | null;
  review: ReviewView | null;
  activeLink: ShareLink | null;
};

// All of the signed-in worker's attempts, newest first (RLS: own rows only).
export async function getMyProofs(): Promise<ProofItem[]> {
  const supabase = await createClient();
  const { data: attempts, error } = await supabase
    .from("cruce_attempts")
    .select("id, created_at, email_answer, followup_answer, rule_checks, ai_suggestion")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[proofs] attempts failed", JSON.stringify({ code: error.code, message: error.message }));
    return [];
  }
  if (!attempts?.length) return [];
  const ids = attempts.map((a) => a.id);

  const [{ data: reviews }, { data: links }] = await Promise.all([
    supabase.from("cruce_reviews").select("attempt_id, explained, note").in("attempt_id", ids),
    supabase
      .from("cruce_proof_links")
      .select("id, attempt_id, token, display_name, include_answers, created_at")
      .in("attempt_id", ids)
      .eq("revoked", false)
      .order("created_at", { ascending: false }),
  ]);

  return attempts.map((a) => {
    const checks = ruleChecksSchema.safeParse(a.rule_checks);
    const review = reviews?.find((r) => r.attempt_id === a.id);
    const link = links?.find((l) => l.attempt_id === a.id);
    return {
      id: a.id,
      createdAt: a.created_at,
      emailAnswer: a.email_answer,
      followupAnswer: a.followup_answer,
      ruleChecks: checks.success ? checks.data : null,
      aiSuggestion: a.ai_suggestion,
      review: review ? { explained: review.explained, note: review.note } : null,
      activeLink: link
        ? { id: link.id, token: link.token, displayName: link.display_name, includeAnswers: link.include_answers }
        : null,
    };
  });
}

export type PublicProof = {
  submittedAt: string;
  summary: StateSummary;
  displayName: string | null;
  answers: { email: string; followup: string | null } | null;
};

const TOKEN = /^[0-9a-f]{64}$/;

// What a share link shows, from cruce_proof_by_token(): null for a revoked or
// unknown token (the page can't tell them apart). Never the AI suggestion,
// the reviewer's note, a user id or an email.
export async function getPublicProof(token: string): Promise<PublicProof | null> {
  if (!TOKEN.test(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cruce_proof_by_token", { p_token: token });
  if (error) {
    console.error("[proofs] public lookup failed", JSON.stringify({ code: error.code, message: error.message }));
    return null;
  }
  const row = (data as {
    submitted_at: string;
    numbers_ok: boolean | null;
    review_explained: boolean | null;
    display_name: string | null;
    include_answers: boolean;
    email_answer: string | null;
    followup_answer: string | null;
  }[] | null)?.[0];
  if (!row) return null;
  return {
    submittedAt: row.submitted_at,
    summary: { exists: true, numbersOk: row.numbers_ok, explained: row.review_explained },
    displayName: row.display_name,
    answers: row.include_answers && row.email_answer ? { email: row.email_answer, followup: row.followup_answer } : null,
  };
}

export function proofDateLabel(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: "America/Monterrey",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
