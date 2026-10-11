import { allPassed, type RuleChecks } from "@/lib/checks";
import { STATE4_LABEL } from "@/lib/copy";

// The four states of the proof, in words, never a number (C1, C3).
// "done" = reached, "review" = neutral "look again", "pending" = not yet / a person decides,
// "empty" = nobody has committed (C5).

export type StateStatus = "done" | "review" | "pending" | "empty";
export type ProofState = { key: 1 | 2 | 3 | 4; label: string; status: StateStatus };

export type AttemptForStates = {
  emailAnswer: string | null;
  followupAnswer: string | null;
  ruleChecks: RuleChecks | null;
  // Set only by a human reviewer (F6). Nothing else decides state 3.
  review?: { explained: boolean } | null;
};

// What the states depend on. The public page (/p/[token]) gets exactly this
// from the database, so the worker's pages and the public page always agree.
export type StateSummary = {
  exists: boolean;
  numbersOk: boolean | null; // null = automatic checks unavailable
  explained: boolean | null; // null = no review yet
};

export function summarize(attempt: AttemptForStates | null): StateSummary {
  const exists = Boolean(attempt?.emailAnswer);
  return {
    exists,
    numbersOk: exists && attempt?.ruleChecks ? allPassed(attempt.ruleChecks) : null,
    explained: attempt?.review?.explained ?? null,
  };
}

export function proofStates(attempt: AttemptForStates | null): ProofState[] {
  return statesFromSummary(summarize(attempt));
}

export function statesFromSummary(summary: StateSummary): ProofState[] {
  let numbers: ProofState = { key: 2, label: "Números consistentes · pendiente", status: "pending" };
  if (summary.exists && summary.numbersOk === true) {
    numbers = { key: 2, label: "Números consistentes", status: "done" };
  } else if (summary.exists && summary.numbersOk === false) {
    numbers = { key: 2, label: "Revisa los números marcados", status: "review" };
  } else if (summary.exists) {
    numbers = { key: 2, label: "Números · revisión automática no disponible", status: "pending" };
  }

  return [
    summary.exists
      ? { key: 1, label: "Entregable existe", status: "done" }
      : { key: 1, label: "Entregable · todavía no lo envías", status: "pending" },
    numbers,
    explainedState(summary.explained),
    { key: 4, label: STATE4_LABEL, status: "empty" },
  ];
}

// State 3 comes only from the reviewer's decision. "Todavía no" is shown
// neutrally, like a flagged number: something to work on, not a grade.
function explainedState(explained: boolean | null): ProofState {
  if (explained === true) return { key: 3, label: "Explicó el cambio", status: "done" };
  if (explained === false) return { key: 3, label: "Explicó el cambio · todavía no", status: "review" };
  return { key: 3, label: "Explicó el cambio · lo decide una persona", status: "pending" };
}

// Where the states are shown. State 4 (C5: shown empty, no opportunity claim)
// stays on the worker's own record (/proof, PDF). It is left out on /sample,
// where it never changes and read as "my boss will see this", and on the public
// link, where "nobody has committed" reads as "nobody wants her" (C1).
// States 1–3 stay separate everywhere (C3).
export type StatesView = "sample" | "proof" | "public";

export function statesFor(view: StatesView, states: ProofState[]): ProofState[] {
  return view === "proof" ? states : states.filter((s) => s.key !== 4);
}
