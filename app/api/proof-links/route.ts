import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { getGoogleUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstMessage, shareBodySchema } from "@/lib/validation";

// Creates a share link as the worker (RLS: only for your own attempts). If a
// live link already exists for the attempt, returns it instead of a second one.
export async function POST(request: NextRequest) {
  const user = await getGoogleUser();
  if (!user) return jsonError(401, "Tu sesión terminó. Vuelve a entrar con Google.");

  const body = await readJson(request);
  if (body === undefined) return jsonError(400, "No pudimos leer tu solicitud. Inténtalo de nuevo.");
  const parsed = shareBodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, firstMessage(parsed.error));
  const { attemptId, displayName, includeAnswers } = parsed.data;

  const supabase = await createClient();
  const existing = await supabase
    .from("cruce_proof_links")
    .select("id, token, display_name, include_answers")
    .eq("attempt_id", attemptId)
    .eq("revoked", false)
    .limit(1)
    .maybeSingle();
  if (existing.data) {
    const l = existing.data;
    return NextResponse.json({ link: { id: l.id, token: l.token, displayName: l.display_name, includeAnswers: l.include_answers } });
  }

  const { data, error } = await supabase
    .from("cruce_proof_links")
    .insert({ attempt_id: attemptId, display_name: displayName, include_answers: includeAnswers })
    .select("id, token, display_name, include_answers")
    .single();
  if (error || !data) {
    // 42501 = RLS: not your attempt. Same answer as "doesn't exist".
    if (error?.code === "42501" || error?.code === "23503") return jsonError(404, "No encontramos esta muestra.");
    console.error("[api/proof-links] insert failed", JSON.stringify({ code: error?.code, message: error?.message }));
    return jsonError(500, "No pudimos crear el enlace. Inténtalo de nuevo.");
  }
  return NextResponse.json(
    { link: { id: data.id, token: data.token, displayName: data.display_name, includeAnswers: data.include_answers } },
    { status: 201 },
  );
}
