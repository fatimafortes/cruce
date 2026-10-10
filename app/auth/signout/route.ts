import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST only: a GET link could be prefetched and sign people out by accident.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
}
