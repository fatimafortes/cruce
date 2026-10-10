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

**Found while reading `@supabase/auth-js`:** this version keeps the verifier in a per-attempt cookie (keyed by a flow id that the browser adds to `redirectTo` as `sb_flow_id`) and also in a legacy fixed cookie that mirrors the most recent attempt. On the server, `exchangeCodeForSession(code)` only uses the flow id if it is passed explicitly, so our callback read the legacy cookie.

**Step 2, root cause and fixes** (full record in `docs/TEST_LOG.md`, Bug 1):

| Decision | Why |
| --- | --- |
| Root cause: Vercel had the legacy anon JWT (`eyJ…`) in `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`401 Invalid API key` on the code exchange). Replaced with the publishable key and redeployed. **Resolved 2026-10-10**: sign-in, sign-out and the signed-out redirect pass on production | `.env.local` had the publishable key, so localhost worked. The project most likely has legacy JWT keys disabled: use only `sb_publishable_…`. Not a secret key, so nothing to rotate. `NEXT_PUBLIC_*` values are baked in at build time, so every change needs a redeploy. |
| In production, `proxy.ts` sends any host other than `cruce-wheat.vercel.app` to the same path there (307), before anything else | Some attempts started on per-deployment URLs. `redirectTo` comes from the browser's current origin, and PKCE cookies are per host, so sign-in must start and end on the one host in Supabase's allow-list. Detected with `VERCEL_ENV=production`, which Vercel sets for production deployment URLs too. The host lives in `lib/site.ts`. |
| `redirectTo` stays built from `window.location.origin` | After the proxy redirect, that origin is always the production host in production and `localhost:3000` locally. Hard-coding the production URL in the button would break localhost and wouldn't fix cookies saved on the wrong host. |
| The callback passes `sb_flow_id` as `flowId` to `exchangeCodeForSession` | Uses this attempt's own verifier. With a flow id, the library deliberately won't fall back to another attempt's verifier; without one, it still reads the legacy cookie. |
| Preview deployments (`VERCEL_ENV=preview`) are not redirected | Previews exist to test new code. Sign-in there isn't supported (not in the allow-list). |
| Diagnostic logging in `/auth/callback` stays | It found this bug in one retest and logs nothing secret. |

## 2026-10-10 — F3: schema with RLS

Migration: `supabase/migrations/20261010150000_cruce_schema.sql`, applied by hand in the SQL Editor (no Supabase CLI link to the shared project). Test: `supabase/tests/cruce_rls_test.sql`. **Applied and tested in Supabase on 2026-10-10: 36/36 PASS** (`docs/TEST_LOG.md`). Owner added to `cruce_reviewers`.

| Decision | Why |
| --- | --- |
| The migration creates only `cruce_*` objects (5 tables, 4 functions, 13 policies, 2 triggers) and never drops anything; one transaction | Shared semester project. A second run fails on the first `create` and applies nothing. |
| Google-only enforced in the database too: every policy goes through `cruce_is_google_user()` (JWT: not anonymous, `google` among `app_metadata.providers`) | The project allows anonymous and email sign-ins, and the publishable key is public, so someone could call the API directly. Security floor 2. |
| Workers can write only `email_answer` (insert) and `followup_answer` (update); `rule_checks` and `ai_suggestion` are written server-side with a **Cruce-only secret key** (`cruce-server`, created in F4) | Otherwise a worker could forge "all checks passed" or the AI suggestion (C3). A dedicated key can be revoked without affecting other weeks' apps. It goes only in `.env.local` and in Vercel as Sensitive, never in chat. |
| The follow-up can be written once; the email answer can't be edited after insert | Checks, the AI suggestion and the review must refer to the text the worker actually submitted. |
| Workers can delete their own attempts; reviews and share links go with them | C2: the proof belongs to the worker. |
| Reviewers read attempts only through `cruce_review_queue()` (security definer), which returns no `user_id`, name or email and leaves out the reviewer's own attempts | Packet: "reviewer reads, without the worker's name". Reviewers also can't review their own attempts. |
| Share-link tokens: 64 hex characters from two random UUIDs, generated by the database; revoking is one-way | Prompt asks for 32+ random characters. No `pgcrypto` dependency. Un-revoking would let a worker's "revoke" be undone silently. |
| `cruce_reviewers` is readable only for your own row; nobody writes it through the API | Reviewers are added by hand in the SQL Editor. |
| Supabase's default grants to `anon`/`authenticated` are revoked on `cruce_*` tables and functions, then re-granted per column | RLS limits rows; column grants limit which fields each role can write. |
| DB length limits match the forms: email 80–3,000, follow-up 40–1,500, review note ≤ 500 | Security floor 4, enforced again in the database. |
| Test = one `DO` block that raises an error at the end with the PASS/FAIL report | The error forces a rollback whatever the SQL Editor does with transactions, so the five temporary test users and their rows are never saved. |

## 2026-10-10 — F4: sample flow and rule checks

| Decision | Why |
| --- | --- |
| Secret key `cruce_server` (Supabase doesn't allow hyphens in key names) in `SUPABASE_SECRET_KEY`: `.env.local` and Vercel **Production only**, Secret/Sensitive | Cruce-only, so it can be revoked without touching other weeks. Previews run branch code and don't get it. |
| The secret key is used only in `lib/supabase/admin.ts`, which exports one function, `saveRuleChecks()`; the client itself is never exported | It bypasses RLS across the whole shared project. |
| Answers are saved **as the worker** (RLS checks ownership; the follow-up locks after one write). Then the server runs `lib/checks.ts` and writes only `rule_checks` with the secret key | Workers can't forge checks (C3). |
| On task 2, all checks are re-run from the stored text | Deterministic, so the result is the same, and it repairs task-1 checks if they couldn't be saved the first time. |
| If the secret key is missing or wrong, the attempt is still saved and the screen says "La revisión automática no está disponible ahora" | Test plan #10, same spirit as for Gemini. |
| Key guards: `NEXT_PUBLIC_SUPABASE_ANON_KEY` must start with `sb_publishable_`; `SUPABASE_SECRET_KEY` with `sb_secret_`. Errors name the variable, never the value | Bug 1 lesson (legacy JWT), and above all prevents a secret key in a public variable. |
| Gemini variables are checked separately (`geminiEnv()`) | A missing Gemini key must not stop the rule checks (F5). |
| Checks: PO (`PO-48213`/`48213`), part `BRK-2207-A` (exact), 800, 400, Nov 14 in "Nov 14", "Nov. 14", "November 14(th)", "14 Nov", "14th of November", "11/14"; task 2: 250, 150, Nov 19. Any other number 100–2,000 is flagged (task 1 allows 800/400/1,200; task 2 also 250/150) | As in the prompt; task-2 allowed numbers confirmed by the owner. PO, part numbers and dates are never read as quantities. |
| Check wording is neutral: found / "No encontramos…" / "Revisa: 500 no aparece en la orden." No red, no score; heading "Revisión automática de números — no es una calificación" | C1, and the persona (Lupita quits when a screen looks like a test she might fail). |
| The four states on `/sample` reflect **this attempt**: "Entregable existe" once saved; "Números consistentes" only when every check passes, otherwise the neutral "Revisa los números marcados"; states 3 and 4 always pending/empty | Owner's change to the mockup (always-green chips would misstate the proof). |
| zod validation shared by the forms and the API, counting characters like Postgres (`char_length`), trimmed; unknown fields rejected | Security floor 4; the form, API and DB constraint agree, and a client can't send `rule_checks`. |
| API routes: `POST /api/attempts`, `POST /api/attempts/[id]/followup`; 401 signed out, 400 invalid, 409 for "not yours / missing / already answered" (one answer for all three) | Doesn't reveal whether someone else's attempt exists. |
| `/sample` resumes the worker's latest attempt; "Empezar una muestra nueva" starts another | Reloading on a phone doesn't lose work. |
| Tests with Vitest 5.0.3 (`npm test`); `@types/node` raised to ^24 | Vitest 5 needs Node types ≥ 22; local Node is 24. Types only. |
| `.env.local`: the secret key had been pasted onto the end of the `GEMINI_MODEL` line; split into two lines (no values shown) | Otherwise `GEMINI_MODEL` would have carried the secret key and in F5 sent it to Google. |

## Tomorrow's first move

Finish F4: manual run on localhost and on Vercel (`docs/TEST_LOG.md`, F4). Then F5: Gemini suggestion (server only, labeled, never decides) and the 5-attempts-per-day limit. Before F5: the new Gemini key in `.env.local`, then in Vercel (Production, Sensitive).
