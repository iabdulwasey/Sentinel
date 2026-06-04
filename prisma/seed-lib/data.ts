import type { ExpectedField, RequiredDocumentSpec } from "../../engine/types/ruleset";
import { formatForMarket } from "./dates";

/** Deterministic RNG (seedable) so seeds are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(arr: T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)];
}
function digits(n: number, r: () => number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += Math.floor(r() * 10);
  return s;
}
function letters(n: number, r: () => number): string {
  const A = "ABCDEFGHJKLMNPRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < n; i++) s += A[Math.floor(r() * A.length)];
  return s;
}

interface NamePool {
  given: string[];
  family: string[];
  companyWords: string[];
  companySuffix: string;
  citySamples: string[];
}

const POOLS: Record<string, NamePool> = {
  EE_TALLINN: {
    given: ["Jaan", "Kalle", "Mart", "Andres", "Toomas", "Katrin", "Kaarin", "Liis", "Maarja", "Tiit"],
    family: ["Tamm", "Saar", "Mägi", "Kask", "Kukk", "Rebane", "Ilves", "Pärn", "Jaanson", "Lepik"],
    companyWords: ["Tallinn", "Baltic", "Nord", "Viru", "Lasna", "Pirita", "Kalev"],
    companySuffix: "OÜ",
    citySamples: ["Tallinn"],
  },
  PL_WARSAW: {
    given: ["Piotr", "Paweł", "Marek", "Tomasz", "Krzysztof", "Anna", "Maria", "Katarzyna", "Magdalena", "Agnieszka"],
    family: ["Kowalski", "Nowak", "Lewandowski", "Kamiński", "Zieliński", "Wójcik", "Kowalczyk", "Mazur", "Krawczyk", "Dąbrowski"],
    companyWords: ["Warszawa", "Wisła", "Stołeczny", "Mazovia", "Praga", "Wola"],
    companySuffix: "Sp. z o.o.",
    citySamples: ["Warsaw"],
  },
  PT_LISBON: {
    given: ["João", "Manuel", "Carlos", "Pedro", "Ricardo", "Maria", "Ana", "Sofia", "Inês", "Joana"],
    family: ["Silva", "Santos", "Oliveira", "Costa", "Martins", "Ferreira", "Gomes", "Rodrigues", "Almeida", "Pereira"],
    companyWords: ["Lisboa", "Tejo", "Atlântico", "Belém", "Porto", "Douro"],
    companySuffix: "Lda.",
    citySamples: ["Lisbon", "Porto"],
  },
  RO_BUCHAREST: {
    given: ["Ion", "Gheorghe", "Mihai", "Andrei", "Cristian", "Maria", "Ana", "Elena", "Gabriela", "Ioana"],
    family: ["Popescu", "Ionescu", "Dumitru", "Ciobanu", "Constantin", "Marinescu", "Stan", "Gheorghiu", "Șerban", "Radu"],
    companyWords: ["București", "Dâmbovița", "Carpați", "Unirea", "Tei", "Obor"],
    companySuffix: "SRL",
    citySamples: ["Bucharest"],
  },
  NG_LAGOS: {
    given: ["Chinedu", "Adeyemi", "Tunde", "Seun", "Emeka", "Chioma", "Zainab", "Folake", "Ngozi", "Abisola"],
    family: ["Okafor", "Oladele", "Okonkwo", "Babatunde", "Oyekunle", "Adebayo", "Eze", "Balogun", "Afolabi", "Nwosu"],
    companyWords: ["Lagos", "Eko", "Lekki", "Ikeja", "Marina", "Yaba"],
    companySuffix: "Limited",
    citySamples: ["Lagos"],
  },
  ZA_JOHANNESBURG: {
    given: ["Sipho", "Thabo", "Mandla", "Jabulani", "Lerato", "Naledi", "Thembi", "Nomusa", "Zanele", "Andile"],
    family: ["Mthembu", "Nkosi", "Dlamini", "Botha", "Pieterse", "van der Merwe", "Ndlovu", "Mokoena", "Khumalo", "Naidoo"],
    companyWords: ["Jozi", "Gauteng", "Sandton", "Rand", "Highveld", "Soweto"],
    companySuffix: "(Pty) Ltd",
    citySamples: ["Johannesburg", "Cape Town"],
  },
};

export function personName(market: string, r: () => number): string {
  const p = POOLS[market] ?? POOLS.EE_TALLINN;
  return `${pick(p.given, r)} ${pick(p.family, r)}`;
}

export function companyName(market: string, r: () => number): string {
  const p = POOLS[market] ?? POOLS.EE_TALLINN;
  return `${pick(p.companyWords, r)} ${pick(["Mobility", "Transport", "Rides", "Fleet", "Drive", "Logistics"], r)} ${p.companySuffix}`;
}

export function citySamples(market: string): string[] {
  return (POOLS[market] ?? POOLS.EE_TALLINN).citySamples;
}

export function plate(market: string, r: () => number): string {
  switch (market) {
    case "EE_TALLINN":
      return `${digits(3, r)} ${letters(3, r)}`;
    case "PL_WARSAW":
      return `W${letters(1, r)} ${digits(5, r)}`;
    case "PT_LISBON":
      return `${letters(2, r)}-${digits(2, r)}-${letters(2, r)}`;
    case "RO_BUCHAREST":
      return `B ${digits(2, r)} ${letters(3, r)}`;
    case "NG_LAGOS":
      return `${letters(3, r)}-${digits(3, r)}${letters(2, r)}`;
    case "ZA_JOHANNESBURG":
      return `${letters(3, r)} ${digits(3, r)} GP`;
    default:
      return `${digits(3, r)} ${letters(3, r)}`;
  }
}

export function vin(r: () => number): string {
  return letters(3, r) + digits(2, r) + letters(2, r) + digits(10, r).slice(0, 10);
}

const CAR_MAKES = [
  ["Toyota", "Corolla"],
  ["Volkswagen", "Passat"],
  ["Škoda", "Octavia"],
  ["Hyundai", "Elantra"],
  ["Kia", "Ceed"],
  ["Renault", "Mégane"],
  ["Mercedes-Benz", "E-Class"],
  ["BMW", "320i"],
];
export function vehicleMakeModel(r: () => number): { make: string; model: string; year: number } {
  const [make, model] = pick(CAR_MAKES, r);
  return { make, model, year: 2016 + Math.floor(r() * 9) };
}

/** Context available when generating a document's ground-truth field values. */
export interface DocContext {
  market: string;
  dateFormat: string;
  companyNm: string;
  ownerNm: string;
  driverNm: string;
  plate: string;
  vin: string;
  issuer: string;
  issuedAt: Date;
  expiresAt: Date;
  r: () => number;
  /** override specific field values (e.g. a deliberate name mismatch). */
  overrides?: Record<string, string>;
}

