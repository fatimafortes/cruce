import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { getGoogleUser } from "@/lib/auth";
import { getReviewQueue, isReviewer } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";
import { firstMessage, reviewBodySchema } from "@/lib/validation";

// A reviewer's decision on state 3. Runs as the reviewer, so RLS enforces
// "reviewers only" and "no self-review"; the checks here give clear messages.
export async function POST(request: NextRequest) {
  const user = await getGoogleUser();
  if (!user) return jsonError(401, "Tu sesión terminó. Vuelve a entrar con Google.");
  if (!(await isReviewer(user.id))) return jsonError(403, "No autorizado.");

  const body = await readJson(request);
  if (body === undefined) return jsonError(400, "No pudimos leer tu revisión. Inténtalo de nuevo.");
  const parsed = reviewBodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, firstMessage(parsed.error));
  const { attemptId, explained, note } = parsed.data;

  // Only attempts in your queue: task 2 answered, not your own.
  const queue = await getReviewQueue();
  if (!queue.some((item) => item.attemptId === attemptId)) {
    return jsonError(404, "Esta muestra no está en tu lista de revisión.");
  }

  const supabase = await createClient();
  const updated = await supabase
    .from("cruce_reviews")
    .update({ explained, note })
    .eq("attempt_id", attemptId)
    .eq("reviewer_id", user.id)
    .select("id");
  if (updated.error) {
    console.error("[api/reviews] update failed", JSON.stringify({ code: updated.error.code, message: updated.error.message }));
    return jsonError(500, "No pudimos guardar tu revisión. Inténtalo de nuevo.");
  }

  if (updated.data.length === 0) {
    const inserted = await supabase.from("cruce_reviews").insert({ attempt_id: attemptId, explained, note });
    if (inserted.error?.code === "23505") {
      return jsonError(409, "Otra persona ya revisó esta muestra.");
    }
    if (inserted.error) {
      console.error("[api/reviews] insert failed", JSON.stringify({ code: inserted.error.code, message: inserted.error.message }));
      return jsonError(inserted.error.code === "42501" ? 403 : 500, inserted.error.code === "42501" ? "No autorizado." : "No pudimos guardar tu revisión. Inténtalo de nuevo.");
    }
  }

  return NextResponse.json({ attemptId, review: { explained, note } });
}
