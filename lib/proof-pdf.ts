import type { Check, RuleChecks } from "@/lib/checks";
import { suggestionPoints } from "@/lib/coach";
import { INVENTED_LABEL } from "@/lib/sample";
import type { ProofState } from "@/lib/states";

// The worker's own copy of a proof (C2), as plain blocks that the browser
// turns into a PDF with jsPDF. Pure, so it is unit-tested. No name, no email.

export type PdfBlock = { kind: "title" | "label" | "heading" | "text" | "small"; text: string };

export type ProofForPdf = {
  dateLabel: string;
  states: ProofState[];
  ruleChecks: RuleChecks | null;
  emailAnswer: string;
  followupAnswer: string | null;
  aiSuggestion: string | null;
  review: { explained: boolean; note: string } | null;
};

const STATUS_WORD: Record<ProofState["status"], string> = {
  done: "Sí",
  review: "Revisa",
  pending: "Pendiente",
  empty: "Vacío",
};

// jsPDF's built-in fonts use WinAnsi: Spanish letters are fine, emoji and ✓ are not.
const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
export function pdfSafe(text: string): string {
  return [...text]
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      if (ch === "\n" || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.includes(ch)) {
        return ch;
      }
      return "?";
    })
    .join("");
}

function checkLines(checks: Check[]): PdfBlock[] {
  return checks.map((c) => ({ kind: "text", text: `${c.passed ? "Encontrado" : "Revisa"} · ${c.item}: ${c.detail}` }));
}

export function proofPdfBlocks(proof: ProofForPdf): PdfBlock[] {
  const blocks: PdfBlock[] = [
    { kind: "title", text: "Cruce · Prueba de trabajo" },
    { kind: "label", text: INVENTED_LABEL },
    { kind: "small", text: `Muestra del ${proof.dateLabel}. Esta prueba es tuya: no es una calificación ni un examen.` },
    { kind: "heading", text: "Estados" },
    ...proof.states.map((s): PdfBlock => ({ kind: "text", text: `${s.key}. ${s.label} (${STATUS_WORD[s.status]})` })),
    { kind: "heading", text: "Revisión automática de números (no es una calificación)" },
  ];
  if (proof.ruleChecks) {
    blocks.push({ kind: "small", text: "Correo (tarea 1)" }, ...checkLines(proof.ruleChecks.task1));
    if (proof.ruleChecks.task2) blocks.push({ kind: "small", text: "Respuesta al cambio (tarea 2)" }, ...checkLines(proof.ruleChecks.task2));
  } else {
    blocks.push({ kind: "text", text: "La revisión automática no estuvo disponible." });
  }
  blocks.push({ kind: "heading", text: "Tu correo a Sarah (tarea 1)" }, { kind: "text", text: proof.emailAnswer });
  if (proof.followupAnswer) {
    blocks.push({ kind: "heading", text: "Tu respuesta al cambio (tarea 2)" }, { kind: "text", text: proof.followupAnswer });
  }
  if (proof.followupAnswer) {
    blocks.push({ kind: "heading", text: "Sugerencia de IA — no es una decisión" });
    blocks.push(
      ...(proof.aiSuggestion
        ? suggestionPoints(proof.aiSuggestion).map((p): PdfBlock => ({ kind: "text", text: `• ${p}` }))
        : [{ kind: "text" as const, text: "La sugerencia de IA no estuvo disponible." }]),
    );
  }
  if (proof.review) {
    blocks.push(
      { kind: "heading", text: "Nota de la persona revisora" },
      { kind: "text", text: proof.review.explained ? "Explicaste el cambio." : "Todavía no se ve cómo explicas el cambio." },
    );
    if (proof.review.note) blocks.push({ kind: "text", text: proof.review.note });
  }
  blocks.push({ kind: "small", text: "Generado en tu teléfono o computadora. Cruce no guarda este archivo." });
  return blocks.map((b) => ({ ...b, text: pdfSafe(b.text) }));
}

export function proofPdfFileName(createdAt: string): string {
  return `cruce-prueba-${createdAt.slice(0, 10)}.pdf`;
}
