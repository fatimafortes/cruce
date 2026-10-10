// The one production address. Supabase's Redirect URLs allow-list contains
// only this host (plus localhost), and auth cookies are per host, so every
// production request is moved here before sign-in can start.
export const PRODUCTION_HOST = "cruce-wheat.vercel.app";

// Vercel sets VERCEL_ENV on the server: "production" also covers the
// per-deployment URLs (cruce-<hash>-….vercel.app) of production builds.
export function productionRedirectUrl(
  host: string | null,
  pathAndQuery: string,
  vercelEnv = process.env.VERCEL_ENV,
): URL | null {
  if (vercelEnv !== "production") return null;
  if (host?.toLowerCase() === PRODUCTION_HOST) return null;
  return new URL(pathAndQuery, `https://${PRODUCTION_HOST}`);
}
