import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Header } from "@/components/header";
import { InventedBadge } from "@/components/invented-badge";
import { ProofCard } from "@/components/proof-card";
import { SignOutButton } from "@/components/sign-out-button";
import { requireGoogleUser } from "@/lib/auth";
import { getMyProofs, proofDateLabel } from "@/lib/proofs";

export default function ProofPage() {
  return (
    <>
      <Header>
        <SignOutButton className="text-sm text-sky-200 hover:text-white" />
      </Header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-6">
        <h1 className="text-2xl font-bold text-slate-900">Tu prueba</h1>
        <p className="text-slate-600">
          Tus muestras viven en tu cuenta. Tú decides si las compartes, las descargas o las guardas.
        </p>
        <InventedBadge />
        <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
          <Body />
        </Suspense>
      </main>
    </>
  );
}

// Session and data at request time (requireGoogleUser awaits connection()).
async function Body() {
  await requireGoogleUser("/proof");
  const [proofs, h] = await Promise.all([getMyProofs(), headers()]);
  const host = h.get("host") ?? "cruce-wheat.vercel.app";
  const origin = `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}`;

  if (proofs.length === 0) {
    return (
      <p className="rounded-2xl bg-white p-4 text-slate-700">
        Todavía no tienes muestras.{" "}
        <Link href="/sample" className="font-semibold text-blue-700 underline">
          Empieza tu primera muestra
        </Link>
        .
      </p>
    );
  }

  return (
    <>
      {proofs.map((proof) => (
        <ProofCard key={proof.id} origin={origin} item={{ ...proof, dateLabel: proofDateLabel(proof.createdAt) }} />
      ))}
      <Link href="/sample" className="text-center text-blue-700 underline">
        Volver a la muestra
      </Link>
    </>
  );
}
