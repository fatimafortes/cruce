import { NextResponse, type NextRequest } from "next/server";
import { jsonError, readJson } from "@/lib/api";
import { getGoogleUser } from "@/lib/auth";
import { isReviewer } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";
import { firstMessage, gateSnapshotBodySchema } from "@/lib/validation";

// Adds one Gate 1 snapshot. Runs as the reviewer: RLS allows inserts only by reviewers.
export async function POST(request: NextRequest) {
  const user = await getGoogleUser();
  if (!user) return jsonError(401, "Tu sesión terminó. Vuelve a entrar con Google.");
  if (!(await isReviewer(user.id))) return jsonError(403, "No autorizado.");

  const body = await readJson(request);
  if (body === undefined) return jsonError(400, "No pudimos leer los datos. Inténtalo de nuevo.");
  const parsed = gateSnapshotBodySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, firstMessage(parsed.error));
  const s = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("cruce_gate_snapshots").insert({
    snapshot_date: s.snapshotDate,
    source: s.source,
    query: s.query,
    total_count: s.totalCount,
    plant_cs_count: s.plantCsCount,
    notes: s.notes,
  });
  if (error) {
    console.error("[api/gate-snapshots] insert failed", JSON.stringify({ code: error.code, message: error.message }));
    if (error.code === "42501") return jsonError(403, "No autorizado.");
    if (error.code === "23514") return jsonError(400, "Revisa los números: el de planta no puede ser mayor que el total.");
    return jsonError(500, "No pudimos guardar la foto. Inténtalo de nuevo.");
  }
  return NextResponse.json({ saved: true }, { status: 201 });
}
