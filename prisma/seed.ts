import crypto from "crypto";
import { db } from "../lib/db";
import { listMarketCodes, getRulesetEntry, listAllEntries } from "../engine/rules/registry";
import type { MarketRuleset, RequiredDocumentSpec } from "../engine/types/ruleset";
import { storage } from "../engine/storage";
import { renderDocumentPdf, buildPdfSpec } from "./seed-lib/pdf";
import {
  rng,
  pick,
  personName,
  companyName,
  citySamples,
  plate as genPlate,
  vin as genVin,
  vehicleMakeModel,
  buildGroundTruth,
  type DocContext,
} from "./seed-lib/data";
import {
  SEED_ANCHOR,
  validWindow,
  expiringInDays,
  expiredWindow,
  anchorPlusDays,
  anchorPlusMonths,
} from "./seed-lib/dates";

const MARKET_META: Record<string, { iso2: string; cities: string[] }> = {
  EE_TALLINN: { iso2: "EE", cities: ["Tallinn"] },
  PL_WARSAW: { iso2: "PL", cities: ["Warsaw"] },
  PT_LISBON: { iso2: "PT", cities: ["Lisbon", "Porto"] },
  RO_BUCHAREST: { iso2: "RO", cities: ["Bucharest"] },
  NG_LAGOS: { iso2: "NG", cities: ["Lagos"] },
  ZA_JOHANNESBURG: { iso2: "ZA", cities: ["Johannesburg", "Cape Town"] },
};

const PARTNER_TYPE = "COMPANY" as const;
const store = storage();

let partnerSeq = 0;
let arrSeq = 0;

async function resetDb() {
  // delete in FK-safe order
  await db.aiCallLog.deleteMany();
  await db.auditLog.deleteMany();
  await db.reportField.deleteMany();
  await db.pipelineStage.deleteMany();
  await db.pipelineRun.deleteMany();
  await db.validation.deleteMany();
  await db.crossCheck.deleteMany();
  await db.riskAssessment.deleteMany();
  await db.complianceEvent.deleteMany();
  await db.partnerHistory.deleteMany();
  await db.documentGroundTruth.deleteMany();
  await db.trip.deleteMany();
  await db.document.deleteMany();
  await db.driver.deleteMany();
  await db.vehicle.deleteMany();
  await db.authorityRequest.deleteMany();
  await db.fleetPartner.deleteMany();
  await db.regulatoryRuleset.deleteMany();
  await db.market.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
  await db.appMeta.deleteMany();
}

async function seedUsers() {
  const password = "sentinel";
  const hash = crypto.createHash("sha256").update(password + "sentinel-salt").digest("hex");
  await db.user.create({ data: { email: "admin@bolt.eu", name: "Deb (Admin)", role: "ADMIN", roles: ["admin", "compliance_reviewer", "regulatory_author", "authority_liaison", "auditor"], passwordHash: hash } });
  await db.user.create({ data: { email: "reviewer@bolt.eu", name: "Rui Reviewer", role: "REVIEWER", roles: ["compliance_reviewer", "onboarding_officer", "compliance_monitor", "auditor"], passwordHash: hash } });
  return { password };
}

async function seedMarketsAndRulesets() {
  const marketIdByCode: Record<string, string> = {};
  for (const code of listMarketCodes()) {
    const entry = getRulesetEntry(code); // active/latest
    const rs = entry.ruleset;
    const meta = MARKET_META[code];
    // EE starts on v1 active (v2 is the "ruleset update" applied later in the re-flag scenario)
    const startVersion = code === "EE_TALLINN" ? 1 : entry.ruleset.version;
    const market = await db.market.create({
      data: {
        code,
        country: rs.country,
        countryIso2: meta.iso2,
        cities: meta.cities,
        regulatorName: rs.regulator.name,
        regulatorCode: rs.regulator.code,
        privacyRegime: rs.compliancePolicy.privacyRegime,
        region: rs.region,
        timezone: rs.timezone,
        currency: rs.currency,
        locale: rs.locale,
        activeRulesetVersion: startVersion,
      },
    });
    marketIdByCode[code] = market.id;
  }
  // ruleset rows (all versions) — DB is the single source of truth, so the full validated
  // MarketRuleset is written to `content`; code files are only the seed input.
  for (const e of listAllEntries()) {
    const marketId = marketIdByCode[e.ruleset.marketCode];
    const isEEv2 = e.ruleset.marketCode === "EE_TALLINN" && e.ruleset.version === 2;
    await db.regulatoryRuleset.create({
      data: {
        marketId,
        version: e.ruleset.version,
        filePath: e.filePath,
        contentHash: e.hash,
        content: e.ruleset as object,
        source: "SEED",
        status: "ACTIVE",
        summary: `${e.ruleset.country} ruleset v${e.ruleset.version}`,
        isActive: isEEv2 ? false : true, // EE v2 activated later
        changelog: isEEv2
          ? { added: ["DRIVER_BACKGROUND_CHECK required for companies/operators"], note: "Mandatory criminal-record extract introduced." }
          : undefined,
      },
    });
  }
  return marketIdByCode;
}

