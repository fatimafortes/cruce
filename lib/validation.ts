import { z } from "zod";
import { TASK1, TASK2 } from "@/lib/sample";

// Shared by the forms (client) and the API routes (server). Security floor 4.

// Count characters the way Postgres char_length() does (code points), so the
// form, the API and the database CHECK constraint always agree.
export function charCount(text: string): number {
  return [...text].length;
}

const fmt = (n: number) => n.toLocaleString("es-MX");

function answer(min: number, max: number, empty: string, noun: string) {
  return z
    .string({ error: empty })
    .max(max * 4, { error: `Máximo ${fmt(max)} caracteres.` }) // cheap cap before trimming
    .trim()
    .superRefine((text, ctx) => {
      const n = charCount(text);
      if (n === 0) ctx.addIssue({ code: "custom", message: empty });
      else if (n < min) ctx.addIssue({ code: "custom", message: `${noun} necesita al menos ${fmt(min)} caracteres.` });
      else if (n > max) ctx.addIssue({ code: "custom", message: `Máximo ${fmt(max)} caracteres.` });
    });
}

export const emailAnswerSchema = answer(
  TASK1.min,
  TASK1.max,
  "Escribe tu correo antes de enviarlo.",
  "Tu correo",
);

export const followupAnswerSchema = answer(
  TASK2.min,
  TASK2.max,
  "Escribe tu respuesta antes de enviarla.",
  "Tu respuesta",
);

export const task1BodySchema = z.strictObject({ emailAnswer: emailAnswerSchema });
export const task2BodySchema = z.strictObject({ followupAnswer: followupAnswerSchema });
export const attemptIdSchema = z.uuid();

export function firstMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Revisa tu respuesta.";
}

// Human review (F6). The note is required for "todavía no", so the worker
// always learns what to improve (packet flow: "not yet, with reviewer note").
export const REVIEW_NOTE_MAX = 500;
export const REVIEW_NOTE_MIN_NOT_YET = 10;

export const reviewBodySchema = z
  .strictObject({
    attemptId: z.uuid({ error: "No encontramos esta muestra." }),
    explained: z.boolean({ error: "Elige «Sí» o «Todavía no»." }),
    note: z.string({ error: "Escribe una nota." }).max(REVIEW_NOTE_MAX * 4).trim(),
  })
  .superRefine((review, ctx) => {
    const n = charCount(review.note);
    if (n > REVIEW_NOTE_MAX) {
      ctx.addIssue({ code: "custom", path: ["note"], message: `Máximo ${fmt(REVIEW_NOTE_MAX)} caracteres.` });
    } else if (!review.explained && n < REVIEW_NOTE_MIN_NOT_YET) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Si eliges «Todavía no», escribe una nota (al menos 10 caracteres) sobre qué falta.",
      });
    }
  });

// Share link (F7): the worker decides what it shows (C2).
export const DISPLAY_NAME_MAX = 60;

export const shareBodySchema = z.strictObject({
  attemptId: z.uuid({ error: "No encontramos esta muestra." }),
  // The form parses with this schema and sends the result, so the server sees
  // its own output (null for "no name") and must accept it (Bug 3).
  // null, missing, empty and whitespace all mean "no name".
  displayName: z.preprocess(
    (value) => (value === null || value === undefined ? "" : value),
    z
      .string({ error: "Escribe el nombre como texto." })
      .max(DISPLAY_NAME_MAX * 4, { error: `Máximo ${DISPLAY_NAME_MAX} caracteres.` })
      .trim()
      .refine((name) => charCount(name) <= DISPLAY_NAME_MAX, { error: `Máximo ${DISPLAY_NAME_MAX} caracteres.` })
      .transform((name) => (name === "" ? null : name)),
  ),
  includeAnswers: z.boolean({ error: "Indica si quieres incluir tus respuestas." }),
});
