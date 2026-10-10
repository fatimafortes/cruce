import { ORDER, TASK1_ALLOWED_QUANTITIES, TASK2_ALLOWED_QUANTITIES } from "@/lib/sample";

// Deterministic checks of the worker's text against the invented order.
// They run before any AI and never produce a score (C1): each item is a fact
// found or not found, worded neutrally in Spanish.

export type Check = { item: string; passed: boolean; detail: string };

export type RuleChecks = {
  version: 1;
  task1: Check[];
  task2: Check[] | null;
};

const MONTH_NOV = String.raw`nov(?:ember|\.|\b)`;

// "Nov 14", "Nov. 14", "November 14th", "14 Nov", "14th of November", "11/14" (also "11/14/2026").
function mentionsNovemberDay(text: string, day: number): boolean {
  const d = `${day}(?:st|nd|rd|th)?`;
  const patterns = [
    new RegExp(String.raw`\b${MONTH_NOV}\s*${d}\b`, "i"),
    new RegExp(String.raw`\b${d}\s+(?:of\s+)?${MONTH_NOV}`, "i"),
    new RegExp(String.raw`(?<![\d/])11/${day}(?![\d])`),
  ];
  return patterns.some((pattern) => pattern.test(text));
}

// Numbers written as quantities: "800", "1,200", "1200". Skips digits that are
// part of an identifier or a date (PO-48213, BRK-2207-A, 11/14, 3.5).
export function quantitiesIn(text: string): number[] {
  const found: number[] = [];
  const pattern = /(?<![\w./-])(\d{1,3}(?:,\d{3})+|\d+)(?![\w/]|[.,]\d)/g;
  for (const match of text.matchAll(pattern)) {
    found.push(Number(match[1].replaceAll(",", "")));
  }
  return found;
}

function unexpectedQuantities(text: string, allowed: readonly number[]): number[] {
  const unexpected = quantitiesIn(text).filter(
    (n) => n >= 100 && n <= 2000 && !allowed.includes(n),
  );
  return [...new Set(unexpected)];
}

function check(item: string, passed: boolean, found: string, missing: string): Check {
  return { item, passed, detail: passed ? found : missing };
}

function quantityCheck(text: string, allowed: readonly number[]): Check {
  const unexpected = unexpectedQuantities(text, allowed);
  const list = unexpected.map((n) => n.toLocaleString("en-US")).join(", ");
  return check(
    "Cantidades que no coinciden",
    unexpected.length === 0,
    "Todas las cantidades coinciden con la orden.",
    `Revisa: ${list} no ${unexpected.length === 1 ? "aparece" : "aparecen"} en la orden.`,
  );
}

export function checkTask1(text: string): Check[] {
  const quantities = quantitiesIn(text);
  const hasPo =
    new RegExp(String.raw`\bPO[\s#-]*${ORDER.poDigits}\b`, "i").test(text) ||
    new RegExp(String.raw`(?<![\w-])${ORDER.poDigits}\b`).test(text);

  return [
    check(
      "Número de orden",
      hasPo,
      `Mencionas el ${ORDER.po}.`,
      `No encontramos el número de orden (${ORDER.po}).`,
    ),
    check(
      "Número de parte",
      /\bBRK-2207-A\b/i.test(text),
      `Mencionas la parte ${ORDER.part}.`,
      `No encontramos el número de parte (${ORDER.part}).`,
    ),
    check(
      "Cantidad enviada",
      quantities.includes(ORDER.shipped),
      "Mencionas las 800 piezas enviadas.",
      "No encontramos la cantidad enviada (800).",
    ),
    check(
      "Cantidad pendiente",
      quantities.includes(ORDER.pending),
      "Mencionas las 400 piezas pendientes.",
      "No encontramos la cantidad pendiente (400).",
    ),
    check(
      "Nueva fecha de envío",
      mentionsNovemberDay(text, 14),
      "Mencionas la nueva fecha (14 de noviembre).",
      "No encontramos la nueva fecha de envío (Nov 14).",
    ),
    quantityCheck(text, TASK1_ALLOWED_QUANTITIES),
  ];
}

export function checkTask2(text: string): Check[] {
  const quantities = quantitiesIn(text);
  return [
    check(
      "Primer envío",
      quantities.includes(250),
      "Mencionas las 250 piezas del 14 de noviembre.",
      "No encontramos las 250 piezas del primer envío.",
    ),
    check(
      "Segundo envío",
      quantities.includes(150),
      "Mencionas las 150 piezas restantes.",
      "No encontramos las 150 piezas del segundo envío.",
    ),
    check(
      "Fecha del segundo envío",
      mentionsNovemberDay(text, 19),
      "Mencionas la fecha del segundo envío (19 de noviembre).",
      "No encontramos la fecha del segundo envío (Nov 19).",
    ),
    quantityCheck(text, TASK2_ALLOWED_QUANTITIES),
  ];
}

export function runChecks(emailAnswer: string, followupAnswer: string | null): RuleChecks {
  return {
    version: 1,
    task1: checkTask1(emailAnswer),
    task2: followupAnswer === null ? null : checkTask2(followupAnswer),
  };
}

export function allPassed(checks: RuleChecks): boolean {
  return [...checks.task1, ...(checks.task2 ?? [])].every((c) => c.passed);
}
