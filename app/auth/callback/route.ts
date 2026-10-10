import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isGoogleUser, safeNextPath } from "@/lib/auth-rules";

type FailReason =
  | "provider_error"
  | "missing_code"
  | "verifier_missing"
  | "exchange_failed"
  | "not_google";

// Google → Supabase → here with ?code=. Exchange it for a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  // The browser adds sb_flow_id to redirectTo. Passing it makes Supabase use
  // this attempt's own verifier cookie instead of the "most recent attempt" copy.
  const flowId = searchParams.get("sb_flow_id");
  const pkce = pkceCookieFacts(request, flowId);

  // Supabase sends these instead of ?code= when Google or Supabase refused the sign-in.
  const providerError = searchParams.get("error");
  if (providerError) {
    return fail(origin, "provider_error", {
      error: clip(providerError),
      error_code: clip(searchParams.get("error_code")),
      error_description: clip(searchParams.get("error_description")),
      ...pkce,
    });
  }

  if (!code) {
    return fail(origin, "missing_code", pkce);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );

  if (error) {
    const reason =
      error.name === "AuthPKCECodeVerifierMissingError" ? "verifier_missing" : "exchange_failed";
    return fail(origin, reason, {
      name: error.name,
      code: error.code,
      status: error.status,
      message: clip(error.message),
      ...pkce,
    });
  }

  const user = data.user;
  if (!isGoogleUser(user)) {
    return fail(origin, "not_google", {
      is_anonymous: data.user?.is_anonymous ?? null,
      providers: data.user?.app_metadata?.providers ?? null,
    });
  }

  return NextResponse.redirect(new URL(next, origin));
}

function fail(origin: string, reason: FailReason, details: Record<string, unknown>) {
  // Server log only (Vercel → Logs). Never the auth code, tokens or cookie values.
  console.error("[auth/callback] sign-in failed", JSON.stringify({ reason, ...details }));
  const url = new URL("/", origin);
  url.searchParams.set("error", "auth");
  url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

// Which PKCE verifier cookies arrived, as yes/no facts and counts: no names or values.
function pkceCookieFacts(request: NextRequest, flowId: string | null) {
  const names = request.cookies.getAll().map((cookie) => cookie.name);
  const base = (name: string) => name.replace(/\.\d+$/, ""); // @supabase/ssr chunks as name.0, name.1
  return {
    flow_id_in_url: flowId !== null,
    legacy_verifier_cookie: names.some((name) => /^sb-.+-auth-token-code-verifier$/.test(base(name))),
    flow_slot_cookies: new Set(
      names.map(base).filter((name) => /^sb-.+-auth-token-flow-[0-9a-f]+-code-verifier$/.test(name)),
    ).size,
    matching_flow_slot_cookie:
      flowId !== null &&
      names.some((name) => base(name).endsWith(`-auth-token-flow-${flowId}-code-verifier`)),
    sb_cookie_count: names.filter((name) => name.startsWith("sb-")).length,
  };
}

function clip(value: string | null | undefined): string | null {
  return value ? value.slice(0, 200) : null;
}
