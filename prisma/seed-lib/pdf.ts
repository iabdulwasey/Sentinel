import PDFDocument from "pdfkit";
import { formatForMarket } from "./dates";

/**
 * Renders a realistic synthetic regulatory document (operator licence, insurance
 * certificate, vehicle registration, roadworthiness test, driver credential, …)
 * to a PDF buffer from ground-truth field values. The layout is chosen per
 * document KIND so a licence looks like a licence and an insurance certificate
 * looks like one — branded to the issuing authority and addressed to the actual
 * partner/vehicle/driver. These PDFs are fed to Claude's native PDF understanding
 * at extraction time. `lowLegibility` faintly obscures values so extraction
 * genuinely returns low confidence (drives the §11 low-confidence scenario).
 */

export type DocKind = "license" | "registration" | "vehicle" | "inspection" | "insurance" | "identity" | "certificate";

export interface PdfFieldRow {
  key?: string;
  label: string;
  value: string;
}

export interface PdfSpec {
  kind: DocKind;
  documentLabel: string;
  authorityName: string;
  authoritySubline?: string;
  country: string;
  docNumber?: string;
  numberLabel?: string;
  subject?: { label: string; value: string }[];
  issuedAtText?: string;
  expiresAtText?: string;
  expired?: boolean;
  rows: PdfFieldRow[];
  reference?: string;
  accentHex?: string;
  lowLegibility?: boolean;
  language?: string;
  bodyNote?: string;
  noteHeading?: string;
}

type Emblem = "gov" | "insurer" | "person" | "vehicle" | "seal";

const KIND_BY_DOCTYPE: Record<string, DocKind> = {
  OPERATOR_PERMIT: "license",
  OPERATING_LICENCE: "license",
  OPERATOR_PROVISIONAL_LICENSE: "license",
  TVDE_OPERATOR_LICENSE: "license",
  TAXI_LICENSE: "license",
  LICENSE_EXTRACT: "license",
  ALT_TRANSPORT_AUTHORIZATION: "license",
  SERVICE_ENTITY_PERMIT: "license",
  NPTR_REGISTRATION_CERTIFICATE: "license",
  BUSINESS_REGISTRATION: "registration",
  VEHICLE_REGISTRATION: "vehicle",
  VEHICLE_INSPECTION: "inspection",
  VEHICLE_ITP: "inspection",
  VEHICLE_ROADWORTHINESS: "inspection",
  VEHICLE_INSURANCE: "insurance",
  DRIVER_LICENSE: "identity",
  PRDP: "identity",
  LASDRI_CERTIFICATE: "identity",
  TVDE_DRIVER_CERTIFICATE: "identity",
  VEHICLE_TVDE_BADGE: "identity",
  DRIVER_ATTESTATION: "certificate",
  DRIVER_CRIMINAL_RECORD: "certificate",
};

const KIND_STYLE: Record<DocKind, { accent: string; numberLabel: string; emblem: Emblem; subline: string }> = {
  license: { accent: "#1F4E79", numberLabel: "Licence No.", emblem: "gov", subline: "Transport operating authority" },
  registration: { accent: "#5B3A8E", numberLabel: "Registration No.", emblem: "gov", subline: "Commercial register extract" },
  vehicle: { accent: "#0F6E4F", numberLabel: "Registration mark", emblem: "vehicle", subline: "Vehicle registration certificate" },
  inspection: { accent: "#9A5B00", numberLabel: "Certificate No.", emblem: "seal", subline: "Periodic technical inspection" },
  insurance: { accent: "#11507A", numberLabel: "Policy No.", emblem: "insurer", subline: "Certificate of motor insurance" },
  identity: { accent: "#7A1F4E", numberLabel: "Credential No.", emblem: "person", subline: "Driver credential" },
  certificate: { accent: "#2D3232", numberLabel: "Certificate No.", emblem: "gov", subline: "Official certificate" },
};

export function documentKind(docType: string): DocKind {
  return KIND_BY_DOCTYPE[docType] ?? "certificate";
}

