import PDFDocument from "pdfkit";

/**
 * Renders a realistic synthetic regulatory document (operator licence, insurance cert, etc.)
 * to a PDF buffer from ground-truth field values. These are fed to Claude's native PDF
 * understanding at extraction time. A `lowLegibility` flag faintly obscures some values so
 * extraction genuinely returns low confidence (drives the §11 low-confidence scenario).
 */
export interface PdfFieldRow {
  label: string;
  value: string;
  obscure?: boolean;
}

export interface PdfSpec {
  documentLabel: string;
  regulatorName: string;
  country: string;
  refLine?: string;
  accentHex?: string; // header accent (defaults to a neutral slate)
  rows: PdfFieldRow[];
  lowLegibility?: boolean;
  sealText?: string;
}

function obscureValue(value: string): string {
  // Replace ~35% of alphanumerics with a block glyph to simulate a faint/smudged scan.
  const chars = value.split("");
  let replaced = 0;
  const target = Math.ceil(value.replace(/[^A-Za-z0-9]/g, "").length * 0.35);
  return chars
    .map((c) => {
      if (replaced < target && /[A-Za-z0-9]/.test(c) && Math.abs(Math.sin(replaced * 7.13 + c.charCodeAt(0))) > 0.5) {
        replaced++;
        return "▒"; // ▒
      }
      return c;
    })
    .join("");
}

export function renderDocumentPdf(spec: PdfSpec): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const accent = spec.accentHex ?? "#2D3232";
    const pageWidth = doc.page.width;
    const left = 56;
    const contentWidth = pageWidth - left * 2;

    // Header band
    doc.rect(0, 0, pageWidth, 96).fill("#F1F3F4");
    doc.fillColor(accent).rect(0, 0, pageWidth, 6).fill(accent);
    doc.fillColor("#1A1A1A").font("Helvetica-Bold").fontSize(15).text(spec.regulatorName, left, 28, { width: contentWidth });
    doc.fillColor("#6C7070").font("Helvetica").fontSize(10).text(spec.country.toUpperCase(), left, 50);
    doc.fillColor(accent).font("Helvetica-Bold").fontSize(13).text(spec.documentLabel, left, 66, { width: contentWidth });

    let y = 132;
    if (spec.refLine) {
      doc.fillColor("#6C7070").font("Helvetica").fontSize(9).text(spec.refLine, left, y);
      y += 22;
    }

    // Field rows
    doc.font("Helvetica").fontSize(11);
    for (const row of spec.rows) {
      doc.fillColor("#6C7070").font("Helvetica").fontSize(9).text(row.label.toUpperCase(), left, y);
      const faint = spec.lowLegibility && (row.obscure ?? true);
      const value = faint ? obscureValue(row.value) : row.value;
      doc
        .fillColor(faint ? "#AFB3B3" : "#1A1A1A")
        .font("Helvetica-Bold")
        .fontSize(faint ? 11 : 12)
        .text(value || "—", left, y + 12, { width: contentWidth });
      y += 42;
      if (y > doc.page.height - 140) {
        doc.addPage();
        y = 80;
      }
    }

    // Footer seal
    const sealY = doc.page.height - 110;
    doc.moveTo(left, sealY).lineTo(left + contentWidth, sealY).strokeColor("#E5E5E5").stroke();
    doc.fillColor("#6C7070").font("Helvetica").fontSize(8).text(
      spec.sealText ?? "Official document — synthetic data for demonstration only.",
      left,
      sealY + 12,
      { width: contentWidth },
    );
    doc.fillColor(accent).font("Helvetica-Bold").fontSize(9).text("● " + spec.regulatorName, left, sealY + 30);

    doc.end();
  });
}
