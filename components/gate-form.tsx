"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { firstMessage, gateSnapshotBodySchema, todayInMonterrey } from "@/lib/validation";

const empty = { snapshotDate: "", source: "", query: "", totalCount: "", plantCsCount: "", notes: "" };

// Reviewers only (checked on the server before this renders, and again by the API and RLS).
export function GateForm() {
  const router = useRouter();
  const [values, setValues] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const toNumber = (text: string) => (text.trim() === "" ? Number.NaN : Number(text));
    const parsed = gateSnapshotBodySchema.safeParse({
      ...values,
      totalCount: toNumber(values.totalCount),
      plantCsCount: toNumber(values.plantCsCount),
    });
    if (!parsed.success) {
      setError(firstMessage(parsed.error));
      return;
    }
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/gate-snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No pudimos guardar la foto. Inténtalo de nuevo.");
      } else {
        setSaved(true);
        setValues({ ...empty, source: "", query: values.query }); // keep the fixed query for the next source
        router.refresh(); // re-reads the snapshots on the server
      }
    } catch {
      setError("Sin conexión. Revisa tu internet e inténtalo de nuevo.");
    }
    setPending(false);
  }

  const input = "w-full rounded-xl border border-slate-300 p-3 text-slate-900";
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <h2 className="text-lg font-bold text-slate-900">Agregar una foto semanal (solo personas revisoras)</h2>
      <label className="flex flex-col gap-1 text-sm font-semibold text-slate-800">
        Fecha de la foto
        <input type="date" max={todayInMonterrey()} value={values.snapshotDate} onChange={set("snapshotDate")} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-slate-800">
        Fuente (bolsa de trabajo)
        <input value={values.source} onChange={set("source")} placeholder="Por ejemplo: OCC Mundial" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-slate-800">
        Búsqueda usada (la misma cada semana)
        <input value={values.query} onChange={set("query")} placeholder="servicio al cliente planta manufactura Monterrey" className={input} />
      </label>
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm font-semibold text-slate-800">
          Resultados totales
          <input inputMode="numeric" value={values.totalCount} onChange={set("totalCount")} className={input} />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm font-semibold text-slate-800">
          En planta (sin call centers)
          <input inputMode="numeric" value={values.plantCsCount} onChange={set("plantCsCount")} className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-semibold text-slate-800">
        Notas (opcional, sin enlaces)
        <textarea value={values.notes} onChange={set("notes")} rows={2} className={input} />
      </label>
      {error && (
        <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      )}
      {saved && <p role="status" className="text-sm text-slate-700">Foto guardada. La tabla ya está actualizada.</p>}
      <button type="submit" disabled={pending} className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-lg font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
        {pending ? "Guardando…" : "Guardar foto"}
      </button>
      <p className="text-xs text-slate-600">
        No se pueden editar ni borrar fotos aquí; para corregir un error, usa el SQL Editor de Supabase.
      </p>
    </form>
  );
}
