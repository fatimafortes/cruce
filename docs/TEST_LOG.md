# TEST LOG

Results of manual and automated tests. The full mechanical pass and persona test from `docs/PACKET.md` §12 are recorded here at the end of the build.

## Bug 1 — Google sign-in fails on production (F2), 2026-10-10

**Found by:** manual F2 acceptance test on https://cruce-wheat.vercel.app.

**Symptom:** sign-in worked on `http://localhost:3000`, but on production Google sign-in always ended at `/?error=auth`. Supabase did bring the browser back to `cruce-wheat.vercel.app`, so the failure was inside `/auth/callback`, which at the time logged nothing.

**Step 1 — diagnose (commit `c9b4ffa`, "fix: diagnose auth callback on production"):** `/auth/callback` logs one line per failure and adds `&reason=` to the redirect (`provider_error`, `missing_code`, `verifier_missing`, `exchange_failed`, `not_google`). It never logs the code, tokens or cookie names/values. Verified locally: every reason except `not_google` produced the right redirect and log line; the fake code and verifier never appeared in the server log.

**Production log after the retest:**

```
{reason: "exchange_failed", name: "AuthApiError", status: 401, message: "Invalid API key",
 flow_id_in_url: false, legacy_verifier_cookie: true, flow_slot_cookies: 3,
 matching_flow_slot_cookie: false, sb_cookie_count: 5}
```

**Root cause:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel held the legacy anon JWT (`eyJ…`, role `anon`; not a secret or `service_role` key), while `.env.local` held the publishable key (`sb_publishable_…`). The project most likely has its legacy JWT-based API keys disabled, so the legacy key is rejected. Supabase rejected the server's code exchange with `401 Invalid API key`. Starting sign-in in the browser still worked, which hid the problem until the callback.

**Contributing problem:** some attempts started on per-deployment URLs (`cruce-ow0r2hw7r-…`, `cruce-86oiqe2d0-…`) while the callback ran on `cruce-wheat.vercel.app`. `redirectTo` was built from the browser's current origin, so it pointed at a host missing from Supabase's Redirect URLs list, and the PKCE verifier cookies were saved on a different host from the one the callback ran on. `flow_id_in_url: false` matches this: the URL that came back wasn't the `redirectTo` we built.

**Fixes:**

1. Vercel: `NEXT_PUBLIC_SUPABASE_ANON_KEY` replaced with the publishable key and production redeployed (done by hand). `NEXT_PUBLIC_*` values are baked in at build time, so a redeploy is required.
2. `proxy.ts` + `lib/site.ts`: when `VERCEL_ENV=production` and the host isn't `cruce-wheat.vercel.app`, every request gets a 307 to the same path and query on `cruce-wheat.vercel.app` before anything else runs. Sign-in can only start, and finish, on the production host.
3. `/auth/callback` passes `sb_flow_id` to `exchangeCodeForSession(code, { flowId })`, so Supabase uses this attempt's own verifier cookie instead of the "most recent attempt" copy.

**Local verification of fixes 2–3** (production build; `VERCEL_ENV=production` simulated with a spoofed `Host` header):

| Request | Result |
| --- | --- |
| `GET /` on `cruce-ow0r2hw7r-team.vercel.app` | 307 → `https://cruce-wheat.vercel.app/` ✅ |
| `GET /sample?x=1` on `cruce-86oiqe2d0-team.vercel.app` | 307 → `https://cruce-wheat.vercel.app/sample?x=1` ✅ |
| `GET /auth/callback?...` on a deployment host | 307 → same path and query on `cruce-wheat.vercel.app` ✅ |
| `POST /auth/signout` on a deployment host | 307 (method kept) → `cruce-wheat.vercel.app` ✅ |
| `GET /` on `cruce-wheat.vercel.app` | 200, no redirect ✅ |
| Without `VERCEL_ENV` (local): `GET /`, any host | 200, no host redirect ✅ |
| Callback with `sb_flow_id` + that flow's verifier cookie | Verifier found; Supabase rejects the fake code (`flow_state_not_found`) ✅ |
| Callback with `sb_flow_id` but only the legacy cookie | `verifier_missing`: the library deliberately doesn't borrow another attempt's verifier ✅ |
| Callback without `sb_flow_id` + legacy cookie | Falls back to the legacy cookie, as before ✅ |
| Server log searched for the fake code/verifier values | Not found ✅ |

(In the local run, the signed-out redirect from `/sample` pointed at `localhost` because the local server builds it from its own URL; on Vercel it uses the real host.)

**Production retest, 2026-10-10** (commit `c0c1de8` deployed and Ready; fresh incognito window on https://cruce-wheat.vercel.app):

| Check | Result |
| --- | --- |
| Google sign-in lands on `/sample` | ✅ |
| Sign-out ("Salir") | ✅ |
| `/sample` redirects to the landing page when signed out | ✅ |
| A `cruce-<hash>-….vercel.app` URL moves to `cruce-wheat.vercel.app` | Not checked on production yet; verified locally only (table above) |

**Status: ✅ Resolved.** F2's "done when" is met: sign-in and sign-out work locally and on Vercel.

**Lesson:** with this Supabase project, use only the publishable key (`sb_publishable_…`) in `NEXT_PUBLIC_SUPABASE_ANON_KEY`, in `.env.local` and in Vercel. After changing any `NEXT_PUBLIC_*` value, redeploy.
