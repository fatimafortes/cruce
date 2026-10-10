"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignInButton({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    setPending(true);
    setFailed(false);
    // The shared project's Site URL belongs to another app, so always say
    // exactly where to come back to. Must be on Supabase's Redirect URLs list.
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", next);

    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });
    if (error) {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-lg font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
      >
        {pending ? "Abriendo Google…" : "Entrar con Google"}
      </button>
      {failed && (
        <p role="alert" className="text-sm text-red-700">
          No pudimos abrir Google. Inténtalo de nuevo.
        </p>
      )}
    </div>
  );
}
