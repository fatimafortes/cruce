import type { ProofState } from "@/lib/states";

const STYLE: Record<ProofState["status"], { box: string; dot: string }> = {
  done: { box: "border-green-200 bg-green-50 text-green-900", dot: "bg-green-600" },
  review: { box: "border-slate-300 bg-white text-slate-800", dot: "border-2 border-slate-400 bg-white" },
  pending: { box: "border-slate-200 bg-slate-100 text-slate-600", dot: "bg-slate-400" },
  empty: { box: "border-dashed border-slate-300 bg-white text-slate-500", dot: "border-2 border-slate-300 bg-white" },
};

// The four states of the proof, in words (C1). States 3 and 4 are never decided here.
export function ProofStates({ states }: { states: ProofState[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold tracking-wide text-slate-600">TU PRUEBA (ES TUYA)</h2>
      <ul className="flex flex-col gap-2">
        {states.map((s) => (
          <li key={s.key} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${STYLE[s.status].box}`}>
            <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${STYLE[s.status].dot}`} />
            <span>{s.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