interface PartnerOptions {
  market: string;
  marketId: string;
  status?: string; // onboarding status
  monitoringStatus?: string;
  monitoringReason?: string;
  riskScore?: number;
  riskBand?: string;
  scenarioTag?: string;
  driverCount?: number;
  vehicleCount?: number;
  tripCount?: number;
  /** docTypes to omit (missing-doc scenario). */
  omitDocTypes?: string[];
  /** docType -> defect for rendering/data. */
  defects?: Record<string, "EXPIRED" | "NAME_MISMATCH" | "LOW_LEGIBILITY">;
  /** override some vehicle validity for B2 scenarios. */
  vehicleOverrides?: (i: number) => { inspectionDays?: number; registrationExpired?: boolean; insuranceDays?: number; addedRecently?: boolean };
  seed: number;
  onboardedMonthsAgo?: number;
}

async function createPartner(opts: PartnerOptions) {
  const r = rng(opts.seed);
  // Use the market's CURRENTLY-ACTIVE ruleset version (EE starts on v1) so a later v2 bump
  // genuinely re-flags these partners (they were assessed under v1, lack the v2-added document).
  const marketRow = await db.market.findUniqueOrThrow({ where: { id: opts.marketId }, select: { activeRulesetVersion: true } });
  const ruleset: MarketRuleset = getRulesetEntry(opts.market, marketRow.activeRulesetVersion).ruleset;
  const meta = MARKET_META[opts.market];
  partnerSeq++;
  const ref = `FP-${meta.iso2}-${String(partnerSeq).padStart(4, "0")}`;
  const company = companyName(opts.market, r);
  const owner = personName(opts.market, r);

  const partner = await db.fleetPartner.create({
    data: {
      reference: ref,
      marketId: opts.marketId,
      legalName: company,
      tradingName: company.replace(new RegExp(`\\s*${ruleset.country}|\\s*(OÜ|Sp\\. z o\\.o\\.|Lda\\.|SRL|Limited|\\(Pty\\) Ltd)$`), ""),
      partnerType: PARTNER_TYPE,
      registrationNo: `${meta.iso2}${100000 + Math.floor(r() * 899999)}`,
      contactEmail: `ops@${company.split(" ")[0].toLowerCase()}.example`,
      contactPhone: `+${10 + Math.floor(r() * 89)} ${100 + Math.floor(r() * 899)} ${100000 + Math.floor(r() * 899999)}`,
      address: { line1: `${10 + Math.floor(r() * 89)} ${pick(ruleset.zones, r)}`, city: citySamples(opts.market)[0], country: ruleset.country },
      status: opts.status ?? "APPROVED",
      monitoringStatus: opts.monitoringStatus ?? "COMPLIANT",
      monitoringReason: opts.monitoringReason,
      riskScore: opts.riskScore,
      riskBand: opts.riskBand,
      scenarioTag: opts.scenarioTag,
      lastAssessedAt: opts.status === "APPROVED" ? anchorPlusMonths(-(opts.onboardedMonthsAgo ?? 3)) : null,
      lastAssessedRulesetVersion: opts.status === "APPROVED" ? ruleset.version : null,
      onboardedAt: opts.status === "APPROVED" ? anchorPlusMonths(-(opts.onboardedMonthsAgo ?? 3)) : null,
    },
  });

  // Drivers
  const driverCount = opts.driverCount ?? 2 + Math.floor(r() * 3);
  const driverNames: string[] = [];
  for (let i = 0; i < driverCount; i++) {
    const name = personName(opts.market, r);
    driverNames.push(name);
    await db.driver.create({
      data: {
        partnerId: partner.id,
        fullName: name,
        nationalId: `${meta.iso2}${1000000000 + Math.floor(r() * 8999999999)}`.slice(0, 13),
        licenseNo: `${meta.iso2}-DL-${100000 + Math.floor(r() * 899999)}`,
        licenseExpiresAt: validWindow(60, r).expiresAt,
        status: "ACTIVE",
      },
    });
  }
  const primaryDriver = driverNames[0] ?? personName(opts.market, r);

  // Vehicles
  const vehicleCount = opts.vehicleCount ?? 2 + Math.floor(r() * 4);
  for (let i = 0; i < vehicleCount; i++) {
    const mm = vehicleMakeModel(r);
    const ov = opts.vehicleOverrides?.(i) ?? {};
    const inspectionValidUntil = ov.inspectionDays != null ? anchorPlusDays(ov.inspectionDays) : validWindow(12, r).expiresAt;
    const insuranceValidUntil = ov.insuranceDays != null ? anchorPlusDays(ov.insuranceDays) : validWindow(12, r).expiresAt;
    const registrationValidUntil = ov.registrationExpired ? anchorPlusDays(-(20 + Math.floor(r() * 200))) : validWindow(120, r).expiresAt;
    await db.vehicle.create({
      data: {
        partnerId: partner.id,
        plate: genPlate(opts.market, r),
        vin: genVin(r),
        make: mm.make,
        model: mm.model,
        year: mm.year,
        registrationNo: `REG-${100000 + Math.floor(r() * 899999)}`,
        registrationValidUntil,
        insuranceValidUntil,
        inspectionValidUntil,
        status: ov.registrationExpired ? "PENDING_DOCS" : "ACTIVE",
        addedAt: ov.addedRecently ? anchorPlusDays(-(3 + Math.floor(r() * 12))) : anchorPlusMonths(-(opts.onboardedMonthsAgo ?? 3)),
      },
    });
  }

  // Trips (spread over the last 180 days; biased to include central zones)
  const tripCount = opts.tripCount ?? 30 + Math.floor(r() * 50);
  const drivers = await db.driver.findMany({ where: { partnerId: partner.id } });
  const vehicles = await db.vehicle.findMany({ where: { partnerId: partner.id } });
  const tripData = [];
  for (let i = 0; i < tripCount; i++) {
    const daysAgo = Math.floor(r() * 180);
    const startedAt = anchorPlusDays(-daysAgo);
    const dur = 8 + Math.floor(r() * 45);
    const zone = r() < 0.4 ? ruleset.zones[0] : pick(ruleset.zones, r); // bias toward the central zone
    tripData.push({
      partnerId: partner.id,
      driverId: drivers.length ? pick(drivers, r).id : null,
      vehicleId: vehicles.length ? pick(vehicles, r).id : null,
      startedAt,
      endedAt: new Date(startedAt.getTime() + dur * 60000),
      distanceKm: Math.round((2 + r() * 25) * 10) / 10,
      fareMinor: 300 + Math.floor(r() * 4000),
      zone,
      city: citySamples(opts.market)[0],
    });
  }
  await db.trip.createMany({ data: tripData });

  // Documents (one per applicable required docType) with ground truth + rendered PDF
  const issuer = ruleset.regulator.name;
  let presentDocs = 0;
  const applicable = ruleset.requiredDocuments.filter((d) => d.requiredFor.includes(PARTNER_TYPE));
  for (const spec of applicable) {
    if (opts.omitDocTypes?.includes(spec.docType)) continue;
    presentDocs++;
    const defect = opts.defects?.[spec.docType];
    const validity = spec.validityMonths ?? 12;
    const window =
      defect === "EXPIRED" ? expiredWindow(15 + Math.floor(r() * 120), validity) : validWindow(validity, r);

    const overrides: Record<string, string> = {};
    if (defect === "NAME_MISMATCH") {
      // holder/company field carries a DIFFERENT entity name than the partner's registered company
      const wrong = companyName(opts.market, rng(opts.seed + 999));
      for (const f of spec.expectedFields) {
        if (/holder|company|operator|entity|titular|registered entity/i.test(f.key)) overrides[f.key] = wrong;
      }
    }

    const ctx: DocContext = {
      market: opts.market,
      dateFormat: ruleset.reportFormat.dateFormat,
      companyNm: company,
      ownerNm: owner,
      driverNm: primaryDriver,
      plate: genPlate(opts.market, r),
      vin: genVin(r),
      issuer,
      issuedAt: window.issuedAt,
      expiresAt: window.expiresAt,
      r,
      overrides,
    };
    const gt = buildGroundTruth(spec, ctx);

    const pdf = await renderDocumentPdf(
      buildPdfSpec({
        docType: spec.docType,
        label: spec.label,
        country: ruleset.country,
        authority: issuer,
        expectedFields: spec.expectedFields,
        gt,
        issuedAt: window.issuedAt,
        expiresAt: window.expiresAt,
        dateFormat: ruleset.reportFormat.dateFormat,
        expired: defect === "EXPIRED",
        reference: `${spec.docType}/${ref}`,
        lowLegibility: defect === "LOW_LEGIBILITY",
        partnerName: company,
      }),
    );
    const key = `documents/${partner.id}/${spec.docType}.pdf`;
    const stored = await store.put(key, pdf, "application/pdf");

    const doc = await db.document.create({
      data: {
        marketId: opts.marketId,
        partnerId: partner.id,
        docType: spec.docType,
        title: spec.label,
        storageRef: stored.ref,
        mimeType: "application/pdf",
        byteSize: stored.size,
        sha256: stored.sha256,
        status: opts.status === "APPROVED" ? "VALIDATED" : "UPLOADED",
        issuedAt: window.issuedAt,
        expiresAt: window.expiresAt,
        extractionConfidence: defect === "LOW_LEGIBILITY" ? 0.42 : null,
      },
    });
    await db.documentGroundTruth.create({
      data: {
        documentId: doc.id,
        fields: gt,
        injectedDefects: defect ? [{ type: defect }] : undefined,
        generatorSeed: String(opts.seed),
      },
    });
  }

  const completenessPct = Math.round((presentDocs / Math.max(1, applicable.length)) * 100);
  await db.fleetPartner.update({ where: { id: partner.id }, data: { completenessPct } });

  if (opts.status === "APPROVED") {
    await db.partnerHistory.create({
      data: { partnerId: partner.id, kind: "ONBOARDED", detail: { note: "Onboarded (historical)." }, occurredAt: partner.onboardedAt ?? SEED_ANCHOR },
    });
  }
  return partner;
}

