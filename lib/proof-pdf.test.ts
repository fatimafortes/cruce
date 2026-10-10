import { describe, expect, it } from "vitest";
import { runChecks } from "@/lib/checks";
import { pdfSafe, proofPdfBlocks, proofPdfFileName } from "@/lib/proof-pdf";
import { proofStates } from "@/lib/states";

const EMAIL = "Hi Sarah, PO-48213, part BRK-2207-A: we shipped 800 of 1,200; the other 400 ship Nov 14. Thanks 👍";
const FOLLOW = "Line 3 restarted: 250 ship Nov 14, the remaining 150 ship Nov 19. Air freight needs approval.";
const attempt = { emailAnswer: EMAIL, followupAnswer: FOLLOW, ruleChecks: runChecks(EMAIL, FOLLOW), review: { explained: false } };

const blocks = proofPdfBlocks({
  dateLabel: "10 de octubre de 2026, 17:05",
  states: proofStates(attempt),
  ruleChecks: attempt.ruleChecks,
  emailAnswer: EMAIL,
  followupAnswer: FOLLOW,
  aiSuggestion: "Claridad: bien.\nTono en inglés: amable.\nFlete aéreo: no lo prometes.",
  review: { explained: false, note: "Falta explicar por qué no hay flete aéreo todavía." },
});
const all = blocks.map((b) => b.text).join("\n");

describe("proofPdfBlocks", () => {
  it("has the invented-data label, the four states in words and both labels", () => {
    expect(all).toContain("DATOS INVENTADOS · PLANTA FICTICIA");
    expect(all).toContain("1. Entregable existe (Sí)");
    expect(all).toContain("3. Explicó el cambio · todavía no (Revisa)");
    expect(all).toContain("4. Empleador aceptó · ningún empleador se ha comprometido aún (Vacío)");
    expect(all).toContain("Sugerencia de IA — no es una decisión");
    expect(all).toContain("no es una calificación");
  });

  it("includes the worker's answers, checks and the reviewer's note (it's her own copy)", () => {
    expect(all).toContain("Encontrado · Número de orden");
    expect(all).toContain("Falta explicar por qué no hay flete aéreo todavía.");
    expect(all).toContain("Line 3 restarted");
  });

  it("never contains an email address, a user id or a score", () => {
    expect(all).not.toMatch(/@|[0-9a-f]{8}-[0-9a-f]{4}-|\d+\s*\/\s*10\b|\d+\s*%/i);
  });

  it("replaces characters the PDF fonts can't draw, keeps Spanish letters", () => {
    expect(pdfSafe("Sí, ¿qué tal? ñ — 👍 ✓")).toBe("Sí, ¿qué tal? ñ — ? ?");
    expect(all).toContain("Thanks ?");
  });

  it("names the file by date", () => {
    expect(proofPdfFileName("2026-10-10T23:05:00Z")).toBe("cruce-prueba-2026-10-10.pdf");
  });
});