const KIND_NOTE: Record<DocKind, { heading: string; text: string }> = {
  license: {
    heading: "Scope & conditions",
    text: "This licence authorises the named holder to provide passenger-transport intermediation services within the territory shown above, subject to the conditions of the governing transport regulations. It is non-transferable, remains the property of the issuing authority, and must be produced on demand to an authorised officer. The authority may suspend or revoke this licence where the holder ceases to meet the eligibility requirements.",
  },
  registration: {
    heading: "Certification",
    text: "This is a certified extract from the commercial register confirming the entity's registration and standing as at the date of issue. It records the particulars held on the public register and does not by itself confer any operating or trading right. Changes to the registered particulars must be notified to the registry within the statutory period.",
  },
  vehicle: {
    heading: "Conditions of registration",
    text: "This certificate records the registration particulars of the vehicle described above. The registered keeper must notify the registration authority of any change of ownership, address, or technical specification within the statutory period, and must ensure the vehicle remains insured and roadworthy while in service.",
  },
  inspection: {
    heading: "Result & conditions",
    text: "The vehicle identified above was examined at an approved testing station and found to comply with the applicable roadworthiness requirements on the date of inspection. This certificate is valid until the expiry date shown, provided the vehicle is maintained in a roadworthy condition. It does not warrant the vehicle against subsequent defects.",
  },
  insurance: {
    heading: "Cover & conditions",
    text: "This certificate is evidence that a policy of motor insurance has been issued covering the vehicle and use described above, including third-party liability and the carriage of passengers for hire or reward, in accordance with the applicable motor-insurance law. Cover is effective only for the period of insurance shown and is subject to the terms, conditions, and exceptions of the policy.",
  },
  identity: {
    heading: "Conditions",
    text: "This credential certifies that the holder named above is authorised to drive vehicles of the categories shown for the carriage of passengers. It must be carried while operating, remains valid only for the period shown, and must be surrendered to the issuing authority on demand or on cessation of eligibility.",
  },
  certificate: {
    heading: "Statement",
    text: "This certificate is issued for the purposes stated above and reflects the records held by the issuing authority as at the date of issue. It should be read together with the governing regulations and any conditions attached to it.",
  },
};

/** Build a fully-classified PdfSpec from a document's expected-field meta + ground-truth values. */
export function buildPdfSpec(args: {
  docType: string;
  label: string;
  country: string;
  authority: string;
  authoritySubline?: string;
  expectedFields: { key: string; label: string; type?: string }[];
  gt: Record<string, string>;
  issuedAt: Date;
  expiresAt: Date;
  dateFormat: string;
  expired: boolean;
  reference?: string;
  lowLegibility?: boolean;
  language?: string;
  partnerName?: string;
}): PdfSpec {
  const kind = documentKind(args.docType);
  const style = KIND_STYLE[kind];
  const allRows: PdfFieldRow[] = args.expectedFields.map((f) => ({ key: f.key, label: f.label, value: args.gt[f.key] ?? "" }));
  const issuedAtText = formatForMarket(args.issuedAt, args.dateFormat);
  const expiresAtText = formatForMarket(args.expiresAt, args.dateFormat);

  const used = new Set<string>();
  const idOf = (r: PdfFieldRow) => r.key ?? r.label;
  const take = (re: RegExp): PdfFieldRow | undefined => {
    const row = allRows.find((r) => !used.has(idOf(r)) && r.value && (re.test(r.key ?? "") || re.test(r.label)));
    if (row) used.add(idOf(row));
    return row;
  };

  // Header brand: an insurance certificate is issued by the insurer, not the regulator.
  let authorityName = args.authority;
  let authoritySubline = args.authoritySubline ?? style.subline;
  if (kind === "insurance") {
    const insurer = take(/insurer|asigurator|seguradora|ubezpieczyciel/i);
    if (insurer?.value) {
      authorityName = insurer.value;
      authoritySubline = "Certificate of motor insurance";
    }
  }

  // Headline number for the document.
  let numberRow: PdfFieldRow | undefined;
  if (kind === "vehicle") numberRow = take(/plate|matric|înmatric|rejestrac|number plate|registration mark/i);
  numberRow =
    numberRow ??
    take(/licen|permit|policy|polisa|certificate|\bcert\b|rc\b|\bnip\b|\bkrs\b|nptr|prdp|lasdri|badge|extract|attest|number|no\.?$|\bref\b/i);

  // Subject block — who / what the document is for.
  const subject: { label: string; value: string }[] = [];
  const holder = take(/insured|holder|company|operator|entity|titular|registered|business name|firm/i);
  const holderValue = holder?.value || args.partnerName;
  if (holderValue) subject.push({ label: kind === "insurance" ? "Insured" : "Issued to", value: holderValue });
  const owner = take(/owner|proprietar/i);
  if (owner?.value) subject.push({ label: "Owner", value: owner.value });
  const person = take(/driver|motorista|conduc|kierowca|full name|holder name|surname/i);
  if (person?.value) subject.push({ label: "Holder", value: person.value });
  if (kind === "vehicle" || kind === "inspection" || kind === "insurance") {
    const plate = take(/plate|matric|înmatric|number plate/i);
    const make = take(/make|marca|marka/i);
    const model = take(/model/i);
    const bits = [plate?.value, [make?.value, model?.value].filter(Boolean).join(" ").trim()].filter(Boolean);
    if (bits.length) subject.push({ label: "Vehicle", value: bits.join(" · ") });
  }

  // Details grid = everything left over, minus the dates already shown in the validity badge.
  const details = allRows.filter((r) => {
    if (numberRow && idOf(r) === idOf(numberRow)) return false;
    if (used.has(idOf(r))) return false;
    if (r.value === issuedAtText || r.value === expiresAtText) return false;
    return true;
  });

  return {
    kind,
    documentLabel: args.label,
    authorityName,
    authoritySubline,
    country: args.country,
    docNumber: numberRow?.value || args.reference,
    numberLabel: style.numberLabel,
    subject,
    issuedAtText,
    expiresAtText,
    expired: args.expired,
    rows: details,
    reference: args.reference,
    accentHex: style.accent,
    lowLegibility: args.lowLegibility,
    language: args.language,
    bodyNote: KIND_NOTE[kind].text,
    noteHeading: KIND_NOTE[kind].heading,
  };
}

