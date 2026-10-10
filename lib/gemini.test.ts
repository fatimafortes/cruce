import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { suggestFeedback } from "@/lib/gemini";

const POINTS = ["Claridad: se entiende la situación.", "Tono en inglés: profesional y amable.", "Flete aéreo: no lo prometes sin aprobación."];
const okBody = (text: string) => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] });
const respond = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

beforeEach(() => {
  vi.stubEnv("GEMINI_API_KEY", "test-key-not-real");
  vi.stubEnv("GEMINI_MODEL", "gemini-test");
});
afterEach(() => vi.unstubAllEnvs());

describe("suggestFeedback", () => {
  it("returns the 3 points and sends the key only in a header", async () => {
    const fetchMock = respond(200, okBody(JSON.stringify({ points: POINTS })));
    const result = await suggestFeedback("email", "follow-up", fetchMock as unknown as typeof fetch);
    expect(result).toEqual({ ok: true, text: POINTS.join("\n") });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent");
    expect(url).not.toContain("test-key-not-real");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key-not-real");
    const body = JSON.parse(init.body as string);
    expect(body.contents[0].parts[0].text).toContain("<<<WORKER_ANSWER>>>");
  });

  it("missing key → missing_key, no request made", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const fetchMock = vi.fn();
    expect(await suggestFeedback("e", "f", fetchMock as unknown as typeof fetch)).toEqual({ ok: false, reason: "missing_key" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("quota (429) → quota", async () => {
    expect(await suggestFeedback("e", "f", respond(429, { error: {} }) as unknown as typeof fetch)).toEqual({ ok: false, reason: "quota", status: 429 });
  });

  it("other HTTP errors → http_error with status", async () => {
    expect(await suggestFeedback("e", "f", respond(503, {}) as unknown as typeof fetch)).toEqual({ ok: false, reason: "http_error", status: 503 });
  });

  it("timeout → timeout", async () => {
    const fetchMock = vi.fn(async () => {
      throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
    });
    expect(await suggestFeedback("e", "f", fetchMock as unknown as typeof fetch)).toEqual({ ok: false, reason: "timeout" });
  });

  it("network failure → network", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await suggestFeedback("e", "f", fetchMock as unknown as typeof fetch)).toEqual({ ok: false, reason: "network" });
  });

  it("blocked prompt → blocked", async () => {
    expect(await suggestFeedback("e", "f", respond(200, { promptFeedback: { blockReason: "SAFETY" } }) as unknown as typeof fetch)).toEqual({ ok: false, reason: "blocked" });
  });

  it("invalid JSON from the model → bad_output", async () => {
    expect(await suggestFeedback("e", "f", respond(200, okBody("not json")) as unknown as typeof fetch)).toEqual({ ok: false, reason: "bad_output" });
  });

  it("a score in the output → score_like (never shown)", async () => {
    const scored = JSON.stringify({ points: [POINTS[0], POINTS[1], "Flete aéreo: perfecto, 10/10."] });
    expect(await suggestFeedback("e", "f", respond(200, okBody(scored)) as unknown as typeof fetch)).toEqual({ ok: false, reason: "score_like" });
  });
});
