import { describe, expect, it } from "vitest";
import { charCount, emailAnswerSchema, firstMessage, followupAnswerSchema, reviewBodySchema, task1BodySchema } from "@/lib/validation";

const msg = (schema: typeof emailAnswerSchema, value: unknown) => {
  const result = schema.safeParse(value);
  return result.success ? null : firstMessage(result.error);
};

describe("emailAnswerSchema", () => {
  it("blocks an empty answer with a clear message (test plan #2)", () => {
    expect(msg(emailAnswerSchema, "")).toBe("Escribe tu correo antes de enviarlo.");
    expect(msg(emailAnswerSchema, "   \n ")).toBe("Escribe tu correo antes de enviarlo.");
    expect(msg(emailAnswerSchema, undefined)).toBe("Escribe tu correo antes de enviarlo.");
  });

  it("blocks 5,000 characters; the limit is 3,000 (test plan #3)", () => {
    expect(msg(emailAnswerSchema, "a".repeat(5000))).toBe("Máximo 3,000 caracteres.");
    expect(msg(emailAnswerSchema, "a".repeat(3001))).toBe("Máximo 3,000 caracteres.");
  });

  it("accepts 80 to 3,000 characters", () => {
    expect(msg(emailAnswerSchema, "a".repeat(79))).toBe("Tu correo necesita al menos 80 caracteres.");
    expect(msg(emailAnswerSchema, "a".repeat(80))).toBeNull();
    expect(msg(emailAnswerSchema, "a".repeat(3000))).toBeNull();
  });

  it("trims before counting", () => {
    const result = emailAnswerSchema.safeParse(`  ${"a".repeat(80)}  `);
    expect(result.success && result.data).toBe("a".repeat(80));
  });

  it("counts characters like Postgres (emoji = 1)", () => {
    expect(charCount("👍")).toBe(1);
    expect(msg(emailAnswerSchema, "👍".repeat(3000))).toBeNull();
    expect(msg(emailAnswerSchema, "👍".repeat(79))).toBe("Tu correo necesita al menos 80 caracteres.");
  });
});

describe("followupAnswerSchema", () => {
  it("accepts 40 to 1,500 characters", () => {
    expect(msg(followupAnswerSchema, "a".repeat(39))).toBe("Tu respuesta necesita al menos 40 caracteres.");
    expect(msg(followupAnswerSchema, "a".repeat(40))).toBeNull();
    expect(msg(followupAnswerSchema, "a".repeat(1501))).toBe("Máximo 1,500 caracteres.");
  });
});

describe("task1BodySchema", () => {
  it("rejects unknown fields, so a client can't send rule_checks", () => {
    expect(task1BodySchema.safeParse({ emailAnswer: "a".repeat(80), rule_checks: {} }).success).toBe(false);
  });
});

describe("reviewBodySchema", () => {
  const id = "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c";
  const parse = (body: unknown) => {
    const result = reviewBodySchema.safeParse(body);
    return result.success ? null : firstMessage(result.error);
  };

  it("accepts sí with no note", () => {
    expect(parse({ attemptId: id, explained: true, note: "" })).toBeNull();
  });

  it("requires a note of at least 10 characters for todavía no", () => {
    expect(parse({ attemptId: id, explained: false, note: "   " })).toBe(
      "Si eliges «Todavía no», escribe una nota (al menos 10 caracteres) sobre qué falta.",
    );
    expect(parse({ attemptId: id, explained: false, note: "a".repeat(9) })).not.toBeNull();
    expect(parse({ attemptId: id, explained: false, note: "a".repeat(10) })).toBeNull();
  });

  it("caps the note at 500 characters", () => {
    expect(parse({ attemptId: id, explained: true, note: "a".repeat(500) })).toBeNull();
    expect(parse({ attemptId: id, explained: true, note: "a".repeat(501) })).toBe("Máximo 500 caracteres.");
  });

  it("requires a choice and a valid attempt id; rejects extra fields", () => {
    expect(parse({ attemptId: id, note: "" })).toBe("Elige «Sí» o «Todavía no».");
    expect(parse({ attemptId: "nope", explained: true, note: "" })).toBe("No encontramos esta muestra.");
    expect(parse({ attemptId: id, explained: true, note: "", reviewer_id: id })).not.toBeNull();
  });
});

describe("shareBodySchema", () => {
  const id = "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c";
  it("an empty display name becomes null; answers off by default must be sent explicitly", async () => {
    const { shareBodySchema } = await import("@/lib/validation");
    expect(shareBodySchema.parse({ attemptId: id, displayName: "   ", includeAnswers: false })).toEqual({
      attemptId: id,
      displayName: null,
      includeAnswers: false,
    });
    expect(shareBodySchema.safeParse({ attemptId: id, displayName: "" }).success).toBe(false);
  });
  it("caps the display name at 60 characters and rejects extra fields", async () => {
    const { shareBodySchema } = await import("@/lib/validation");
    expect(shareBodySchema.safeParse({ attemptId: id, displayName: "a".repeat(60), includeAnswers: true }).success).toBe(true);
    expect(shareBodySchema.safeParse({ attemptId: id, displayName: "a".repeat(61), includeAnswers: true }).success).toBe(false);
    expect(shareBodySchema.safeParse({ attemptId: id, displayName: "", includeAnswers: false, revoked: false }).success).toBe(false);
  });
});
