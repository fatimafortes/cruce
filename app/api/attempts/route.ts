import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { DAILY_LIMIT_MESSAGE } from "@/lib/attempt-limits";
import { getGoogleUser } from "@/lib/auth";
import { runChecks } from "@/lib/checks";
import { createClient } from "@/lib/supabase/server";
import { saveRuleChecks } from "@/lib/supabase/admin";
import { firstMessage, task1BodySchema } from "@/lib/validation";

// Task 1: save the worker's email (as the worker, so RLS checks ownership),
// then run the deterministic checks and save them with the server key.
export async function POST(request: NextRequest) {
  const user = await getGoogleUser();
  if (!user) return jsonError(401, "Tu sesión terminó. Vuelve a entrar con Google.");

  const body = await readJson(request);
  if (body === undefined) return jsonError(400, "No pudimos leer tu respuesta. Inténtalo de nuevo.");
  const parsed = task1BodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, firstMessage(parsed.error));
  const { emailAnswer } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cruce_attempts")
    .insert({ email_answer: emailAnswer })
    .select("id")
    .single();
  if (error?.message === "cruce_daily_limit") {
    return jsonError(429, DAILY_LIMIT_MESSAGE);
  }
  if (error || !data) {
    console.error("[api/attempts] insert failed", JSON.stringify({ code: error?.code, message: error?.message }));
    return jsonError(500, "No pudimos guardar tu muestra. Inténtalo de nuevo.");
  }

  const checks = runChecks(emailAnswer, null);
  const saved = await saveRuleChecks(data.id, checks);

  return NextResponse.json(
    { attemptId: data.id, emailAnswer, ruleChecks: saved ? checks : null },
    { status: 201 },
  );
}
