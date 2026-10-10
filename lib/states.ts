import { allPassed, type RuleChecks } from "@/lib/checks";

// The four states of the proof, in words, never a number (C1, C3).
// "done" = reached, "review" = neutral "look again", "pending" = not yet / a person decides,
// "empty" = nobody has committed (C5).

export type StateStatus = "done" | "review" | "pending" | "empty";
export type ProofState = { key: 1 | 2 | 3 | 4; label: string; status: StateStatus };

export type AttemptForStates = {
  emailAnswer: string | null;
  followupAnswer: string | null;
  ruleChecks: RuleChecks | null;
};

export function proofStates(attempt: AttemptForStates | null): ProofState[] {
  const exists = Boolean(attempt?.emailAnswer);

  let numbers: ProofState = { key: 2, label: "Números consistentes · pendiente", status: "pending" };
  if (exists && attempt?.ruleChecks) {
    numbers = allPassed(attempt.ruleChecks)
      ? { key: 2, label: "Números consistentes", status: "done" }
      : { key: 2, label: "Revisa los números marcados", status: "review" };
  } else if (exists) {
    numbers = { key: 2, label: "Números · revisión automática no disponible", status: "pending" };
  }

  return [
    exists
      ? { key: 1, label: "Entregable existe", status: "done" }
      : { key: 1, label: "Entregable · todavía no lo envías", status: "pending" },
    numbers,
    { key: 3, label: "Explicó el cambio · lo decide una persona", status: "pending" },
    { key: 4, label: "Empleador aceptó · ningún empleador se ha comprometido aún", status: "empty" },
  ];
}