// ── drawing helpers ────────────────────────────────────────────────────────

function initials(s: string): string {
  return (
    s
      .replace(/[^\p{L}\s]/gu, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "★"
  );
}

function obscureValue(value: string): string {
  const chars = value.split("");
  let replaced = 0;
  const target = Math.ceil(value.replace(/[^A-Za-z0-9]/g, "").length * 0.35);
  return chars
    .map((c) => {
      if (replaced < target && /[A-Za-z0-9]/.test(c) && Math.abs(Math.sin(replaced * 7.13 + c.charCodeAt(0))) > 0.5) {
        replaced++;
        return "▒";
      }
      return c;
    })
    .join("");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = any;

function drawStar(doc: Doc, cx: number, cy: number, r: number, color: string) {
  doc.save();
  doc.fillColor(color);
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.42;
    pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
  }
  doc.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) doc.lineTo(pts[i][0], pts[i][1]);
  doc.closePath().fill();
  doc.restore();
}

function drawEmblem(doc: Doc, emblem: Emblem, x: number, y: number, size: number, accent: string, brand: string) {
  doc.save();
  if (emblem === "insurer") {
    doc.roundedRect(x, y, size, size, 8).fill(accent);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(size * 0.4).text(initials(brand), x, y + size * 0.28, { width: size, align: "center" });
  } else if (emblem === "person") {
    doc.circle(x + size / 2, y + size / 2, size / 2).fill("#F1F3F4");
    doc.circle(x + size / 2, y + size / 2, size / 2).lineWidth(1.5).strokeColor(accent).stroke();
    // head + shoulders
    doc.fillColor(accent).circle(x + size / 2, y + size * 0.4, size * 0.16).fill();
    doc.fillColor(accent).moveTo(x + size * 0.28, y + size * 0.82)
      .bezierCurveTo(x + size * 0.3, y + size * 0.58, x + size * 0.7, y + size * 0.58, x + size * 0.72, y + size * 0.82)
      .lineTo(x + size * 0.28, y + size * 0.82)
      .fill();
  } else if (emblem === "vehicle") {
    doc.roundedRect(x, y, size, size, 8).fill("#F1F3F4");
    doc.roundedRect(x, y, size, size, 8).lineWidth(1.5).strokeColor(accent).stroke();
    const cx = x + size / 2;
    const cy = y + size * 0.56;
    doc.fillColor(accent);
    doc.moveTo(cx - size * 0.3, cy)
      .lineTo(cx - size * 0.22, cy - size * 0.16)
      .lineTo(cx + size * 0.18, cy - size * 0.16)
      .lineTo(cx + size * 0.3, cy)
      .lineTo(cx + size * 0.3, cy + size * 0.1)
      .lineTo(cx - size * 0.3, cy + size * 0.1)
      .fill();
    doc.fillColor("#FFFFFF").circle(cx - size * 0.16, cy + size * 0.1, size * 0.06).fill();
    doc.fillColor("#FFFFFF").circle(cx + size * 0.16, cy + size * 0.1, size * 0.06).fill();
    doc.fillColor(accent).circle(cx - size * 0.16, cy + size * 0.1, size * 0.06).lineWidth(1).strokeColor(accent).stroke();
    doc.circle(cx + size * 0.16, cy + size * 0.1, size * 0.06).stroke();
  } else {
    // government shield/seal
    const cx = x + size / 2;
    doc.fillColor(accent);
    doc.moveTo(x, y + size * 0.12)
      .lineTo(x + size, y + size * 0.12)
      .lineTo(x + size, y + size * 0.55)
      .bezierCurveTo(x + size, y + size * 0.85, cx, y + size, cx, y + size)
      .bezierCurveTo(cx, y + size, x, y + size * 0.85, x, y + size * 0.55)
      .lineTo(x, y + size * 0.12)
      .fill();
    drawStar(doc, x + size / 2, y + size * 0.46, size * 0.2, "#FFFFFF");
  }
  doc.restore();
}

