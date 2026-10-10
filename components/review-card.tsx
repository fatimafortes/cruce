"use client";

import { useState } from "react";
import { AiSuggestion } from "@/components/ai-suggestion";
import { CheckList } from "@/components/check-list";
import type { RuleChecks } from "@/lib/checks";
import { charCount, firstMessage, REVIEW_NOTE_MAX, reviewBodySchema } from "@/lib/validation";

export type ReviewCardItem = {
  attemptId: string;
  label: string; // "Muestra del 10 oct, 17:05": never a person
  emailAnswer: string;
  followupAnswer: string;
  ruleChecks: RuleChecks | null;
  aiSuggestion: string | null;
  review: { explained: boolean; note: string } | null;
};

export function ReviewCard({ item }: { item: ReviewCardItem }) {
  const [explained, setExplained] = useState<boolean | null>(item.review?.explained ?? null);
  const [note, setNote] = useState(item.review?.note ?? "");
  const [saved, setSaved] = useState(item.review);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const name = `explained-${item.attemptId}`;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = reviewBodySchema.safeParse({ attemptId: item.attemptId, explained, note });
    if (!parsed.success) {
      setError(firstMessage(parsed.error));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? "No pudimos guardar tu revisión. Inténtalo de nuevo.");
      else setSaved({ explained: parsed.data.explained, note: parsed.data.note });
    } catch {
      setError("Sin conexión. Revisa tu internet e inténtalo de nuevo.");
    }
    setPending(false);
  }

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-slate-900">{item.label}</h2>
        {saved && (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            Revisada: {saved.explained ? "Sí" : "Todavía no"}
          </span>
        )}
      </header>

      <section className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-slate-600">Correo a Sarah (tarea 1)</h3>
        <p lang="en" className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-slate-800">{item.emailAnswer}</p>
      </section>
      <section className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-slate-600">Respuesta al cambio (tarea 2)</h3>
        <p lang="en" className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-slate-800">{item.followupAnswer}</p>
      </section>

      <CheckList title="Correo (tarea 1)" checks={item.ruleChecks?.task1 ?? null} />
      <CheckList title="Respuesta al cambio (tarea 2)" checks={item.ruleChecks?.task2 ?? null} />
      <AiSuggestion text={item.aiSuggestion} />
      <p className="text-xs text-slate-500">
        La IA puede equivocarse: compárala con la revisión de números y con las respuestas.
      </p>

      <form onSubmit={save} className="flex flex-col gap-3 border-t border-slate-200 pt-4" noValidate>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold text-slate-900">¿Explicó el cambio?</legend>
          <div className="flex gap-3">
            {[
              { value: true, text: "Sí" },
              { value: false, text: "Todavía no" },
            ].map((option) => (
              <label
                key={option.text}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 ${explained === option.value ? "border-blue-600 bg-blue-50 font-semibold text-blue-900" : "border-slate-300 text-slate-700"}`}
              >
                <input
                  type="radio"
                  name={name}
                  checked={explained === option.value}
                  onChange={() => setExplained(option.value)}
                  className="sr-only"
                />
                {option.text}
              </label>
            ))}
          </div>
        </fieldset>

        <label htmlFor={`note-${item.attemptId}`} className="font-semibold text-slate-900">
          Nota para la persona {explained === false ? "(obligatoria)" : "(opcional)"}
        </label>
        <textarea
          id={`note-${item.attemptId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Qué hizo bien y qué le falta, en pocas palabras."
          className="w-full rounded-xl border border-slate-300 p-3 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <p className="text-right text-sm text-slate-500">
          {charCount(note).toLocaleString("es-MX")} / {REVIEW_NOTE_MAX} caracteres
        </p>
        {error && (
          <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-lg font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {pending ? "Guardando…" : saved ? "Actualizar decisión" : "Guardar decisión"}
        </button>
      </form>
    </article>
  );
}
