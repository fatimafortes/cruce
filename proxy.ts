import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { isGoogleUser, isProtectedPath, signInPath } from "@/lib/auth-rules";
import { productionRedirectUrl } from "@/lib/site";

// Moves production traffic to the one production host, refreshes the Supabase
// session cookie on every page request, and sends signed-out visitors away
// from protected pages. Pages check again on their own.
export async function proxy(request: NextRequest) {
  // Before anything else: sign-in must start and end on the same host.
  const canonical = productionRedirectUrl(
    request.headers.get("host"),
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  if (canonical) return NextResponse.redirect(canonical, 307);

  const env = publicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Don't put code between createServerClient and getUser(): it refreshes the session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  if (isProtectedPath(pathname) && !isGoogleUser(user)) {
    const redirect = NextResponse.redirect(
      new URL(signInPath(`${pathname}${search}`), request.url),
    );
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
