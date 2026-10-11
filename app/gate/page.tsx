import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { GateForm } from "@/components/gate-form";
import { Header } from "@/components/header";
import { getGoogleUser } from "@/lib/auth";
import { averageWeekly, POSTING_LIFETIME_WEEKS, rangeText, weeklyRanges, yearlyEstimate } from "@/lib/gate";
import { getSnapshots } from "@/lib/gate-data";
import { isReviewer } from "@/lib/reviews";

export const metadata: Metadata = {
  title: "Gate 1 · Cruce",
  description: "Conteo agregado de vacantes de servicio al cliente en planta en Monterrey, con su método.",
};

// Public: aggregate numbers and the method only (packet §11.2). No postings,
// companies, people or links to apply.
export default function GatePage() {
  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-5 py-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900">Gate 1: vacantes de servicio al cliente en planta, Monterrey</h1>
          <p className="text-slate-600">
            Solo números agregados: no se muestran vacantes individuales, empresas ni personas, ni enlaces para postularse.
          </p>
        </div>

        <Suspense fallback={<p className="text-slate-500">Cargando…</p>}>
          <Numbers />
        </Suspense>

        <section className="flex flex-col gap-2 rounded-2xl bg-white p-4 text-slate-700">
          <h2 className="font-bold text-slate-900">Método</h2>
          <p>No existe un archivo público con un año de vacantes, así que el conteo se arma así:</p>
          <ol className="flex list-decimal flex-col gap-1 pl-5">
            <li>
              Cada semana, hasta el cierre del módulo, se toma una foto del número de vacantes en 2 o 3 bolsas de trabajo, siempre
              con la misma búsqueda: servicio al cliente + manufactura/planta + área metropolitana de Monterrey.
            </li>
            <li>Solo se cuentan puestos de servicio al cliente en planta; los call centers se excluyen.</li>
            <li>
              El promedio semanal se muestra como rango: el número bajo es la fuente con más vacantes esa semana; el alto, la suma
              de todas las fuentes (una misma vacante puede aparecer en varias bolsas).
            </li>
            <li>
              La cifra anual se estima con el promedio semanal y la duración típica de una vacante (vacantes al año ≈ promedio
              semanal × 52 ÷ semanas que dura una vacante), y se presenta como rango con su método.
            </li>
          </ol>
        </section>

        <Suspense fallback={null}>
          <ReviewerForm />
        </Suspense>
      </main>
    </>
  );
}

const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

async function Numbers() {
  await connection(); // read on every visit, so a new snapshot shows at once
  const snapshots = await getSnapshots();

  if (snapshots === null) {
    return <p className="rounded-2xl bg-white p-4 text-slate-700">No pudimos cargar los datos ahora. Inténtalo más tarde.</p>;
  }
  if (snapshots.length === 0) {
    return <p className="rounded-2xl bg-white p-6 text-center text-xl font-semibold text-slate-700">Sin datos todavía</p>;
  }

  const average = averageWeekly(snapshots)!;
  const yearly = yearlyEstimate(average);
  const weeks = weeklyRanges(snapshots);

  return (
    <>
      <section className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-lg text-slate-900">
          <span className="font-bold">Promedio semanal:</span> {rangeText(average.low, average.high)} vacantes de servicio al
          cliente en planta
          <span className="text-slate-600">
            {" "}
            ({average.weeks} {average.weeks === 1 ? "semana" : "semanas"} de datos)
          </span>
        </p>
        <p className="text-lg text-slate-900">
          <span className="font-bold">Estimación anual:</span>{" "}
          {yearly && POSTING_LIFETIME_WEEKS
            ? `${rangeText(yearly.low, yearly.high)} vacantes (suponiendo que una vacante dura ${POSTING_LIFETIME_WEEKS.min} a ${POSTING_LIFETIME_WEEKS.max} semanas; fuente: ${POSTING_LIFETIME_WEEKS.source})`
            : "pendiente (falta la duración típica de una vacante)"}
        </p>
        <ul className="text-sm text-slate-600">
          {weeks.map((w) => (
            <li key={w.week}>
              Semana {w.week}: {rangeText(w.low, w.high)} ({w.sources} {w.sources === 1 ? "fuente" : "fuentes"})
            </li>
          ))}
        </ul>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3">Fuente</th>
              <th className="p-3">Búsqueda</th>
              <th className="p-3 text-right">Resultados</th>
              <th className="p-3 text-right">En planta</th>
              <th className="p-3">Notas</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap p-3">{dateLabel(s.snapshotDate)}</td>
                <td className="p-3">{s.source}</td>
                <td className="p-3 text-slate-600">{s.query}</td>
                <td className="p-3 text-right">{s.totalCount.toLocaleString("es-MX")}</td>
                <td className="p-3 text-right font-semibold">{s.plantCsCount.toLocaleString("es-MX")}</td>
                <td className="p-3 text-slate-600">{s.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Only signed-in reviewers see the form; everyone else sees nothing here.
async function ReviewerForm() {
  const user = await getGoogleUser();
  if (!user || !(await isReviewer(user.id))) return null;
  return <GateForm />;
}
