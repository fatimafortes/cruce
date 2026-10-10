import type { PdfBlock } from "@/lib/proof-pdf";

// Browser only. jsPDF is loaded when the worker taps "Descargar PDF", not with the page.
const STYLE: Record<PdfBlock["kind"], { size: number; weight: "bold" | "normal"; after: number; before: number }> = {
  title: { size: 18, weight: "bold", after: 6, before: 0 },
  label: { size: 9, weight: "bold", after: 8, before: 0 },
  heading: { size: 12, weight: "bold", after: 4, before: 12 },
  text: { size: 10, weight: "normal", after: 4, before: 0 },
  small: { size: 9, weight: "normal", after: 4, before: 2 },
};

export async function downloadProofPdf(blocks: PdfBlock[], fileName: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 56;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const bottom = doc.internal.pageSize.getHeight() - margin;
  let y = margin;

  for (const block of blocks) {
    const style = STYLE[block.kind];
    doc.setFont("helvetica", style.weight);
    doc.setFontSize(style.size);
    y += style.before;
    for (const line of doc.splitTextToSize(block.text, width) as string[]) {
      if (y > bottom) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += style.size * 1.35;
    }
    y += style.after;
  }
  doc.save(fileName);
}
