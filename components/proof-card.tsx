"use client";

import { useState, useSyncExternalStore } from "react";
import { AiSuggestion } from "@/components/ai-suggestion";
import { CheckList } from "@/components/check-list";
import { ProofStates } from "@/components/proof-states";
import type { RuleChecks } from "@/lib/checks";
import { downloadProofPdf } from "@/lib/pdf-render";
import { proofPdfBlocks, proofPdfFileName } from "@/lib/proof-pdf";
import { proofStates } from "@/lib/states";
import { charCount, DISPLAY_NAME_MAX, firstMessage, shareBodySchema } from "@/lib/validation";

type Link = { id: string; token: string; displayName: string | null; includeAnswers: boolean };

export type ProofCardItem = {
  id: string;
  createdAt: string;
  dateLabel: string;
  emailAnswer: string;
  followupAnswer: string | null;
  ruleChecks: RuleChecks | null;
  aiSuggestion: string | null;
  review: { explained: boolean; note: string } | null;
  activeLink: Link | null;
};

async function postJson(url: string, body?: unknown) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true as const, data } : { ok: false as const, error: (data.error as string) ?? "Algo salió mal." };
  } catch {
    return { ok: false as const, error: "Sin conexión. Revisa tu internet e inténtalo de nuevo." };
  }
}

