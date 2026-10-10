import { Suspense } from "react";
import { Header } from "@/components/header";
import { SignOutButton } from "@/components/sign-out-button";
import { requireGoogleUser } from "@/lib/auth";

// Shell for pages that need sign-in. The session is read inside Suspense
// (required with Cache Components); proxy.ts has already redirected most visitors.
export function ProtectedPlaceholder({ path, title }: { path: string; title: string }) {
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-8">
        <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
          <Body path={path} title={title} />
        </Suspense>
      </main>
    </>
  );
}

async function Body({ path, title }: { path: string; title: string }) {
  await requireGoogleUser(path);
  return (
    <>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-lg text-slate-600">Próximamente.</p>
      <SignOutButton className="self-start text-blue-700 underline" />
    </>
  );
}
