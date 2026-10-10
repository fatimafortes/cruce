import "server-only";
import { z } from "zod";
import { missingMessage } from "./env";

// Secrets: importing this file from a Client Component fails the build.
// Each group is checked on its own, so a missing Gemini key doesn't stop the rule checks.

const secretKeySchema = z.object({
  // Cruce's own secret key ("cruce_server"). Bypasses RLS: server only.
  SUPABASE_SECRET_KEY: z.string().trim().startsWith("sb_secret_"),
});

const geminiSchema = z.object({
  GEMINI_API_KEY: z.string().trim().min(1),
  GEMINI_MODEL: z.string().trim().regex(/^[a-z0-9.-]+$/),
});

function parse<T extends z.ZodTypeAny>(schema: T, values: Record<string, unknown>): z.infer<T> {
  const parsed = schema.safeParse(values);
  if (!parsed.success) throw new Error(missingMessage(parsed.error));
  return parsed.data;
}

export function secretKeyEnv() {
  return parse(secretKeySchema, { SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY });
}

export function geminiEnv() {
  return parse(geminiSchema, {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  });
}