async function createArrRequest(args: {
  market: string;
  marketId: string;
  title: string;
  authority: string;
  legalBasis: string;
  rawText: string;
  scenarioTag: string;
  deadlineDays: number;
}) {
  const meta = MARKET_META[args.market];
  arrSeq++;
  return db.authorityRequest.create({
    data: {
      reference: `ARR-${meta.iso2}-${String(arrSeq).padStart(4, "0")}`,
      marketId: args.marketId,
      title: args.title,
      authority: args.authority,
      legalBasis: args.legalBasis,
      source: "TEXT",
      rawText: args.rawText,
      status: "RECEIVED",
      scenarioTag: args.scenarioTag,
      receivedAt: anchorPlusDays(-(1 + Math.floor(Math.random() * 3))),
      deadlineAt: anchorPlusDays(args.deadlineDays),
      manualBaselineMinutes: 240,
    },
  });
}

async function main() {
  console.log(`Seeding Bolt Sentinel (anchor ${SEED_ANCHOR.toISOString().slice(0, 10)})…`);
  await resetDb();
  const { password } = await seedUsers();
  const marketIdByCode = await seedMarketsAndRulesets();
  let seed = 1000;

  // ── Base portfolio: onboarded + compliant partners per market ──────────────
  for (const code of listMarketCodes()) {
    for (let i = 0; i < 5; i++) {
      const risk = 8 + Math.floor(Math.random() * 38);
      await createPartner({
        market: code,
        marketId: marketIdByCode[code],
        status: "APPROVED",
        monitoringStatus: "COMPLIANT",
        riskScore: risk,
        riskBand: risk < 34 ? "LOW" : "MEDIUM",
        onboardedMonthsAgo: 2 + Math.floor(Math.random() * 6),
        seed: seed++,
      });
    }
  }

  // ── B1 onboarding-queue scenarios (status RECEIVED — processed live) ────────
  await createPartner({ market: "PT_LISBON", marketId: marketIdByCode["PT_LISBON"], status: "RECEIVED", scenarioTag: "b1-clean", seed: seed++ });
  await createPartner({
    market: "PT_LISBON", marketId: marketIdByCode["PT_LISBON"], status: "RECEIVED", scenarioTag: "b1-name-mismatch",
    defects: { TVDE_OPERATOR_LICENSE: "NAME_MISMATCH" }, seed: seed++,
  });
  await createPartner({
    market: "PL_WARSAW", marketId: marketIdByCode["PL_WARSAW"], status: "RECEIVED", scenarioTag: "b1-missing-doc",
    omitDocTypes: ["DRIVER_CRIMINAL_RECORD"], seed: seed++,
  });
  await createPartner({
    market: "PT_LISBON", marketId: marketIdByCode["PT_LISBON"], status: "RECEIVED", scenarioTag: "b1-low-confidence",
    defects: { TVDE_OPERATOR_LICENSE: "LOW_LEGIBILITY" }, seed: seed++,
  });

  // ── B2 monitoring scenarios ────────────────────────────────────────────────
  // (a) two vehicle inspections expiring in 21 days
  const expiring = await createPartner({
    market: "EE_TALLINN", marketId: marketIdByCode["EE_TALLINN"], status: "APPROVED",
    monitoringStatus: "EXPIRING_SOON", monitoringReason: "2 vehicle inspections lapse within 21 days",
    riskScore: 58, riskBand: "MEDIUM", scenarioTag: "b2-expiring", vehicleCount: 4,
    vehicleOverrides: (i) => (i < 2 ? { inspectionDays: 21 } : {}), seed: seed++,
  });
  await db.complianceEvent.create({
    data: { marketId: marketIdByCode["EE_TALLINN"], partnerId: expiring.id, type: "EXPIRY_FORECAST", severity: "HIGH",
      title: "2 vehicle inspections lapse within 21 days", detail: { count: 2, kind: "VEHICLE_INSPECTION" }, dueAt: anchorPlusDays(21) },
  });

  // (b) vehicles added without valid registration (drift)
  const drift = await createPartner({
    market: "EE_TALLINN", marketId: marketIdByCode["EE_TALLINN"], status: "APPROVED",
    monitoringStatus: "DRIFT_DETECTED", monitoringReason: "2 vehicles added without valid registration",
    riskScore: 64, riskBand: "MEDIUM", scenarioTag: "b2-drift", vehicleCount: 5,
    vehicleOverrides: (i) => (i >= 3 ? { registrationExpired: true, addedRecently: true } : {}), seed: seed++,
  });
  await db.complianceEvent.create({
    data: { marketId: marketIdByCode["EE_TALLINN"], partnerId: drift.id, type: "DRIFT_DETECTED", severity: "MEDIUM",
      title: "2 vehicles added without valid registration", detail: { count: 2 }, occurredAt: anchorPlusDays(-5) },
  });

  // (c) insurance renewal pending re-validation
  const renewal = await createPartner({
    market: "PL_WARSAW", marketId: marketIdByCode["PL_WARSAW"], status: "APPROVED",
    monitoringStatus: "EXPIRING_SOON", monitoringReason: "Insurance expiring in 10 days; renewed document submitted",
    riskScore: 47, riskBand: "MEDIUM", scenarioTag: "b2-renewal", vehicleCount: 3,
    vehicleOverrides: (i) => (i === 0 ? { insuranceDays: 10 } : {}), seed: seed++,
  });
  // add a renewed (newer) insurance document for re-validation
  {
    const renewedKey = `documents/${renewal.id}/VEHICLE_INSURANCE_RENEWED.pdf`;
    const renewedPdf = await renderDocumentPdf({
      kind: "insurance",
      documentLabel: "Ubezpieczenie OC (Renewed)",
      authorityName: "PZU S.A.",
      authoritySubline: "Certificate of motor insurance",
      country: "Poland",
      numberLabel: "Policy No.",
      docNumber: "OC-2026-998877",
      subject: [
        { label: "Insured", value: renewal.legalName },
        { label: "Vehicle", value: "WX 44218" },
      ],
      issuedAtText: "02.06.2026",
      expiresAtText: "30.06.2027",
      expired: false,
      rows: [
        { label: "Insurer", value: "PZU S.A." },
        { label: "Cover", value: "OC (third-party liability)" },
        { label: "Vehicle plate", value: "WX 44218" },
      ],
      reference: `VEHICLE_INSURANCE_RENEWED/${renewal.reference}`,
    });
    const stored = await store.put(renewedKey, renewedPdf, "application/pdf");
    await db.document.create({
      data: { marketId: marketIdByCode["PL_WARSAW"], partnerId: renewal.id, docType: "VEHICLE_INSURANCE", title: "Ubezpieczenie OC (Renewed)",
        storageRef: stored.ref, mimeType: "application/pdf", byteSize: stored.size, sha256: stored.sha256, status: "UPLOADED",
        issuedAt: anchorPlusDays(-2), expiresAt: anchorPlusMonths(12) },
    });
    await db.complianceEvent.create({
      data: { marketId: marketIdByCode["PL_WARSAW"], partnerId: renewal.id, type: "RENEWAL", severity: "INFO",
        title: "Renewed insurance submitted — awaiting re-validation", occurredAt: anchorPlusDays(-1) },
    });
  }

  // (d) Estonia ruleset update → re-flag previously-compliant partners
  await db.regulatoryRuleset.updateMany({ where: { marketId: marketIdByCode["EE_TALLINN"], version: 1 }, data: { isActive: false } });
  await db.regulatoryRuleset.updateMany({ where: { marketId: marketIdByCode["EE_TALLINN"], version: 2 }, data: { isActive: true } });
  await db.market.update({ where: { id: marketIdByCode["EE_TALLINN"] }, data: { activeRulesetVersion: 2 } });
  const eeStale = await db.fleetPartner.findMany({
    where: { marketId: marketIdByCode["EE_TALLINN"], status: "APPROVED", lastAssessedRulesetVersion: 1, monitoringStatus: "COMPLIANT" },
    take: 2,
  });
  for (const p of eeStale) {
    await db.fleetPartner.update({
      where: { id: p.id },
      data: { monitoringStatus: "PENDING_REVIEW", monitoringReason: "Ruleset updated to v2 — criminal-record extract now required", scenarioTag: "b2-reflag" },
    });
    await db.complianceEvent.create({
      data: { marketId: marketIdByCode["EE_TALLINN"], partnerId: p.id, type: "RULESET_REFLAG", severity: "MEDIUM",
        title: "Re-flagged: ruleset updated to v2 (new required document)", detail: { from: 1, to: 2, added: "DRIVER_BACKGROUND_CHECK" }, occurredAt: anchorPlusDays(-2) },
    });
    await db.partnerHistory.create({
      data: { partnerId: p.id, kind: "RULESET_REFLAG", detail: { from: 1, to: 2 }, occurredAt: anchorPlusDays(-2) },
    });
  }

  // ── ARR scenario requests (status RECEIVED — processed live) ────────────────
  await createArrRequest({
    market: "EE_TALLINN", marketId: marketIdByCode["EE_TALLINN"],
    title: "Q1 2026 driver compliance & trips — Kesklinn zone", authority: "Transpordiamet (Estonian Transport Administration)",
    legalBasis: "Ühistranspordiseadus (Public Transport Act) §-d",
    rawText:
      "Pursuant to the Public Transport Act, the Transport Administration (Transpordiamet) requests, in respect of your ride-hailing operations in the Kesklinn (central) zone of Tallinn for the first quarter of 2026 (1 January – 31 March 2026): (1) the number of active drivers and the number holding a valid driving licence; (2) the validity status of each driver's licence; and (3) the total number of completed trips in the zone during the period. Please respond within 10 business days.",
    scenarioTag: "arr-tallinn-clean", deadlineDays: 14,
  });
  await createArrRequest({
    market: "PL_WARSAW", marketId: marketIdByCode["PL_WARSAW"],
    title: "Przejazdy i ważność licencji — Śródmieście", authority: "Prezydent m.st. Warszawy",
    legalBasis: "Ustawa o transporcie drogowym",
    rawText:
      "Prezydent m.st. Warszawy zwraca się o przekazanie liczby zrealizowanych przejazdów w dzielnicy Śródmieście oraz statusu ważności licencji kierowców za okres wskazany w naszym wcześniejszym piśmie (sygn. UM-ŚR-2026/114), którego kopię Państwo posiadają. (The municipality requests the number of completed trips in Śródmieście and driver licence-validity status for the period specified in our earlier letter ref. UM-ŚR-2026/114, a copy of which you hold.)",
    scenarioTag: "arr-warsaw-ambiguous", deadlineDays: 10,
  });
  await createArrRequest({
    market: "NG_LAGOS", marketId: marketIdByCode["NG_LAGOS"],
    title: "Driver roster & trips — Lekki", authority: "Lagos State Ministry of Transportation",
    legalBasis: "Lagos State Online-Hailing Regulations",
    rawText:
      "The Lagos State Ministry of Transportation requests a full list of all drivers operating under your service entity in Lekki, including each driver's full name, personal details and LASDRI number, to be transmitted to the Ministry's central registry. Provide also the total number of completed trips in Q1 2026 (January–March 2026).",
    scenarioTag: "arr-lagos-ndpa", deadlineDays: 12,
  });
  await createArrRequest({
    market: "ZA_JOHANNESBURG", marketId: marketIdByCode["ZA_JOHANNESBURG"],
    title: "Driver vetting confirmation — Sandton", authority: "National Public Transport Regulator (NPTR)",
    legalBasis: "National Land Transport Act, 2009",
    rawText:
      "Under the National Land Transport Act, the NPTR requests confirmation of the number of active drivers and, for each driver, their criminal-record status, in the Sandton area for Q1 2026 (January–March 2026).",
    scenarioTag: "arr-joburg-overreach", deadlineDays: 12,
  });
  await createArrRequest({
    market: "PT_LISBON", marketId: marketIdByCode["PT_LISBON"],
    title: "Motoristas TVDE e viagens — Baixa de Lisboa", authority: "Instituto da Mobilidade e dos Transportes (IMT)",
    legalBasis: "Regime jurídico TVDE (Lei n.º 45/2018)",
    rawText:
      "O IMT solicita, ao abrigo do regime TVDE, o número de motoristas ativos com certificado TVDE válido e o total de viagens concluídas na zona da Baixa de Lisboa no primeiro trimestre de 2026 (1 de janeiro a 31 de março de 2026).",
    scenarioTag: "arr-lisbon-clean", deadlineDays: 14,
  });
  await createArrRequest({
    market: "RO_BUCHAREST", marketId: marketIdByCode["RO_BUCHAREST"],
    title: "Conducători și curse — Sectorul 1", authority: "Autoritatea Rutieră Română (ARR)",
    legalBasis: "OUG 49/2019 privind transportul alternativ",
    rawText:
      "ARR solicită numărul de conducători activi cu atestat profesional valabil și numărul total de curse finalizate în Sectorul 1 al municipiului București în primul trimestru al anului 2026 (1 ianuarie – 31 martie 2026).",
    scenarioTag: "arr-bucharest-clean", deadlineDays: 14,
  });

  await db.appMeta.create({ data: { key: "seedAnchor", value: { date: SEED_ANCHOR.toISOString() } } });
  await db.appMeta.create({ data: { key: "seededAt", value: { date: new Date().toISOString() } } });

  const counts = {
    markets: await db.market.count(),
    partners: await db.fleetPartner.count(),
    documents: await db.document.count(),
    drivers: await db.driver.count(),
    vehicles: await db.vehicle.count(),
    trips: await db.trip.count(),
    requests: await db.authorityRequest.count(),
  };
  console.log("Seed complete:", counts);
  console.log(`\nSign in:\n  admin@bolt.eu  /  ${password}  (ADMIN)\n  reviewer@bolt.eu  /  ${password}  (REVIEWER)`);
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
