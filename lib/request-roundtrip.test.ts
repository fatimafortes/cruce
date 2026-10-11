import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  gateSnapshotBodySchema,
  reviewBodySchema,
  shareBodySchema,
  task1BodySchema,
  task2BodySchema,
} from "@/lib/validation";

// The forms validate in the browser and send the PARSED data; the API parses
// that again with the same schema. So every request schema must accept its own
// output after a JSON round trip (Bug 3: "" → null → "expected string, received null").

const ID = "3f1c2b7e-8a4d-4c1e-9b2a-6d5e4f3a2b1c";

function browserThenServer(schema: z.ZodType, formValues: unknown) {
  const inBrowser = schema.safeParse(formValues);
  expect(inBrowser.success).toBe(true);
  const sent = JSON.parse(JSON.stringify(inBrowser.data)); // what fetch() sends
  return { sent, onServer: schema.safeParse(sent) };
}

describe("Bug 3: share link with an empty display name", () => {
  it("the exact client payload (displayName: null, answers unchecked) is accepted and stores no name", () => {
    const payload = { attemptId: ID, displayName: null, includeAnswers: false };
    const result = shareBodySchema.safeParse(payload);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ attemptId: ID, displayName: null, includeAnswers: false });
  });

  it.each([
    ["empty", ""],
    ["whitespace", "   "],
    ["null", null],
    ["missing", undefined],
  ])("display name %s → no name", (_label, displayName) => {
    const body = displayName === undefined ? { attemptId: ID, includeAnswers: false } : { attemptId: ID, displayName, includeAnswers: false };
    const result = shareBodySchema.safeParse(body);
    expect(result.success).toBe(true);
    expect(result.data?.displayName).toBeNull();
  });

  it("a real name is kept (trimmed); a non-string name gets a Spanish message", () => {
    expect(shareBodySchema.parse({ attemptId: ID, displayName: "  Lupita M. ", includeAnswers: true }).displayName).toBe("Lupita M.");
    const bad = shareBodySchema.safeParse({ attemptId: ID, displayName: 42, includeAnswers: true });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0].message).toBe("Escribe el nombre como texto.");
  });
});

describe("every request schema survives browser parse → JSON → server parse", () => {
  it.each([
    ["share, no name", shareBodySchema, { attemptId: ID, displayName: "", includeAnswers: false }],
    ["share, with name and answers", shareBodySchema, { attemptId: ID, displayName: " Lupita ", includeAnswers: true }],
    ["task 1", task1BodySchema, { emailAnswer: `  ${"a".repeat(100)}  ` }],
    ["task 2", task2BodySchema, { followupAnswer: "b".repeat(60) }],
    ["review sí, no note", reviewBodySchema, { attemptId: ID, explained: true, note: "  " }],
    ["review todavía no", reviewBodySchema, { attemptId: ID, explained: false, note: " Falta el flete aéreo. " }],
  ])("%s", (_label, schema, formValues) => {
    const { sent, onServer } = browserThenServer(schema as z.ZodType, formValues);
    expect(onServer.success).toBe(true);
    expect(onServer.data).toEqual(sent);
  });
});

describe("gate snapshot (F8)", () => {
  const ok = {
    snapshotDate: "2026-10-05",
    source: "OCC Mundial",
    query: "servicio al cliente planta Monterrey",
    totalCount: 40,
    plantCsCount: 6,
    notes: "",
  };
  const message = (body: unknown) => {
    const r = gateSnapshotBodySchema.safeParse(body);
    return r.success ? null : r.error.issues[0].message;
  };

  it("survives browser parse → JSON → server parse (empty notes → null)", () => {
    const { sent, onServer } = browserThenServer(gateSnapshotBodySchema as z.ZodType, ok);
    expect(sent.notes).toBeNull();
    expect(onServer.success).toBe(true);
  });

  it("rejects a future date, plant > total, negatives and decimals", () => {
    expect(message({ ...ok, snapshotDate: "2999-01-01" })).toBe("La fecha no puede ser futura.");
    expect(message({ ...ok, plantCsCount: 41 })).toBe("El número en planta no puede ser mayor que el total.");
    expect(message({ ...ok, totalCount: -1 })).toBe("El total de resultados no puede ser negativo.");
    expect(message({ ...ok, plantCsCount: 2.5 })).toBe("Escribe el número en planta como número entero.");
  });

  it.each([
    ["source", "https://www.occ.com.mx/empleos/123"],
    ["notes", "ver www.indeed.com/viewjob?jk=abc"],
    ["query", "http://example.com"],
  ])("rejects a link in %s (no links to postings)", (field, value) => {
    expect(message({ ...ok, [field]: value })).toBe("No pegues enlaces: aquí solo van números y el nombre de la fuente.");
  });

  it("requires source and query", () => {
    expect(message({ ...ok, source: "  " })).toBe("Escribe la fuente.");
    expect(message({ ...ok, query: "" })).toBe("Escribe la búsqueda que usaste.");
  });
});
