import "server-only";
import { z } from "zod";
import { missingMessage } from "./env";

// Secrets: importing this file from a Client Component fails the build.
const serverSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function serverEnv(): ServerEnv {
  const parsed = serverSchema.safeParse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  });
  if (!parsed.success) {
    throw new Error(missingMessage(parsed.error));
  }
  return parsed.data;
}
