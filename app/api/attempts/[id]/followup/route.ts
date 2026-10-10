import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { getGoogleUser } from "@/lib/auth";
import { runChecks } from "@/lib/checks";
import { createClient } from "@/lib/supabase/server";
import { saveRuleChecks } from "@/lib/supabase/admin";
import { attemptIdSchema, firstMessage, task2BodySchema } from "@/lib/validation";

// Task 2 (the changed constraint): save the follow-up once (RLS locks it after
// that), then re-run all checks from the stored text and save them.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/attempts/[id]/followup">) {
  const user = await getGoogleUser();
  if (!user) return jsonError(401, "Tu sesión terminó. Vuelve a entrar con Google.");

  const id = attemptIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return jsonError(404, "No encontramos esta muestra.");

  const body = await readJson(request);
  if (body === undefined) return jsonError(400, "No pudimos leer tu respuesta. Inténtalo de nuevo.");
  const parsed = task2BodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, firstMessage(parsed.error));
  const { followupAnswer } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cruce_attempts")
    .update({ followup_answer: followupAnswer })
    .eq("id", id.data)
    .is("followup_answer", null)
    .select("id, email_answer")
    .maybeSingle();
  if (error) {
    console.error("[api/followup] update failed", JSON.stringify({ code: error.code, message: error.message }));
    return jsonError(500, "No pudimos guardar tu respuesta. Inténtalo de nuevo.");
  }
  // Not yours, doesn't exist, or already answered: same answer for all three.
  if (!data) return jsonError(409, "Esta muestra ya tiene respuesta o no está disponible.");

  const checks = runChecks(data.email_answer, followupAnswer);
  const saved = await saveRuleChecks(data.id, checks);

  return NextResponse.json({ attemptId: data.id, followupAnswer, ruleChecks: saved ? checks : null });
}
