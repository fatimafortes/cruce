import { Suspense } from "react";
import { ErpCard } from "@/components/erp-card";
import { Header } from "@/components/header";
import { InventedBadge } from "@/components/invented-badge";
import { SampleFlow } from "@/components/sample-flow";
import { SignOutButton } from "@/components/sign-out-button";
import { getAttemptsLeftToday, getLatestAttempt } from "@/lib/attempts";
import { requireGoogleUser } from "@/lib/auth";

export default function SamplePage() {
  return (
    <>
      <Header>
        <SignOutButton className="text-sm text-sky-200 hover:text-white" />
      </Header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-6">
        <InventedBadge />
        <ErpCard />
        <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
          <Flow />
        </Suspense>
      </main>
    </>
  );
}

// Reads the session and the worker's latest attempt, so it streams in behind Suspense.
async function Flow() {
  await requireGoogleUser("/sample");
  const [latest, attemptsLeft] = await Promise.all([getLatestAttempt(), getAttemptsLeftToday()]);
  return <SampleFlow initial={latest} attemptsLeft={attemptsLeft} />;
}