export function ProofCard({ item, origin }: { item: ProofCardItem; origin: string }) {
  const [link, setLink] = useState<Link | null>(item.activeLink);
  const [displayName, setDisplayName] = useState("");
  const [includeAnswers, setIncludeAnswers] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const states = proofStates(item);
  const url = link ? `${origin}/p/${link.token}` : null;

  async function createLink(event: React.FormEvent) {
    event.preventDefault();
    const parsed = shareBodySchema.safeParse({ attemptId: item.id, displayName, includeAnswers });
    if (!parsed.success) return setError(firstMessage(parsed.error));
    setPending(true);
    setError(null);
    const result = await postJson("/api/proof-links", parsed.data);
    setPending(false);
    if (!result.ok) return setError(result.error);
    setLink(result.data.link as Link);
    setMessage(null);
  }

  async function revoke() {
    if (!link) return;
    setPending(true);
    setError(null);
    const result = await postJson(`/api/proof-links/${link.id}/revoke`);
    setPending(false);
    setConfirmRevoke(false);
    if (!result.ok) return setError(result.error);
    setLink(null);
    setMessage("Listo: esta prueba ya no se comparte. Quien abra el enlace verá «Esta prueba ya no se comparte».");
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Enlace copiado.");
    } catch {
      setMessage("No pudimos copiar. Mantén presionado el enlace para copiarlo.");
    }
  }

  async function share() {
    if (!url) return;
    try {
      await navigator.share({ title: "Mi prueba de trabajo · Cruce", url });
    } catch {
      // Cancelled by the worker, or not supported: nothing to do.
    }
  }

  async function pdf() {
    setError(null);
    try {
      await downloadProofPdf(
        proofPdfBlocks({
          dateLabel: item.dateLabel,
          states,
          ruleChecks: item.ruleChecks,
          emailAnswer: item.emailAnswer,
          followupAnswer: item.followupAnswer,
          aiSuggestion: item.aiSuggestion,
          review: item.review,
        }),
        proofPdfFileName(item.createdAt),
      );
    } catch {
      setError("No pudimos crear el PDF. Inténtalo de nuevo.");
    }
  }

  // Native share sheet (phones). false on the server, so the first render matches.
  const canShare = useSyncExternalStore(
    () => () => {},
    () => "share" in navigator,
    () => false,
  );

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="font-bold text-slate-900">Muestra del {item.dateLabel}</h2>
      <ProofStates states={states} title="ESTADOS" />

      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer font-semibold text-slate-800">Ver respuestas, revisión y sugerencia</summary>
        <div className="mt-3 flex flex-col gap-3">
          <p lang="en" className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-slate-800">{item.emailAnswer}</p>
          {item.followupAnswer && (
            <p lang="en" className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-slate-800">{item.followupAnswer}</p>
          )}
          <CheckList title="Correo (tarea 1)" checks={item.ruleChecks?.task1 ?? null} />
          {item.followupAnswer && <CheckList title="Respuesta al cambio (tarea 2)" checks={item.ruleChecks?.task2 ?? null} />}
          {item.followupAnswer && <AiSuggestion text={item.aiSuggestion} />}
          {item.review && (
            <section className="rounded-2xl border border-slate-300 p-4">
              <h3 className="font-semibold text-slate-900">Nota de la persona revisora</h3>
              <p className="text-slate-700">
                {item.review.explained ? "Explicaste el cambio." : "Todavía no se ve cómo explicas el cambio."}
              </p>
              {item.review.note && <p className="mt-1 whitespace-pre-wrap text-slate-800">{item.review.note}</p>}
            </section>
          )}
        </div>
      </details>

      <button
        type="button"
        onClick={pdf}
        className="w-full rounded-2xl border border-slate-300 px-5 py-3 font-semibold text-slate-800 hover:bg-slate-100"
      >
        Descargar PDF
      </button>

      <section className="flex flex-col gap-3 border-t border-slate-200 pt-4">
        <h3 className="font-semibold text-slate-900">Compartir</h3>
        {link && url ? (
          <>
            <p className="text-sm text-slate-600">
              Quien tenga este enlace verá los cuatro estados y la fecha
              {link.displayName ? `, el nombre «${link.displayName}»` : ""}
              {link.includeAnswers ? " y tus dos respuestas" : ""}. Nunca la sugerencia de IA ni la nota de revisión.
            </p>
            <p className="break-all rounded-xl bg-slate-50 p-3 font-mono text-sm text-slate-800">{url}</p>
            <div className="flex gap-2">
              <button type="button" onClick={copy} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700">
                Copiar
              </button>
              {canShare && (
                <button type="button" onClick={share} className="flex-1 rounded-xl border border-blue-600 px-4 py-3 font-semibold text-blue-700">
                  Compartir
                </button>
              )}
            </div>
            {!confirmRevoke ? (
              <button type="button" onClick={() => setConfirmRevoke(true)} className="self-start text-slate-700 underline">
                Revocar enlace
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3">
                <p className="text-sm text-slate-700">El enlace dejará de funcionar para siempre. Podrás crear uno nuevo.</p>
                <div className="flex gap-2">
                  <button type="button" disabled={pending} onClick={revoke} className="flex-1 rounded-xl bg-slate-800 px-4 py-2 font-semibold text-white disabled:opacity-60">
                    Sí, revocar enlace
                  </button>
                  <button type="button" onClick={() => setConfirmRevoke(false)} className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-slate-700">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={createLink} className="flex flex-col gap-3" noValidate>
            <label htmlFor={`name-${item.id}`} className="text-sm font-semibold text-slate-800">
              Nombre para mostrar (opcional)
            </label>
            <input
              id={`name-${item.id}`}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Por ejemplo: Lupita M."
              autoComplete="off"
              className="rounded-xl border border-slate-300 p-3 text-slate-900"
            />
            <p className="text-right text-xs text-slate-500">
              {charCount(displayName)} / {DISPLAY_NAME_MAX}
            </p>
            <label className="flex items-start gap-3 text-slate-800">
              <input
                type="checkbox"
                checked={includeAnswers}
                onChange={(e) => setIncludeAnswers(e.target.checked)}
                className="mt-1 h-5 w-5"
              />
              <span>
                Incluir mis respuestas
                <span className="block text-sm text-slate-600">Para que vean tu trabajo, no solo los estados.</span>
              </span>
            </label>
            <p className="text-sm text-slate-600">
              El enlace mostrará los cuatro estados y la fecha{includeAnswers ? ", y tus dos respuestas" : ""}. Nunca la
              sugerencia de IA ni la nota de revisión. Puedes revocarlo cuando quieras.
            </p>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-lg font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? "Creando…" : "Crear enlace para compartir"}
            </button>
          </form>
        )}
        {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
        {error && (
          <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </p>
        )}
      </section>
    </article>
  );
}
