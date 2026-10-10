import { afterEach, describe, expect, it, vi } from "vitest";
import { publicEnv } from "@/lib/env";

afterEach(() => vi.unstubAllEnvs());

const set = (key: string) => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", key);
};

describe("publicEnv key guard", () => {
  it("accepts a publishable key", () => {
    set("sb_publishable_abc123");
    expect(publicEnv().NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe("sb_publishable_abc123");
  });

  it.each([
    ["a legacy anon JWT (Bug 1)", "eyJhbGciOiJIUzI1NiJ9.e30.x"],
    ["a secret key", "sb_secret_abc123"],
    ["an empty value", ""],
  ])("rejects %s, naming the variable but not the value", (_label, key) => {
    set(key);
    expect(() => publicEnv()).toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    try {
      publicEnv();
    } catch (error) {
      if (key) expect((error as Error).message).not.toContain(key);
    }
  });
});