function drawBadge(doc: Doc, x: number, y: number, expired: boolean) {
  const w = 78;
  const h = 22;
  const fill = expired ? "#FCE8EC" : "#E8F9F4";
  const ink = expired ? "#9E1B33" : "#0F6E4F";
  doc.save();
  doc.roundedRect(x, y, w, h, 11).fill(fill);
  doc.fillColor(ink).circle(x + 14, y + h / 2, 3.2).fill();
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(9).text(expired ? "EXPIRED" : "VALID", x + 22, y + 6.5, { width: w - 26 });
  doc.restore();
}

function drawSeal(doc: Doc, cx: number, cy: number, r: number, accent: string, text: string) {
  doc.save();
  doc.opacity(0.5);
  doc.lineWidth(1.6).strokeColor(accent).circle(cx, cy, r).stroke();
  doc.lineWidth(0.8).strokeColor(accent).circle(cx, cy, r - 5).stroke();
  doc.rotate(-12, { origin: [cx, cy] });
  doc.fillColor(accent).font("Helvetica-Bold").fontSize(8).text(text.slice(0, 22).toUpperCase(), cx - r, cy - 11, { width: r * 2, align: "center" });
  doc.fillColor(accent).font("Helvetica-Bold").fontSize(7).text("OFFICIAL", cx - r, cy + 2, { width: r * 2, align: "center" });
  doc.restore();
}

function drawSignature(doc: Doc, x: number, y: number, accent: string) {
  doc.save();
  doc.lineWidth(1.2).strokeColor(accent).opacity(0.8);
  doc.moveTo(x, y + 8)
    .bezierCurveTo(x + 12, y - 6, x + 18, y + 14, x + 30, y + 2)
    .bezierCurveTo(x + 40, y - 6, x + 46, y + 10, x + 62, y - 2)
    .stroke();
  doc.restore();
}

function drawBarcode(doc: Doc, x: number, y: number, w: number, h: number, seedStr: string) {
  doc.save();
  doc.fillColor("#1A1A1A");
  let cx = x;
  let i = 0;
  while (cx < x + w) {
    const code = seedStr.charCodeAt(i % Math.max(1, seedStr.length)) + i * 7;
    const bw = 0.8 + (code % 4) * 0.7;
    if (i % 2 === 0) doc.rect(cx, y, bw, h).fill();
    cx += bw + 0.7;
    i++;
  }
  doc.restore();
}

// ── main renderer ────────────────────────────────────────────────────────

