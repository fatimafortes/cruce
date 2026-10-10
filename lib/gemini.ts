import "server-only";
import { buildUserPrompt, parseSuggestion, RESPONSE_SCHEMA, SYSTEM_INSTRUCTION } from "@/lib/coach";
import { geminiEnv } from "@/lib/env.server";

export type SuggestionResult =
  | { ok: true; text: string }
  | {
      ok: false;
      reason: "missing_key" | "quota" | "timeout" | "http_error" | "blocked" | "bad_output" | "score_like" | "network";
      status?: number;
    };

const TIMEOUT_MS = 20_000;

// Asks Gemini for the 3-point coaching suggestion. Never throws: any problem
// becomes { ok: false, reason } so the attempt is saved anyway (test plan #10).
export async function suggestFeedback(
  emailAnswer: string,
  followupAnswer: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SuggestionResult> {
  let env;
  try {
    env = geminiEnv();
  } catch {
    return { ok: false, reason: "missing_key" };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      // The key goes in a header, never in the URL, so it can't end up in logs.
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: buildUserPrompt(emailAnswer, followupAnswer) }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const name = (error as Error).name;
    return { ok: false, reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network" };
  }

  if (res.status === 429) return { ok: false, reason: "quota", status: 429 };
  if (!res.ok) return { ok: false, reason: "http_error", status: res.status };

  let data: {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };
  try {
    data = await res.json();
  } catch {
    return { ok: false, reason: "bad_output" };
  }
  if (data.promptFeedback?.blockReason) return { ok: false, reason: "blocked" };
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) return { ok: false, reason: candidate?.finishReason === "SAFETY" ? "blocked" : "bad_output" };

  return parseSuggestion(text);
}
