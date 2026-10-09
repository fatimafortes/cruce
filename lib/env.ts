import { z } from "zod";

// Public values: Next.js inlines NEXT_PUBLIC_* into the browser bundle,
// but only when each one is referenced literally as process.env.NEXT_PUBLIC_X.
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicSchema>;

// Validated on first use, not at import, so `npm run build` works
// before a Supabase project exists.
export function publicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    throw new Error(missingMessage(parsed.error));
  }
  return parsed.data;
}

export function missingMessage(error: z.ZodError): string {
  const names = error.issues.map((issue) => issue.path.join(".")).join(", ");
  return `Missing or invalid environment variables: ${names}. See .env.example.`;
}
