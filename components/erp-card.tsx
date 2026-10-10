import { ORDER } from "@/lib/sample";

const fmt = (n: number) => n.toLocaleString("en-US");

export function ErpCard() {
  const rows: [string, string][] = [
    ["Planta", ORDER.plant],
    ["Cliente", ORDER.customer],
    ["Contacto", ORDER.contact],
    ["PO", ORDER.po],
    ["Número de parte", ORDER.part],
    ["Pedido / Enviado", `${fmt(ORDER.ordered)} / ${fmt(ORDER.shipped)}`],
    ["Pendiente", fmt(ORDER.pending)],
    ["Estado", ORDER.status],
    ["Nueva fecha de envío", ORDER.newShipDate],
  ];
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-slate-500">ORDEN EN EL ERP</h2>
      <dl>
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4 border-b border-dashed border-slate-200 py-2 last:border-0"
          >
            <dt className="text-slate-700">{label}</dt>
            <dd className="text-right font-semibold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
