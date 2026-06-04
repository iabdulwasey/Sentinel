import { defineRuleset } from "../../../types/ruleset";

/**
 * Poland (Warsaw) — taxi license-extract regime, "TAXI" vehicle markings, EU/GDPR.
 * Authority: Prezydent m.st. Warszawy (municipal). Illustrative synthetic ruleset.
 */
export default defineRuleset({
  marketCode: "PL_WARSAW",
  version: 1,
  country: "Poland",
  regulator: { name: "Prezydent m.st. Warszawy / Biuro Administracji i Spraw Obywatelskich", code: "UMSTW" },
  region: "EU",
  timezone: "Europe/Warsaw",
  currency: "PLN",
  locale: "pl",
  zones: ["Śródmieście", "Mokotów", "Praga-Północ", "Wola", "Ochota", "Ursynów", "Wilanów", "Wawer"],

  requiredDocuments: [
    {
      docType: "TAXI_LICENSE",
      label: "Licencja taksówkowa (Taxi licence)",
      requiredFor: ["COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "holderName", label: "Licence holder", type: "string", piiClass: "PERSONAL", required: true, example: "Warszawa Mobility Sp. z o.o." },
        { key: "licenseNumber", label: "Licence number", type: "string", required: true, example: "WA/TAXI/2026/0418" },
        { key: "issuer", label: "Issuing authority", type: "string", required: true, example: "Prezydent m.st. Warszawy" },
        { key: "expiryDate", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "PL.TAXI_LICENSE.NOT_EXPIRED", description: "Licence must be valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Taxi licence has expired.", lawfulBasisTag: "legal_obligation" },
        { id: "PL.TAXI_LICENSE.NUMBER_FORMAT", description: "Licence number format", field: "licenseNumber", operator: "MATCHES_REGEX", value: "^WA/TAXI/\\d{4}/\\d{4}$", severity: "MEDIUM", failMessage: "Licence number does not match WA/TAXI/YYYY/#### format." },
      ],
      validityMonths: 60,
    },
    {
      docType: "LICENSE_EXTRACT",
      label: "Wypis z licencji (Licence extract)",
      requiredFor: ["COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "licenseNumber", label: "Parent licence number", type: "string", required: true },
        { key: "vehiclePlate", label: "Vehicle plate", type: "string", required: true, example: "WA 12345" },
        { key: "expiryDate", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "PL.LICENSE_EXTRACT.NOT_EXPIRED", description: "Extract must be valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "HIGH", failMessage: "Licence extract has expired." },
        { id: "PL.LICENSE_EXTRACT.PLATE_FORMAT", description: "Warsaw plate format", field: "vehiclePlate", operator: "MATCHES_REGEX", value: "^W[A-Z] [A-Z0-9]{4,5}$", severity: "LOW", failMessage: "Plate does not match Warsaw format." },
      ],
      validityMonths: 60,
    },
    {
      docType: "BUSINESS_REGISTRATION",
      label: "Wpis CEIDG/KRS (Business registration, NIP)",
      requiredFor: ["COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "companyName", label: "Company name", type: "string", piiClass: "PERSONAL", required: true },
        { key: "nip", label: "NIP", type: "string", required: true, example: "1234567890" },
        { key: "address", label: "Registered address", type: "string", piiClass: "PERSONAL", required: true },
      ],
      validations: [
        { id: "PL.BUSINESS_REGISTRATION.NIP_FORMAT", description: "10-digit NIP", field: "nip", operator: "MATCHES_REGEX", value: "^\\d{10}$", severity: "HIGH", failMessage: "NIP must be 10 digits." },
      ],
      validityMonths: 12,
    },
    {
      docType: "VEHICLE_REGISTRATION",
      label: "Dowód rejestracyjny z adnotacją TAXI (Registration with TAXI annotation)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "plate", label: "Plate", type: "string", required: true, example: "WA 12345" },
        { key: "vin", label: "VIN", type: "string", required: true },
        { key: "owner", label: "Owner", type: "string", piiClass: "PERSONAL", required: true },
        { key: "taxiAnnotation", label: "TAXI annotation", type: "string", required: true, example: "TAXI" },
      ],
      validations: [
        { id: "PL.VEHICLE_REGISTRATION.TAXI_ANNOTATION", description: "Must carry TAXI annotation", field: "taxiAnnotation", operator: "MATCHES_REGEX", value: "TAXI", severity: "HIGH", failMessage: "Registration is missing the required TAXI annotation." },
        { id: "PL.VEHICLE_REGISTRATION.VIN_FORMAT", description: "17-char VIN", field: "vin", operator: "MATCHES_REGEX", value: "^[A-HJ-NPR-Z0-9]{17}$", severity: "MEDIUM", failMessage: "VIN must be 17 characters." },
      ],
      validityMonths: 120,
    },
    {
      docType: "VEHICLE_INSPECTION",
      label: "Przegląd techniczny (Technical inspection)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "plate", label: "Plate", type: "string", required: true },
        { key: "validUntil", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "PL.VEHICLE_INSPECTION.NOT_EXPIRED", description: "Inspection valid", field: "validUntil", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Technical inspection has lapsed." },
      ],
      validityMonths: 12,
    },
    {
      docType: "VEHICLE_INSURANCE",
      label: "Ubezpieczenie OC (Motor third-party insurance)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "insurer", label: "Insurer", type: "string", required: true },
        { key: "policyNumber", label: "Policy number", type: "string", required: true },
        { key: "vehiclePlate", label: "Vehicle plate", type: "string", required: true },
        { key: "expiryDate", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "PL.VEHICLE_INSURANCE.NOT_EXPIRED", description: "Insurance valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Vehicle insurance has expired." },
      ],
      validityMonths: 12,
    },
    {
      docType: "DRIVER_CRIMINAL_RECORD",
      label: "Zaświadczenie o niekaralności (Criminal-record certificate)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "driverName", label: "Driver", type: "string", piiClass: "PERSONAL", required: true },
        { key: "issueDate", label: "Issue date", type: "date", required: true },
        { key: "result", label: "Result", type: "string", required: true, example: "Brak wpisów" },
      ],
      validations: [
        { id: "PL.DRIVER_CRIMINAL_RECORD.PRESENT", description: "Result present", field: "result", operator: "NOT_EMPTY", severity: "HIGH", failMessage: "Criminal-record result missing." },
      ],
      validityMonths: 1,
    },
  ],

  crossDocumentChecks: [
    { id: "PL.NAME_CONSISTENCY", description: "Licence holder matches registered company", docTypeA: "TAXI_LICENSE", docTypeB: "BUSINESS_REGISTRATION", fieldA: "holderName", fieldB: "companyName", operator: "CROSS_FIELD_EQUALS", severity: "HIGH", failMessage: "Taxi-licence holder does not match the registered company name." },
    { id: "PL.EXTRACT_LICENCE_LINK", description: "Extract references the parent licence", docTypeA: "LICENSE_EXTRACT", docTypeB: "TAXI_LICENSE", fieldA: "licenseNumber", fieldB: "licenseNumber", operator: "CROSS_FIELD_EQUALS", severity: "MEDIUM", failMessage: "Licence extract does not reference the operator's licence number." },
  ],

  authorityFields: [
    { key: "active_drivers_count", label: "Aktywni kierowcy (Active drivers)", classification: "ANSWERABLE", description: "Count of drivers currently active.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Driver", aggregation: "count", filterRuleIds: ["active"] }, lawfulBasisTag: "legal_obligation" },
    { key: "drivers_with_valid_license_count", label: "Kierowcy z ważnym prawem jazdy", classification: "ANSWERABLE", description: "Active drivers with an unexpired licence.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Driver", aggregation: "count", filterRuleIds: ["active", "license_valid"] }, lawfulBasisTag: "legal_obligation" },
    { key: "driver_license_status_list", label: "Status prawa jazdy (per kierowca)", classification: "ANSWERABLE", description: "Per-driver licence validity, disclosed under legal obligation.", dataClass: "PII_DIRECT", source: { entity: "Driver", aggregation: "list", field: "licenseExpiresAt" }, lawfulBasisTag: "legal_obligation" },
    { key: "completed_trips_count", label: "Zrealizowane przejazdy (strefa/okres)", classification: "ANSWERABLE", description: "Completed trips filtered by zone/period.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Trip", aggregation: "count" }, lawfulBasisTag: "legal_obligation" },
    { key: "active_vehicles_count", label: "Aktywne pojazdy (Active vehicles)", classification: "ANSWERABLE", description: "Count of active vehicles.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Vehicle", aggregation: "count", filterRuleIds: ["active"] }, lawfulBasisTag: "legal_obligation" },
    { key: "vehicles_with_valid_inspection_count", label: "Pojazdy z ważnym przeglądem", classification: "ANSWERABLE", description: "Active vehicles with a valid inspection.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Vehicle", aggregation: "count", filterRuleIds: ["active", "inspection_valid"] }, lawfulBasisTag: "legal_obligation" },
    { key: "fleet_partners_list", label: "Partnerzy flotowi + numery licencji", classification: "ANSWERABLE", description: "Fleet partners with licence numbers.", dataClass: "PII_DIRECT", source: { entity: "FleetPartner", aggregation: "list" }, lawfulBasisTag: "legal_obligation" },
  ],

  namedFilters: {
    active: { description: "Active status", field: "status", operator: "EQUALS", value: "ACTIVE" },
    license_valid: { description: "Driving licence unexpired", field: "licenseExpiresAt", operator: "DATE_NOT_EXPIRED" },
    inspection_valid: { description: "Vehicle inspection unexpired", field: "inspectionValidUntil", operator: "DATE_NOT_EXPIRED" },
  },

  reportFormat: {
    formatId: "PL_UMSTW_STANDARD_V1",
    mandatedBy: "Prezydent m.st. Warszawy",
    delivery: "BOTH",
    sections: [
      { id: "subject", heading: "Przedmiot wniosku (Subject of request)", fieldKeys: [], required: true },
      { id: "drivers", heading: "Zgodność kierowców (Driver compliance)", fieldKeys: ["active_drivers_count", "drivers_with_valid_license_count", "driver_license_status_list"], required: true },
      { id: "trips", heading: "Podsumowanie przejazdów (Trip summary)", fieldKeys: ["completed_trips_count"], required: true },
      { id: "vehicles", heading: "Zgodność pojazdów (Vehicle compliance)", fieldKeys: ["active_vehicles_count", "vehicles_with_valid_inspection_count"], required: false },
    ],
    header: { logoText: "Bolt Sentinel", legalNotice: "Złożono na wniosek Prezydenta m.st. Warszawy." },
    footer: { signatureBlock: true, legalNotice: "Dane są prawdziwe na dzień złożenia." },
    dateFormat: "DD.MM.YYYY",
    numberFormat: { decimal: ",", thousands: " " },
    language: "pl",
  },

  compliancePolicy: {
    privacyRegime: "GDPR",
    dataResidency: { storageRegion: "EU", crossBorderTransferAllowed: true, allowedTransferRegions: ["EU"], note: "Intra-EU/EEA transfers permitted under GDPR; non-EEA transfers require Article 46 safeguards." },
    piiClassification: [
      { fieldKey: "driverName", piiClass: "PERSONAL" },
      { fieldKey: "address", piiClass: "PERSONAL" },
      { fieldKey: "result", piiClass: "SENSITIVE" },
    ],
    lawfulBases: [
      { tag: "legal_obligation", label: "Compliance with a legal obligation (GDPR Art. 6(1)(c))", appliesToFieldKeys: ["active_drivers_count", "drivers_with_valid_license_count", "driver_license_status_list", "completed_trips_count", "active_vehicles_count", "vehicles_with_valid_inspection_count", "fleet_partners_list"] },
    ],
    purposeLimitation: { declaredPurposes: ["regulatory_reporting", "fleet_compliance"], restrictedDisclosureFieldKeys: [] },
    retention: { documentRetentionMonths: 60, auditLogRetentionMonths: 84, autoPurgeAfterRetention: false },
  },

  riskModel: {
    factors: [
      { id: "completeness", label: "Document completeness", weight: 0.3, deriveFrom: "Share of required documents present and valid." },
      { id: "expiry_proximity", label: "Expiry proximity", weight: 0.25, deriveFrom: "Documents expiring within 30 days." },
      { id: "inconsistencies", label: "Cross-document inconsistencies", weight: 0.3, deriveFrom: "Failed cross-checks." },
      { id: "fleet_size", label: "Fleet size exposure", weight: 0.15, deriveFrom: "Vehicles/drivers under the partner." },
    ],
    bands: { low: [0, 33], medium: [34, 66], high: [67, 100] },
  },
});
