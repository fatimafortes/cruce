import "server-only";
import { NextResponse, type NextRequest } from "next/server";

export const MAX_BODY_BYTES = 32_000;

export function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

// Reads a small JSON body; returns undefined if it's too big or not JSON.
export async function readJson(request: NextRequest): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return undefined;
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
