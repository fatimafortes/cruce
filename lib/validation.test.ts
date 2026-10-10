import { describe, expect, it } from "vitest";
import { charCount, emailAnswerSchema, firstMessage, followupAnswerSchema, task1BodySchema } from "@/lib/validation";

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