/** Produce a ground-truth value for one expected field, market-agnostically. */
export function fieldValue(field: ExpectedField, ctx: DocContext): string {
  if (ctx.overrides && field.key in ctx.overrides) return ctx.overrides[field.key];
  const key = field.key.toLowerCase();
  const r = ctx.r;
  if (field.type === "date") {
    const d = /issue|first|inspection(date)?/.test(key) ? ctx.issuedAt : ctx.expiresAt;
    return formatForMarket(d, ctx.dateFormat);
  }
  if (/holder|company|operator|entity|registered entity|titular/.test(key)) return ctx.companyNm;
  if (/owner|proprietar/.test(key)) return ctx.ownerNm;
  if (/driver|motorista|conduc|kierowca/.test(key)) return ctx.driverNm;
  if (/plate|matric|înmatric|registration$/.test(key)) return ctx.plate;
  if (key === "vin" || /șasiu|chassis/.test(key)) return ctx.vin;
  if (/issuer|autoritate|issuing/.test(key)) return ctx.issuer;
  if (/address|sediu|sede|adres/.test(key)) return `${10 + Math.floor(r() * 89)} ${pick(["Main", "Central", "Park", "Station", "Harbour"], r)} St`;
  if (/result|rezultat|wynik/.test(key)) return "No entries";
  if (/categor/.test(key)) return "B";
  if (/insurer|asigurator|seguradora|ubezpieczyciel/.test(key)) return pick(["AXA", "Allianz", "If P&C", "Generali", "PZU", "Tranquilidade", "Santam"], r);
  if (field.example) {
    // Derive from the example's shape: keep prefix, randomize trailing digits.
    return field.example.replace(/\d/g, () => String(Math.floor(r() * 10)));
  }
  if (field.type === "number") return String(100 + Math.floor(r() * 900));
  // generic id/number
  return letters(2, ctx.r).toUpperCase() + digits(6, ctx.r);
}

export function buildGroundTruth(spec: RequiredDocumentSpec, ctx: DocContext): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of spec.expectedFields) out[f.key] = fieldValue(f, ctx);
  return out;
}
