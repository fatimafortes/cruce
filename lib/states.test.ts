import { describe, expect, it } from "vitest";
import { runChecks } from "@/lib/checks";
import { proofStates } from "@/lib/states";

const OK = "Hi Sarah, PO-48213, part BRK-2207-A: we shipped 800 of 1,200; the other 400 ship Nov 14. Thanks for your patience.";

describe("proofStates", () => {
  it("before any attempt: nothing is shown as reached", () => {
    expect(proofStates(null).map((s) => s.status)).toEqual(["pending", "pending", "pending", "empty"]);
  });

  it("all checks passed: states 1 and 2 reached, 3 and 4 still open", () => {
    const states = proofStates({ emailAnswer: OK, followupAnswer: null, ruleChecks: runChecks(OK, null) });
    expect(states.map((s) => [s.label, s.status])).toEqual([
      ["Entregable existe", "done"],
      ["Números consistentes", "done"],
      ["Explicó el cambio · lo decide una persona", "pending"],
      ["Empleador aceptó · ningún empleador se ha comprometido aún", "empty"],
    ]);
  });

  it("a flagged number shows neutrally, never as a grade", () => {
    const wrong = OK.replace("400", "500");
    const [, numbers] = proofStates({ emailAnswer: wrong, followupAnswer: null, ruleChecks: runChecks(wrong, null) });
    expect(numbers).toEqual({ key: 2, label: "Revisa los números marcados", status: "review" });
  });

  it("checks unavailable: state 2 stays pending, not failed", () => {
    const [, numbers] = proofStates({ emailAnswer: OK, followupAnswer: null, ruleChecks: null });
    expect(numbers.status).toBe("pending");
  });

  it("never contains a number-as-grade", () => {
    const text = JSON.stringify(proofStates({ emailAnswer: OK, followupAnswer: null, ruleChecks: runChecks(OK, null) }));
    expect(text).not.toMatch(/\d+\s*(%|\/\s*\d)|score|puntaje|calificaci/i);
  });
});
