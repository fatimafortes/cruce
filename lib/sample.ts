// The one invented work sample. All data is fictional: DATOS INVENTADOS · PLANTA FICTICIA.

export const INVENTED_LABEL = "DATOS INVENTADOS · PLANTA FICTICIA";

export const ORDER = {
  plant: "Planta Demo Norte (ficticia)",
  customer: "Midwest Trailer Co. (ficticio)",
  contact: "Sarah Miller",
  po: "PO-48213",
  poDigits: "48213",
  part: "BRK-2207-A",
  ordered: 1200,
  shipped: 800,
  pending: 400,
  status: "Línea 3 detenida",
  newShipDate: "14 Nov",
} as const;

export const TASK1 = {
  title: "Escribe el correo en inglés al cliente",
  instructions:
    "Explica a Sarah el retraso, con los números correctos, y di cuál es el siguiente paso.",
  placeholder: "Hi Sarah, I'm writing about PO-48213…",
  min: 80,
  max: 3000,
} as const;

export const TASK2 = {
  title: "Cambio de último momento",
  update:
    "Update: Line 3 restarted. 250 units ship Nov 14; the remaining 150 ship Nov 19. Sarah asks to air-freight all 400 now. Air freight costs the plant extra and needs approval from her account manager. In 3–5 sentences in English, what do you tell Sarah now, and why?",
  instructions: "En 3 a 5 oraciones en inglés: ¿qué le dices ahora a Sarah y por qué?",
  placeholder: "Hi Sarah, quick update on PO-48213…",
  min: 40,
  max: 1500,
} as const;

// Quantities that belong to the order. Any other number from 100 to 2,000 is flagged.
export const TASK1_ALLOWED_QUANTITIES = [ORDER.ordered, ORDER.shipped, ORDER.pending] as const;
export const TASK2_ALLOWED_QUANTITIES = [...TASK1_ALLOWED_QUANTITIES, 250, 150] as const;
