import Link from "next/link";
import { Suspense } from "react";
import { Header } from "@/components/header";
import { SignInButton } from "@/components/sign-in-button";
import { SignOutButton } from "@/components/sign-out-button";
import { getGoogleUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/auth-rules";
import { PROJECT_DATA_LINK } from "@/lib/copy";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
        <p className="text-xl leading-relaxed text-slate-800">
          Ya sabes calmar a un cliente de EE.&nbsp;UU. en inglés y bajo presión. Cruce te
          deja practicar la otra mitad del trabajo de servicio al cliente en planta
          (órdenes, números de parte y fechas de envío) y quedarte con una prueba que es
          tuya.
        </p>
        <p className="text-base text-slate-600">
          Es una práctica con datos inventados de una planta ficticia. No es una vacante
          ni un examen.
        </p>
        <p className="text-lg font-semibold text-slate-800">
          Sin CV, sin RFC. Tu empleador actual nunca se entera.
        </p>
        <Suspense fallback={<div className="h-[60px]" aria-hidden />}>
          <Actions searchParams={searchParams} />
        </Suspense>
        <Link href="/gate" className="mt-auto text-center text-sm text-slate-500 underline">
          {PROJECT_DATA_LINK}
        </Link>
      </main>
    </>
  );
}

// Reads the session and the URL, so it streams in behind Suspense.
async function Actions({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : undefined;
  const next = safeNextPath(nextParam);
  const authFailed = params.error === "auth";
  const user = await getGoogleUser();

  if (user) {
    return (
      <div className="flex flex-col gap-3">
        <Link
          href={next}
          className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-center text-lg font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Continuar a la muestra
        </Link>
        <SignOutButton className="w-full rounded-2xl border border-slate-300 px-5 py-3 text-base text-slate-700 hover:bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {authFailed && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          No pudimos completar el inicio de sesión. Inténtalo de nuevo.
        </p>
      )}
      <SignInButton next={next} />
    </div>
  );
}
