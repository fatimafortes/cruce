"use client";

import { useState } from "react";
import type { z } from "zod";
import { charCount, firstMessage } from "@/lib/validation";

type Props = {
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  max: number;
  rows: number;
  submitLabel: string;
  schema: z.ZodType<string>;
  // Returns an error message to show, or null on success.
  onSubmit: (text: string) => Promise<string | null>;
};

export function AnswerForm({ id, label, hint, placeholder, max, rows, submitLabel, schema, onSubmit }: Props) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const count = charCount(text);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse(text);
    if (!parsed.success) {
      setError(firstMessage(parsed.error));
      return;
    }
    setPending(true);
    setError(null);
    const message = await onSubmit(parsed.data);
    setPending(false);
    if (message) setError(message);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
      <label htmlFor={id} className="text-xl font-bold text-slate-900">
        {label}
      </label>
      <p id={`${id}-hint`} className="text-slate-600">
        {hint}
      </p>
      <textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        lang="en"
        spellCheck
        aria-describedby={`${id}-hint ${id}-count${error ? ` ${id}-error` : ""}`}
        aria-invalid={error ? true : undefined}
        className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-base text-slate-900 placeholder:italic placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
      <p id={`${id}-count`} className={`text-right text-sm ${count > max ? "text-slate-900 font-semibold" : "text-slate-500"}`}>
        {count.toLocaleString("es-MX")} / {max.toLocaleString("es-MX")} caracteres
      </p>
      {error && (
        <p id={`${id}-error`} role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-lg font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Enviando…" : submitLabel}
      </button>
    </form>
  );
}
