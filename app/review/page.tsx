import { Suspense } from "react";
import { Header } from "@/components/header";
import { ReviewCard, type ReviewCardItem } from "@/components/review-card";
import { SignOutButton } from "@/components/sign-out-button";
import { requireGoogleUser } from "@/lib/auth";
import { getReviewQueue, isReviewer, type QueueItem } from "@/lib/reviews";

export default function ReviewPage() {
  return (
    <>
      <Header>
        <SignOutButton className="text-sm text-sky-200 hover:text-white" />
      </Header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-5 py-6">
        <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
          <Body />
        </Suspense>
      </main>
    </>
  );
}

const label = (iso: string) =>
  `Muestra del ${new Date(iso).toLocaleString("es-MX", {
    timeZone: "America/Monterrey",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}`;

const toCard = (item: QueueItem): ReviewCardItem => ({ ...item, label: label(item.submittedAt) });

// Session and reviewer check happen at request time (requireGoogleUser awaits connection()).
async function Body() {
  const user = await requireGoogleUser("/review");
  if (!(await isReviewer(user.id))) {
    return (
      <section className="rounded-2xl bg-white p-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900">No autorizado</h1>
        <p className="mt-2 text-slate-600">Esta página es solo para personas revisoras.</p>
      </section>
    );
  }

  const queue = await getReviewQueue();
  const pending = queue.filter((item) => !item.review);
  const reviewed = queue.filter((item) => item.review).reverse();

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">Revisión</h1>
        <p className="text-slate-600">
          Decide si la persona explicó el cambio. No ves quién escribió cada muestra, y tus propias muestras no
          aparecen aquí.
        </p>
      </div>

      <h2 className="text-sm font-bold tracking-wide text-slate-600">POR REVISAR ({pending.length})</h2>
      {pending.length === 0 && <p className="text-slate-600">No hay muestras por revisar.</p>}
      {pending.map((item) => (
        <ReviewCard key={item.attemptId} item={toCard(item)} />
      ))}

      {reviewed.length > 0 && (
        <details className="flex flex-col gap-4">
          <summary className="cursor-pointer text-sm font-bold tracking-wide text-slate-600">
            YA REVISADAS ({reviewed.length})
          </summary>
          <div className="mt-4 flex flex-col gap-5">
            {reviewed.map((item) => (
              <ReviewCard key={item.attemptId} item={toCard(item)} />
            ))}
          </div>
        </details>
      )}
    </>
  );
}
