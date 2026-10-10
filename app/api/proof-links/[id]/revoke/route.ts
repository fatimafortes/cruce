import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api";
import { getGoogleUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { attemptIdSchema } from "@/lib/validation";

// Revokes one of your share links. One-way (F3 policy): a revoked link stays revoked.
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/proof-links/[id]/revoke">) {
  const user = await getGoogleUser();
  if (!user) return jsonError(401, "Tu sesión terminó. Vuelve a entrar con Google.");

  const id = attemptIdSchema.safeParse((await ctx.params).id);
  if (!id.success) return jsonError(404, "No encontramos este enlace.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cruce_proof_links")
    .update({ revoked: true })
    .eq("id", id.data)
    .eq("revoked", false)
    .select("id");
  if (error) {
    console.error("[api/proof-links/revoke] failed", JSON.stringify({ code: error.code, message: error.message }));
    return jsonError(500, "No pudimos revocar el enlace. Inténtalo de nuevo.");
  }
  // Not yours, unknown, or already revoked: the link doesn't work either way.
  if (!data?.length) return jsonError(404, "Este enlace ya no está activo.");
  return NextResponse.json({ revoked: true });
}
