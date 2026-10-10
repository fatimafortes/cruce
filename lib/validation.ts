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
