import { suggestionPoints } from "@/lib/coach";

// Always labeled: the AI drafts feedback, a person decides (C3).
export function AiSuggestion({ text }: { text: string | null }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-violet-200 bg-violet-50 p-4">
      <span className="self-start rounded-md border border-violet-300 bg-white px-2.5 py-1 text-xs font-bold tracking-wide text-violet-800">
        Sugerencia de IA — no es una decisión
      </span>
      {text ? (
        <ul className="flex list-disc flex-col gap-2 pl-5 text-slate-800">
          {suggestionPoints(text).map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-700">La sugerencia de IA no está disponible ahora.</p>
      )}
    </section>
  );
}
