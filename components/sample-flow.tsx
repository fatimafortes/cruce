"use client";

import Link from "next/link";
import { useState } from "react";
import { AiSuggestion } from "@/components/ai-suggestion";
import { AnswerForm } from "@/components/answer-form";
import { CheckList } from "@/components/check-list";
import { InventedBadge } from "@/components/invented-badge";
import { ProofStates } from "@/components/proof-states";
import { DAILY_LIMIT_MESSAGE } from "@/lib/attempt-limits";
import type { RuleChecks } from "@/lib/checks";
import { TASK1, TASK2 } from "@/lib/sample";
import { proofStates } from "@/lib/states";
import { emailAnswerSchema, followupAnswerSchema } from "@/lib/validation";

export type SampleAttempt = {
  id: string;
  emailAnswer: string;
  followupAnswer: string | null;
  ruleChecks: RuleChecks | null;
  aiSuggestion: string | null;
};

async function post(
  url: string,
  body: unknown,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string; status: number }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "Algo salió mal. Inténtalo de nuevo.", status: res.status };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Sin conexión. Revisa tu internet e inténtalo de nuevo.", status: 0 };
  }
}

export function SampleFlow({
  initial,
  attemptsLeft: initialLeft,
}: {
  initial: SampleAttempt | null;
  // null = unknown; the database still enforces the limit.
  attemptsLeft: number | null;
}) {
  const [attempt, setAttempt] = useState<SampleAttempt | null>(initial);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(initialLeft);

  async function sendTask1(emailAnswer: string) {
    const result = await post("/api/attempts", { emailAnswer });
    if (!result.ok) {
      if (result.status === 429) setAttemptsLeft(0);
      return result.error;
    }
    setAttempt({
      id: result.data.attemptId as string,
      emailAnswer,
      followupAnswer: null,
      ruleChecks: (result.data.ruleChecks as RuleChecks | null) ?? null,
      aiSuggestion: null,
    });
    setAttemptsLeft((left) => (left === null ? null : Math.max(0, left - 1)));
    return null;
  }

  async function sendTask2(followupAnswer: string) {
    if (!attempt) return "No encontramos tu muestra.";
    const result = await post(`/api/attempts/${attempt.id}/followup`, { followupAnswer });
    if (!result.ok) return result.error;
    setAttempt({
      ...attempt,
      followupAnswer,
      ruleChecks: (result.data.ruleChecks as RuleChecks | null) ?? null,
      aiSuggestion: (result.data.aiSuggestion as string | null) ?? null,
    });
    return null;
  }

  const done = attempt?.followupAnswer != null;

  return (
    <div className="flex flex-col gap-6">
      {!attempt && attemptsLeft === 0 && (
        <p role="status" className="rounded-2xl bg-white p-4 text-lg text-slate-700">
          {DAILY_LIMIT_MESSAGE}
        </p>
      )}

      {!attempt && attemptsLeft !== 0 && (
        <AnswerForm
          key="task1"
          id="task1"
          label={TASK1.title}
          hint={TASK1.instructions}
          placeholder={TASK1.placeholder}
          max={TASK1.max}
          rows={7}
          submitLabel="Enviar muestra"
          schema={emailAnswerSchema}
          onSubmit={sendTask1}
        />
      )}

      {attempt && (
        <>
          <details className="rounded-2xl border border-slate-200 bg-white p-4">
            <summary className="cursor-pointer font-semibold text-slate-800">Tu correo a Sarah</summary>
            <p lang="en" className="mt-2 whitespace-pre-wrap text-slate-700">{attempt.emailAnswer}</p>
          </details>
          <CheckList title="Tu correo" checks={attempt.ruleChecks?.task1 ?? null} />

          <section className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <InventedBadge />
            <h2 className="text-lg font-bold text-slate-900">{TASK2.title}</h2>
            <p lang="en" className="rounded-xl bg-white p-3 text-slate-800">{TASK2.update}</p>
          </section>

          {!done && (
            <AnswerForm
              key="task2"
              id="task2"
              label="Tu respuesta a Sarah"
              hint={TASK2.instructions}
              placeholder={TASK2.placeholder}
              max={TASK2.max}
              rows={5}
              submitLabel="Enviar respuesta"
              schema={followupAnswerSchema}
              onSubmit={sendTask2}
            />
          )}

          {done && (
            <>
              <details className="rounded-2xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer font-semibold text-slate-800">Tu respuesta al cambio</summary>
                <p lang="en" className="mt-2 whitespace-pre-wrap text-slate-700">{attempt.followupAnswer}</p>
              </details>
              <CheckList title="Tu respuesta al cambio" checks={attempt.ruleChecks?.task2 ?? null} />
              <AiSuggestion text={attempt.aiSuggestion} />
              <p className="rounded-2xl bg-white p-4 text-slate-700">
                Listo, tu muestra quedó guardada en tu cuenta. Una persona revisará si explicaste el cambio.
              </p>
              <button
                type="button"
                onClick={() => setAttempt(null)}
                className="w-full rounded-2xl border border-slate-300 px-5 py-3 text-base text-slate-700 hover:bg-slate-100"
              >
                Empezar una muestra nueva
              </button>
            </>
          )}
        </>
      )}

      <ProofStates
        states={proofStates(
          attempt
            ? { emailAnswer: attempt.emailAnswer, followupAnswer: attempt.followupAnswer, ruleChecks: attempt.ruleChecks }
            : null,
        )}
      />
      <p className="text-center text-sm text-slate-500">
        Sin CV, sin RFC. Tu empleador actual nunca se entera. <Link href="/" className="underline">Inicio</Link>
      </p>
    </div>
  );
}