export function renderDocumentPdf(spec: PdfSpec): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const accent = spec.accentHex ?? KIND_STYLE[spec.kind].accent;
    const style = KIND_STYLE[spec.kind];
    const W = doc.page.width;
    const H = doc.page.height;
    const left = 50;
    const cw = W - left * 2;
    const right = left + cw;
    const faintAll = !!spec.lowLegibility;

    // Frame
    doc.rect(0, 0, W, H).fill("#FFFFFF");
    doc.lineWidth(1.4).strokeColor(accent).rect(26, 26, W - 52, H - 52).stroke();
    doc.lineWidth(0.5).strokeColor("#C9CDCD").rect(31, 31, W - 62, H - 62).stroke();

    // Header
    const emblemSize = 52;
    drawEmblem(doc, style.emblem, left, 48, emblemSize, accent, spec.authorityName);
    const hx = left + emblemSize + 16;
    doc.fillColor("#1A1A1A").font("Helvetica-Bold").fontSize(15).text(spec.authorityName, hx, 50, { width: right - hx });
    doc.fillColor("#6C7070").font("Helvetica").fontSize(9.5).text(spec.authoritySubline ?? style.subline, hx, 71, { width: right - hx });
    doc.fillColor("#9AA0A0").font("Helvetica-Bold").fontSize(8).text(spec.country.toUpperCase(), hx, 86, { width: right - hx, characterSpacing: 1 });

    doc.rect(left, 116, cw, 3).fill(accent);
    doc.fillColor(accent).font("Helvetica-Bold").fontSize(17).text(spec.documentLabel.toUpperCase(), left, 130, { width: cw });

    let y = 130 + Math.ceil(doc.heightOfString(spec.documentLabel.toUpperCase(), { width: cw }) ) + 14;

    // Headline panel: document number + validity
    const hpH = 54;
    doc.roundedRect(left, y, cw, hpH, 7).fill("#FAFBFC");
    doc.roundedRect(left, y, cw, hpH, 7).lineWidth(0.8).strokeColor("#E5E5E5").stroke();
    doc.fillColor("#9AA0A0").font("Helvetica-Bold").fontSize(7.5).text((spec.numberLabel ?? "Reference").toUpperCase(), left + 16, y + 11, { characterSpacing: 0.5 });
    const num = faintAll ? obscureValue(spec.docNumber ?? "—") : spec.docNumber ?? "—";
    doc.fillColor(faintAll ? "#AFB3B3" : "#1A1A1A").font("Courier-Bold").fontSize(16).text(num, left + 16, y + 24, { width: cw * 0.6 });
    // validity at right
    drawBadge(doc, right - 94, y + 11, !!spec.expired);
    const dl = `Issued  ${spec.issuedAtText ?? "—"}`;
    const de = `Expires ${spec.expiresAtText ?? "—"}`;
    doc.fillColor("#6C7070").font("Helvetica").fontSize(8).text(dl, right - 200, y + 34, { width: 200, align: "right" });
    doc.fillColor(spec.expired ? "#9E1B33" : "#6C7070").font("Helvetica").fontSize(8).text(de, right - 200, y + 44, { width: 200, align: "right" });
    y += hpH + 18;

    // Subject panel
    const subj = spec.subject ?? [];
    if (subj.length) {
      const isIdentity = spec.kind === "identity";
      const photoW = isIdentity ? 66 : 0;
      const sH = Math.max(isIdentity ? 86 : 0, 16 + subj.length * 19 + 6);
      doc.roundedRect(left, y, cw, sH, 7).fill("#F7F8FA");
      doc.fillColor("#9AA0A0").font("Helvetica-Bold").fontSize(7.5).text(isIdentity ? "DETAILS OF HOLDER" : "SUBJECT", left + 16, y + 11, { characterSpacing: 0.5 });
      let sy = y + 26;
      const textW = cw - 32 - (photoW ? photoW + 14 : 0);
      for (const item of subj) {
        doc.fillColor("#6C7070").font("Helvetica").fontSize(8).text(item.label, left + 16, sy, { width: 64, continued: false });
        doc.fillColor("#1A1A1A").font("Helvetica-Bold").fontSize(11).text(item.value, left + 84, sy - 1.5, { width: textW - 68 });
        sy += 19;
      }
      if (isIdentity) {
        const px = right - photoW - 14;
        const py = y + 11;
        doc.roundedRect(px, py, photoW, sH - 22, 5).fill("#FFFFFF");
        doc.roundedRect(px, py, photoW, sH - 22, 5).lineWidth(1).strokeColor("#D5D8D8").dash(2, { space: 2 }).stroke();
        doc.undash();
        drawEmblem(doc, "person", px + photoW / 2 - 16, py + (sH - 22) / 2 - 18, 32, "#C2C7C7", "");
        doc.fillColor("#AFB3B3").font("Helvetica").fontSize(6.5).text("PHOTO", px, py + sH - 36, { width: photoW, align: "center" });
      }
      y += sH + 18;
    }

    // Particulars grid (two columns)
    if (spec.rows.length) {
      doc.fillColor("#9AA0A0").font("Helvetica-Bold").fontSize(7.5).text("PARTICULARS", left, y, { characterSpacing: 0.5 });
      y += 16;
      const colGap = 24;
      const colW = (cw - colGap) / 2;
      const rowH = 38;
      const startY = y;
      spec.rows.forEach((row, i) => {
        const col = i % 2;
        const rowIdx = Math.floor(i / 2);
        const cx = left + col * (colW + colGap);
        const cy = startY + rowIdx * rowH;
        doc.fillColor("#9AA0A0").font("Helvetica-Bold").fontSize(7).text(row.label.toUpperCase(), cx, cy, { width: colW, characterSpacing: 0.4 });
        const faint = faintAll;
        const val = faint ? obscureValue(row.value) : row.value;
        doc.fillColor(faint ? "#AFB3B3" : "#1A1A1A").font("Helvetica-Bold").fontSize(11.5).text(val || "—", cx, cy + 12, { width: colW });
        doc.moveTo(cx, cy + rowH - 8).lineTo(cx + colW, cy + rowH - 8).lineWidth(0.4).strokeColor("#EDEFEF").stroke();
      });
      const rows = Math.ceil(spec.rows.length / 2);
      y = startY + rows * rowH + 6;
    }

    // Endorsement / conditions paragraph (fills the body realistically)
    if (spec.bodyNote && y < H - 220) {
      doc.fillColor("#9AA0A0").font("Helvetica-Bold").fontSize(7.5).text((spec.noteHeading ?? "Conditions").toUpperCase(), left, y, { characterSpacing: 0.5 });
      y += 14;
      doc.fillColor("#4A4F4F").font("Helvetica").fontSize(9.5).text(spec.bodyNote, left, y, { width: cw, align: "justify", lineGap: 2.5 });
    }

    // Footer
    const footY = H - 116;
    doc.moveTo(left, footY).lineTo(right, footY).lineWidth(0.8).strokeColor("#E5E5E5").stroke();
    // seal on the left
    drawSeal(doc, left + 40, footY + 42, 30, accent, spec.authorityName);
    // signature block on the right
    const sigX = right - 180;
    drawSignature(doc, sigX + 30, footY + 18, accent);
    doc.moveTo(sigX, footY + 38).lineTo(sigX + 180, footY + 38).lineWidth(0.8).strokeColor("#9AA0A0").stroke();
    doc.fillColor("#1A1A1A").font("Helvetica-Bold").fontSize(8.5).text("Authorised signatory", sigX, footY + 42, { width: 180, align: "right" });
    doc.fillColor("#6C7070").font("Helvetica").fontSize(7.5).text(`for and on behalf of ${spec.authorityName}`, sigX - 40, footY + 53, { width: 220, align: "right" });
    // barcode + reference + disclaimer
    drawBarcode(doc, left + 90, footY + 30, 110, 24, spec.docNumber ?? spec.reference ?? spec.documentLabel);
    doc.fillColor("#6C7070").font("Courier").fontSize(7).text(spec.reference ?? "", left + 90, footY + 56, { width: 200 });
    doc.fillColor("#B8BCBC").font("Helvetica").fontSize(6.5).text(
      "Synthetic document generated for the Bolt Sentinel demo — not a genuine certificate.",
      left,
      H - 40,
      { width: cw, align: "center" },
    );

    doc.end();
  });
}
