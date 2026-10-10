import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { isGoogleUser, isProtectedPath, safeNextPath } from "@/lib/auth-rules";

const user = (fields: Record<string, unknown>) => fields as unknown as User;

describe("safeNextPath", () => {
  it.each([
    ["/proof", "/proof"],
    ["/sample?x=1", "/sample?x=1"],
    ["//evil.com", "/sample"],
    ["https://evil.com", "/sample"],
    ["/\\evil.com", "/sample"],
    ["javascript:alert(1)", "/sample"],
    [null, "/sample"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("isProtectedPath", () => {
  it.each([
    ["/sample", true],
    ["/review/x", true],
    ["/samples", false],
    ["/", false],
  ])("%s -> %s", (path, expected) => {
    expect(isProtectedPath(path)).toBe(expected);
  });
});

describe("isGoogleUser", () => {
  it("rejects anonymous users even with a google provider", () => {
    expect(isGoogleUser(user({ is_anonymous: true, app_metadata: { providers: ["google"] } }))).toBe(false);
  });
  it("rejects email-only users", () => {
    expect(isGoogleUser(user({ is_anonymous: false, app_metadata: { providers: ["email"] }, identities: [] }))).toBe(false);
  });
  it("accepts google via providers or identities", () => {
    expect(isGoogleUser(user({ is_anonymous: false, app_metadata: { providers: ["google"] } }))).toBe(true);
    expect(isGoogleUser(user({ app_metadata: {}, identities: [{ provider: "google" }] }))).toBe(true);
  });
  it("rejects no user", () => {
    expect(isGoogleUser(null)).toBe(false);
  });
});
