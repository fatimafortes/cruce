# DECISIONS

What we decided, why, and what comes next. Source of truth: `docs/PACKET.md` and `docs/IMPLEMENTATION_PROMPT.md`.

## 2026-10-09 — F1: project setup

| Decision | Why |
| --- | --- |
| Public GitHub repo (`fatimafortes/cruce`) | The professor must open the link to grade it. Raises the stakes on "no secrets in code": `.gitignore` was committed before any `.env` file existed. |
| First commit holds only `docs/` | The packet and implementation prompt existed before any app code, and the history shows it. |
| F1 committed on its own (`chore: scaffold Next.js app (F1)`) | The commit plan folds the scaffold into F2, but the ground rules say commit after each feature. One extra commit; the minimum is 5. |
| Next.js 16.4 (App Router, TypeScript), Tailwind 4, ESLint, no `src/` | `create-next-app@latest` defaults. No `src/` because the prompt places `lib/` and `supabase/` at the root. Next 16 renames middleware to `proxy.ts` (relevant in F2). |
| `.gitignore` ignores every `.env*` except `.env.example` | Next's default ignores `.env*`, which would also hide the example file. |
| `.env.example` lists the four variable names from the prompt, empty | The Supabase service-role key is not included: nothing needs it yet. Add it only if a server route truly must bypass RLS, and then only as a server-only variable. |
| Env checked with zod on first use (`lib/env.ts`, `lib/env.server.ts`), not at import | A missing variable gives a clear error, but `npm run build` passes before Supabase exists. Gemini variables live in a `server-only` file, so importing them into browser code fails the build. |
| Supabase via `@supabase/ssr`: `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server, cookie session) | Both use the anon key, so RLS always applies. No auth flow or tables yet (F2, F3). |
| Template README and SVG assets removed | Not part of Cruce; the README now points to the docs. |

## Tomorrow's first move

F2: manual setup of Supabase (project + Google provider + redirect URLs) and `.env.local`, then the Spanish landing page, Google sign-in/sign-out, and `proxy.ts` protecting `/sample`, `/proof`, `/review`.
