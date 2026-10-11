import "server-only";
import type { Snapshot } from "@/lib/gate";
import { createClient } from "@/lib/supabase/server";

// Public read (F3 policy): anyone, signed in or not, may read the aggregate snapshots.
export async function getSnapshots(): Promise<Snapshot[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cruce_gate_snapshots")
    .select("id, snapshot_date, source, query, total_count, plant_cs_count, notes")
    .order("snapshot_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[gate] snapshots failed", JSON.stringify({ code: error.code, message: error.message }));
    return null;
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    snapshotDate: row.snapshot_date,
    source: row.source,
    query: row.query,
    totalCount: row.total_count,
    plantCsCount: row.plant_cs_count,
    notes: row.notes,
  }));
}
