import type { Check } from "@/lib/checks";

// Facts found or not found in the text, never a grade (C1). No red: a missing
// item is something to look at again, not a failure.
export function CheckList({ title, checks }: { title: string; checks: Check[] | null }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500">
        Revisión automática de números — no es una calificación.
      </p>
      {checks === null ? (
        <p className="text-sm text-slate-600">
          La revisión automática no está disponible ahora. Tu respuesta quedó guardada.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {checks.map((c) => (
            <li key={c.item} className="flex gap-3">
              <span
                aria-hidden
                className={
                  c.passed
                    ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs text-white"
                    : "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-slate-400 text-xs text-slate-500"
                }
              >
                {c.passed ? "✓" : "·"}
              </span>
              <span className="text-sm">
                <span className="font-medium text-slate-800">{c.item}</span>
                <span className="sr-only">{c.passed ? " (encontrado)" : " (revisa)"}</span>
                <span className="block text-slate-600">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
