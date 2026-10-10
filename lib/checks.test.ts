import { describe, expect, it } from "vitest";
import { allPassed, checkTask1, checkTask2, quantitiesIn, runChecks } from "@/lib/checks";

const CORRECT_EMAIL =
  "Hi Sarah, I'm writing about PO-48213 for part BRK-2207-A. We shipped 800 of the 1,200 units. " +
  "Line 3 is down, so the remaining 400 will ship on Nov 14. I'll confirm tracking as soon as they leave.";

const CORRECT_FOLLOWUP =
  "Good news: Line 3 restarted. 250 units ship Nov 14 and the remaining 150 ship Nov 19. " +
  "I can't promise air freight for all 400 yet, because it needs your account manager's approval. " +
  "I'll ask today and tell you the cost.";

const failed = (checks: { item: string; passed: boolean }[]) =>
  checks.filter((c) => !c.passed).map((c) => c.item);

describe("checkTask1", () => {
  it("passes every check for a correct email (test plan #4)", () => {
    const checks = checkTask1(CORRECT_EMAIL);
    expect(failed(checks)).toEqual([]);
    expect(checks).toHaveLength(6);
  });

  it("flags 500 instead of 400 (test plan #5)", () => {
    const checks = checkTask1(CORRECT_EMAIL.replace("400", "500"));
    expect(failed(checks)).toEqual(["Cantidad pendiente", "Cantidades que no coinciden"]);
    const flag = checks.find((c) => c.item === "Cantidades que no coinciden");
    expect(flag?.detail).toBe("Revisa: 500 no aparece en la orden.");
  });

  it("lists several unexpected quantities once each", () => {
    const flag = checkTask1(`${CORRECT_EMAIL} Maybe 500 or 1,500? I said 500.`).find(
      (c) => c.item === "Cantidades que no coinciden",
    );
    expect(flag?.passed).toBe(false);
    expect(flag?.detail).toBe("Revisa: 500, 1,500 no aparecen en la orden.");
  });

  it.each(["PO-48213", "PO 48213", "PO#48213", "po-48213", "order 48213"])("accepts the PO as %s", (po) => {
    const checks = checkTask1(CORRECT_EMAIL.replace("PO-48213", po));
    expect(checks.find((c) => c.item === "Número de orden")?.passed).toBe(true);
  });

  it("does not accept a different PO", () => {
    const checks = checkTask1(CORRECT_EMAIL.replace("PO-48213", "PO-48231"));
    expect(checks.find((c) => c.item === "Número de orden")?.passed).toBe(false);
  });

  it("requires the exact part number", () => {
    const checks = checkTask1(CORRECT_EMAIL.replace("BRK-2207-A", "BRK-2207"));
    expect(checks.find((c) => c.item === "Número de parte")?.passed).toBe(false);
  });

  it.each(["Nov 14", "Nov. 14", "November 14", "November 14th", "14 Nov", "14th of November", "11/14", "11/14/2026"])(
    "accepts the date as %s",
    (date) => {
      const checks = checkTask1(CORRECT_EMAIL.replace("Nov 14", date));
      expect(checks.find((c) => c.item === "Nueva fecha de envío")?.passed).toBe(true);
    },
  );

  it.each(["Nov 4", "Nov 141", "Dec 14", "11/15", "14 Dec"])("does not accept %s as the new date", (date) => {
    const checks = checkTask1(CORRECT_EMAIL.replace("Nov 14", date));
    expect(checks.find((c) => c.item === "Nueva fecha de envío")?.passed).toBe(false);
  });

  it("does not treat the PO, part number or date as quantities", () => {
    expect(quantitiesIn("PO-48213, BRK-2207-A, 11/14, Line 3, 1,200 and 800.")).toEqual([3, 1200, 800]);
  });

  it("finds nothing in an empty-looking answer", () => {
    expect(failed(checkTask1("Hello Sarah, there is a delay. Sorry about that, we will update you soon."))).toEqual([
      "Número de orden",
      "Número de parte",
      "Cantidad enviada",
      "Cantidad pendiente",
      "Nueva fecha de envío",
    ]);
  });
});

describe("checkTask2", () => {
  it("passes every check for a correct follow-up", () => {
    expect(failed(checkTask2(CORRECT_FOLLOWUP))).toEqual([]);
  });

  it("allows 250 and 150 (and the order's own quantities) in task 2", () => {
    const flag = checkTask2(CORRECT_FOLLOWUP).find((c) => c.item === "Cantidades que no coinciden");
    expect(flag?.passed).toBe(true);
  });

  it("flags a wrong split", () => {
    expect(failed(checkTask2(CORRECT_FOLLOWUP.replace("150", "200")))).toEqual([
      "Segundo envío",
      "Cantidades que no coinciden",
    ]);
  });

  it("requires Nov 19", () => {
    expect(failed(checkTask2(CORRECT_FOLLOWUP.replace("Nov 19", "Nov 18")))).toEqual(["Fecha del segundo envío"]);
  });
});

describe("runChecks / allPassed", () => {
  it("is all passed only when both tasks pass", () => {
    expect(allPassed(runChecks(CORRECT_EMAIL, null))).toBe(true);
    expect(allPassed(runChecks(CORRECT_EMAIL, CORRECT_FOLLOWUP))).toBe(true);
    expect(allPassed(runChecks(CORRECT_EMAIL, CORRECT_FOLLOWUP.replace("150", "200")))).toBe(false);
  });

  it("never returns a number or score", () => {
    const json = JSON.stringify(runChecks(CORRECT_EMAIL, CORRECT_FOLLOWUP));
    expect(json).not.toMatch(/score|puntaje|calificaci|%/i);
  });
});
