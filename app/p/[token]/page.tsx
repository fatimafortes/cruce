import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Header } from "@/components/header";
import { InventedBadge } from "@/components/invented-badge";
import { ProofStates } from "@/components/proof-states";
import { getPublicProof, proofDateLabel } from "@/lib/proofs";
import { statesFromSummary } from "@/lib/states";

// A proof the worker chose to share. Not indexed by search engines, and the
// token isn't sent to other sites as a referrer.
export const metadata: Metadata = {
  title: "Prueba de trabajo · Cruce",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function PublicProofPage({ params }: PageProps<"/p/[token]">) {
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-6">
        <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
          <Body params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Body({ params }: Pick<PageProps<"/p/[token]">, "params">) {
  await connection(); // always read live: a revoked link must stop working immediately
  const { token } = await params;
  const proof = await getPublicProof(token);

  // Revoked and unknown tokens look the same.
  if (!proof) {
    return (
      <section className="rounded-2xl bg-white p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900">Esta prueba ya no se comparte.</h1>
      </section>
    );
  }

  return (
    <>
      <InventedBadge />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">
          {proof.displayName ? `Prueba de trabajo de ${proof.displayName}` : "Prueba de trabajo"}
        </h1>
        <p className="text-slate-600">Muestra del {proofDateLabel(proof.submittedAt)}</p>
      </div>
      <ProofStates states={statesFromSummary(proof.summary)} title="ESTADOS DE LA PRUEBA" />
      {proof.answers && (
        <>
          <section className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-slate-600">Correo al cliente (tarea 1)</h2>
            <p lang="en" className="whitespace-pre-wrap rounded-xl bg-white p-3 text-slate-800">{proof.answers.email}</p>
          </section>
          {proof.answers.followup && (
            <section className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold text-slate-600">Respuesta a un cambio de último momento (tarea 2)</h2>
              <p lang="en" className="whitespace-pre-wrap rounded-xl bg-white p-3 text-slate-800">{proof.answers.followup}</p>
            </section>
          )}
        </>
      )}
      <p className="text-sm text-slate-500">
        Esta prueba la comparte la persona que la hizo, con datos de una planta ficticia. No es una calificación ni un
        examen, y Cruce no publica listas de personas.
      </p>
    </>
  );
}
