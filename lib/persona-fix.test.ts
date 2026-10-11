import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runChecks } from "@/lib/checks";
import {
  PROJECT_DATA_LINK,
  PUBLIC_PROOF_DESCRIPTION,
  PUBLIC_PROOF_TITLE,
  SHARE_SHEET_TITLE,
  STATE4_LABEL,
} from "@/lib/copy";
import { proofStates, statesFor, statesFromSummary } from "@/lib/states";

// Persona test (Lupita), worst issue: "empleador" and job wording read as
// "my boss will see this" or "this goes to a company"; she nearly quit and then
// chose not to share. These tests keep that from coming back.

const OK = "Hi Sarah, PO-48213, part BRK-2207-A: we shipped 800 of 1,200; the other 400 ship Nov 14. Thanks for your patience.";
const JOB_OR_BOSS = /empleador|vacante|prueba de trabajo|call center|contrat|postul/i;

const allCases = [
  null,
  { emailAnswer: OK, followupAnswer: null, ruleChecks: runChecks(OK, null) },
  { emailAnswer: OK, followupAnswer: null, ruleChecks: null },
  { emailAnswer: OK.replace("400", "500"), followupAnswer: null, ruleChecks: runChecks(OK.replace("400", "500"), null) },
  { emailAnswer: OK, followupAnswer: "x".repeat(40), ruleChecks: runChecks(OK, null), review: { explained: true } },
  { emailAnswer: OK, followupAnswer: "x".repeat(40), ruleChecks: runChecks(OK, null), review: { explained: false } },
];

describe("persona fix: no 'employer' reading", () => {
  it("no state label, in any case, says empleador or sounds like a job application", () => {
    for (const attempt of allCases) {
      for (const state of proofStates(attempt)) expect(state.label).not.toMatch(JOB_OR_BOSS);
    }
  });

  it("state 4 is about a plant, still empty, and makes no opportunity claim (C5)", () => {
    expect(STATE4_LABEL).toBe("Una planta aceptó esta prueba · ninguna planta se ha comprometido aún");
    const four = proofStates(allCases[1])[3];
    expect(four).toEqual({ key: 4, label: STATE4_LABEL, status: "empty" });
  });

  it("/sample shows states 1–3 only; the worker's /proof keeps all four (C3, C5)", () => {
    for (const attempt of allCases) {
      expect(statesFor("sample", proofStates(attempt)).map((s) => s.key)).toEqual([1, 2, 3]);
      expect(statesFor("proof", proofStates(attempt)).map((s) => s.key)).toEqual([1, 2, 3, 4]);
    }
  });

  it("the public link never shows state 4 ('nobody wants her', C1)", () => {
    for (const numbersOk of [true, false, null]) {
      for (const explained of [true, false, null]) {
        expect(statesFor("public", statesFromSummary({ exists: true, numbersOk, explained })).map((s) => s.key)).toEqual([1, 2, 3]);
      }
    }
  });

  it("public title, link preview, share sheet and footer link are neutral", () => {
    for (const text of [PUBLIC_PROOF_TITLE, PUBLIC_PROOF_DESCRIPTION, SHARE_SHEET_TITLE, PROJECT_DATA_LINK]) {
      expect(text).not.toMatch(JOB_OR_BOSS);
    }
  });

  it("the public page and landing use those texts (no hard-coded job wording left)", () => {
    const publicPage = readFileSync("app/p/[token]/page.tsx", "utf8");
    const landing = readFileSync("app/page.tsx", "utf8");
    const card = readFileSync("components/proof-card.tsx", "utf8");
    expect(publicPage).toContain("description: PUBLIC_PROOF_DESCRIPTION");
    expect(publicPage).toContain('statesFor("public"');
    expect(publicPage).not.toMatch(/Prueba de trabajo/);
    expect(landing).not.toMatch(/Conteo de vacantes/);
    expect(card).not.toMatch(/prueba de trabajo/i);
    expect(readFileSync("components/sample-flow.tsx", "utf8")).toContain('statesFor("sample"');
  });
});
