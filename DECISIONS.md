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

## 2026-10-10 — Deploy 1 (earlier than planned)

| Decision | Why |
| --- | --- |
| Deploy 1 done after F1, not after F2 | The repo was imported into Vercel right after the F1 push. Live URL: https://cruce-wheat.vercel.app (serves the F1 placeholder, so the build works on Vercel). The commit plan still has its later deploys; this one just came earlier. |
| Skipped Vercel's Supabase integration | Supabase is set up by hand in F2, so we control exactly which variables reach Vercel and no service-role key is added automatically. |
| No env vars in Vercel yet | F1 needs none: env is checked on first use, not at build. They are added in F2. |

## 2026-10-10 — F2 setup: shared Supabase project

| Decision | Why |
| --- | --- |
| Use the existing semester Supabase project, not a new one | The professor requires it. Other weeks' apps share its database and auth settings. |
| Every Cruce table is prefixed `cruce_` (`cruce_attempts`, `cruce_reviews`, `cruce_proof_links`, `cruce_reviewers`, `cruce_gate_snapshots`) | Keeps Cruce apart from earlier weeks' tables. Migrations create, alter and grant only `cruce_*` objects and never drop or touch anything else. This renames the tables in the packet and the prompt; their columns and rules stay the same. |
| Site URL left unchanged; only `https://cruce-wheat.vercel.app/**` added to Redirect URLs | Other weeks' apps rely on the Site URL. Because Supabase falls back to the Site URL when a redirect isn't allowed, Cruce always passes `redirectTo` explicitly, built from the request's own origin. |
| Google provider was already enabled in the project | Checked through the public `/auth/v1/settings` endpoint. No new Google OAuth client. The Google consent screen shows whatever app name that existing client has. |
| Anonymous sign-ins and email sign-in are enabled at the project level and stay on | Other weeks may use them. An anonymous user still gets the `authenticated` role, so Cruce cannot rely on "signed in" alone: the app checks for a Google identity before storing anything, and F3's RLS policies also require `(auth.jwt() ->> 'is_anonymous')::boolean is not true`. Security floor 2. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` holds the new publishable key (`sb_publishable_…`) | The publishable key works the same as the legacy anon key with `supabase-js`; the variable keeps the name from the implementation prompt. |
| A Gemini key was pasted into the chat during setup; it is being replaced | Treated as exposed. The new key goes only into `.env.local` (and into Vercel in F5). It was never in the repo. |

## 2026-10-10 — F2: auth and landing

| Decision | Why |
| --- | --- |
| One rule for "signed in": Supabase verifies the session (`getUser()`) **and** the account has a Google identity (`lib/auth-rules.ts`, `lib/auth.ts`) | The shared project also allows anonymous and email sign-ins. Anonymous or email-only sessions count as signed out everywhere in Cruce. |
| `proxy.ts` refreshes the session cookie and redirects signed-out visitors from `/sample`, `/proof`, `/review` to `/?next=<path>`; each page checks again | Next's docs advise against relying on the proxy alone. |
| Sign-in passes `redirectTo = <current origin>/auth/callback?next=…` | The Site URL belongs to another app. Works on localhost and on the Vercel URL; Vercel preview URLs are not on the allow-list, so sign-in there would fall back to the Site URL. Test sign-in only on production and localhost. |
| `next` accepts only same-site paths; anything else becomes `/sample` | Prevents an open redirect through `/?next=` or `/auth/callback?next=`. |
| Sign-out is `POST /auth/signout` (GET returns 405) | Next prefetches links; a GET sign-out link could sign people out without a click. Supabase's cookies are `SameSite=Lax`, so another site can't trigger the POST with them. |
| Session reads sit inside `<Suspense>`; the landing text and button area render instantly | Required with Cache Components (on by default in Next 16); a top-level `cookies()` read fails the build. |
| Light theme only; dropped the template's dark-mode colors | The mockup is light, and the fixed colors clashed with the template's dark background. |
| Landing adds: "Es una práctica con datos inventados de una planta ficticia. No es una vacante ni un examen." | So nobody mistakes Cruce for a job application or a test (C1, persona test). |
| `/review` checks sign-in only for now | The reviewers-only check comes in F6, with the `cruce_reviewers` table from F3. |

**Tested (local production build, signed out):** `/sample`, `/proof`, `/review` → 307 to `/?next=…`; `/` → 200 with the landing text and "Entrar con Google"; `/?error=auth` shows the Spanish error; `/auth/callback` without a valid code → `/?error=auth`; `GET /auth/signout` → 405, `POST` → 303 to `/`. Ad-hoc checks of `safeNextPath` (rejects `//evil.com`, `https://evil.com`, `/\evil.com`, `javascript:`), `isGoogleUser` (rejects anonymous and email-only users) and `isProtectedPath`: 16/16 passed. These move into the unit tests when the test runner is added in F4.
**Not verifiable by me:** a real Google sign-in. Supabase's OAuth `state` is opaque, so the Redirect URLs allow-list can only be confirmed by signing in.

## 2026-10-10 — Bug: Google sign-in fails on production only

**Symptom:** on https://cruce-wheat.vercel.app (fresh incognito window, started there) Google sign-in always ends at `/?error=auth`. It works on localhost. Supabase does send the browser back to `cruce-wheat.vercel.app`, so the Redirect URLs allow-list accepts it and the failure is inside `/auth/callback`.

**Step 1, diagnose before changing behavior:** `/auth/callback` now logs one line per failure (`[auth/callback] sign-in failed {…}` in Vercel → Logs) and adds `&reason=` to the redirect:

| `reason` | Meaning |
| --- | --- |
| `provider_error` | Supabase or Google refused; the log includes Supabase's `error`, `error_code`, `error_description`. |
| `missing_code` | Came back without `?code=`. |
| `verifier_missing` | The PKCE code verifier cookie wasn't readable on the server. |
| `exchange_failed` | Supabase rejected the exchange; the log includes the error name, code, status and message. |
| `not_google` | Signed in, but not with a Google identity. |

The log also records yes/no facts about the PKCE cookies that arrived (`legacy_verifier_cookie`, `flow_slot_cookies`, `matching_flow_slot_cookie`, `flow_id_in_url`, `sb_cookie_count`). It never logs the auth code, tokens, cookie names or cookie values. Tested locally: each reason except `not_google` (needs a real non-Google account) produced the right redirect and log line, and a search of the server log for the fake code and verifier values found nothing.

**Found while reading `@supabase/auth-js`:** this version keeps the verifier in a per-attempt cookie (keyed by a flow id that the browser adds to `redirectTo` as `sb_flow_id`) and also in a legacy fixed cookie that mirrors the most recent attempt. On the server, `exchangeCodeForSession(code)` only uses the flow id if it is passed explicitly, so our callback reads the legacy cookie. Not fixed yet; waiting on the production log.

## Tomorrow's first move

Confirm F2 by hand: Google sign-in and sign-out on `http://localhost:3000` and on https://cruce-wheat.vercel.app (after a sign-in, you should land on `/sample`, not on another app). Then F3: the `cruce_*` schema with RLS (policies reject anonymous sessions) and the worker-A-vs-worker-B test.
