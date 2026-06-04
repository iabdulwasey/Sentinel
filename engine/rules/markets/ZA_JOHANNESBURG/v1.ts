import { defineRuleset } from "../../../types/ruleset";

/**
 * South Africa (Johannesburg/Cape Town) — NLTA operating-licence regime, POPIA (non-EU).
 * Authority: NPTR / provincial regulatory entity. POPIA s.72 restricts cross-border transfer
 * and s.26 protects "special personal information" (e.g. criminal records). Illustrative.
 */
export default defineRuleset({
  marketCode: "ZA_JOHANNESBURG",
  version: 1,
  country: "South Africa",
  regulator: { name: "National Public Transport Regulator (NPTR) / Gauteng PRE", code: "NPTR" },
  region: "ZA",
  timezone: "Africa/Johannesburg",
  currency: "ZAR",
  locale: "en",
  zones: ["Sandton", "Midrand", "Randburg", "Soweto", "Roodepoort", "Johannesburg CBD", "Cape Town CBD", "Atlantic Seaboard"],

  requiredDocuments: [
    {
      docType: "OPERATING_LICENCE",
      label: "Operating Licence (NLTA s.50)",
      requiredFor: ["COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "holderName", label: "Licence holder", type: "string", piiClass: "PERSONAL", required: true, example: "Jozi Mobility (Pty) Ltd" },
        { key: "licenceNumber", label: "Licence number", type: "string", required: true, example: "NPTR-GP-204418" },
        { key: "expiryDate", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "ZA.OPERATING_LICENCE.NOT_EXPIRED", description: "Operating licence valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Operating licence has expired.", lawfulBasisTag: "legal_obligation" },
        { id: "ZA.OPERATING_LICENCE.NUMBER_FORMAT", description: "Licence format", field: "licenceNumber", operator: "MATCHES_REGEX", value: "^NPTR-[A-Z]{2}-\\d{6}$", severity: "MEDIUM", failMessage: "Licence number does not match NPTR-GP-###### format." },
      ],
      validityMonths: 84,
    },
    {
      docType: "NPTR_REGISTRATION_CERTIFICATE",
      label: "NPTR Registration Certificate",
      requiredFor: ["COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "holderName", label: "Registered entity", type: "string", piiClass: "PERSONAL", required: true },
        { key: "certificateNumber", label: "Certificate number", type: "string", required: true },
        { key: "expiryDate", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "ZA.NPTR_REGISTRATION_CERTIFICATE.NOT_EXPIRED", description: "Registration valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "HIGH", failMessage: "NPTR registration certificate has expired." },
      ],
      validityMonths: 24,
    },
    {
      docType: "PRDP",
      label: "Professional Driving Permit (PrDP)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "driverName", label: "Driver", type: "string", piiClass: "PERSONAL", required: true },
        { key: "prdpNumber", label: "PrDP number", type: "string", piiClass: "PERSONAL", required: true },
        { key: "expiryDate", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "ZA.PRDP.NOT_EXPIRED", description: "PrDP valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Professional Driving Permit (PrDP) has expired." },
      ],
      validityMonths: 24,
    },
    {
      docType: "VEHICLE_ROADWORTHINESS",
      label: "Certificate of Roadworthiness (CoR)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "plate", label: "Registration", type: "string", required: true, example: "ABC 123 GP" },
        { key: "validUntil", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "ZA.VEHICLE_ROADWORTHINESS.NOT_EXPIRED", description: "Roadworthiness valid", field: "validUntil", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Certificate of Roadworthiness has lapsed." },
        { id: "ZA.VEHICLE_ROADWORTHINESS.PLATE_FORMAT", description: "GP plate format", field: "plate", operator: "MATCHES_REGEX", value: "^[A-Z]{3} \\d{3} GP$", severity: "LOW", failMessage: "Plate does not match the Gauteng 'ABC 123 GP' format." },
      ],
      validityMonths: 12,
    },
    {
      docType: "VEHICLE_INSURANCE",
      label: "Passenger-Transport Insurance",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "insurer", label: "Insurer", type: "string", required: true },
        { key: "policyNumber", label: "Policy number", type: "string", required: true },
        { key: "vehiclePlate", label: "Registration", type: "string", required: true },
        { key: "expiryDate", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "ZA.VEHICLE_INSURANCE.NOT_EXPIRED", description: "Insurance valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Vehicle insurance has expired." },
      ],
      validityMonths: 12,
    },
    {
      docType: "BUSINESS_REGISTRATION",
      label: "CIPC Registration ((Pty) Ltd)",
      requiredFor: ["COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "companyName", label: "Company", type: "string", piiClass: "PERSONAL", required: true },
        { key: "registrationNumber", label: "Registration number", type: "string", required: true, example: "2021/123456/07" },
        { key: "address", label: "Registered address", type: "string", piiClass: "PERSONAL", required: true },
      ],
      validations: [
        { id: "ZA.BUSINESS_REGISTRATION.NUMBER_FORMAT", description: "CIPC number format", field: "registrationNumber", operator: "MATCHES_REGEX", value: "^\\d{4}/\\d{6}/07$", severity: "HIGH", failMessage: "Registration number must match YYYY/######/07 format." },
      ],
      validityMonths: 24,
    },
  ],

  crossDocumentChecks: [
    { id: "ZA.NAME_CONSISTENCY", description: "Operating-licence holder matches registered company", docTypeA: "OPERATING_LICENCE", docTypeB: "BUSINESS_REGISTRATION", fieldA: "holderName", fieldB: "companyName", operator: "CROSS_FIELD_EQUALS", severity: "HIGH", failMessage: "Operating-licence holder does not match the registered company name." },
    { id: "ZA.INSURANCE_PLATE_LINK", description: "Insurance plate matches roadworthiness plate", docTypeA: "VEHICLE_INSURANCE", docTypeB: "VEHICLE_ROADWORTHINESS", fieldA: "vehiclePlate", fieldB: "plate", operator: "CROSS_FIELD_EQUALS", severity: "MEDIUM", failMessage: "Insurance plate does not match the roadworthiness certificate." },
  ],

  authorityFields: [
    { key: "active_drivers_count", label: "Active drivers", classification: "ANSWERABLE", description: "Count of active drivers.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Driver", aggregation: "count", filterRuleIds: ["active"] }, lawfulBasisTag: "legal_obligation" },
    { key: "drivers_with_valid_license_count", label: "Drivers with valid PrDP", classification: "ANSWERABLE", description: "Active drivers with an unexpired PrDP.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Driver", aggregation: "count", filterRuleIds: ["active", "license_valid"] }, lawfulBasisTag: "legal_obligation" },
    {
      key: "driver_personal_details_list",
      label: "Driver personal details (per driver)",
      classification: "CAUTIONED",
      description: "Per-driver personal details — POPIA minimization applies.",
      dataClass: "PII_DIRECT",
      source: { entity: "Driver", aggregation: "list", field: "licenseExpiresAt" },
      cautionNote: "Minimize/aggregate under POPIA; do not transfer per-driver PII outside South Africa absent an s.72 basis.",
      lawfulBasisTag: "legal_obligation",
    },
    {
      key: "driver_criminal_record_list",
      label: "Driver criminal records (per driver)",
      classification: "OUT_OF_SCOPE",
      description: "Per-driver criminal-record data.",
      dataClass: "PII_SENSITIVE",
      source: { entity: "Driver", aggregation: "list" },
      cautionNote: "Special personal information under POPIA s.26 — not disclosable without a specific lawful basis or the data subject's consent. Flag as overreach if requested without one.",
      lawfulBasisTag: "consent",
    },
    { key: "completed_trips_count", label: "Completed trips (zone/period)", classification: "ANSWERABLE", description: "Completed trips filtered by zone/period.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Trip", aggregation: "count" }, lawfulBasisTag: "legal_obligation" },
    { key: "active_vehicles_count", label: "Active vehicles", classification: "ANSWERABLE", description: "Count of active vehicles.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Vehicle", aggregation: "count", filterRuleIds: ["active"] }, lawfulBasisTag: "legal_obligation" },
    { key: "vehicles_with_valid_inspection_count", label: "Vehicles with valid CoR", classification: "ANSWERABLE", description: "Active vehicles with a valid roadworthiness certificate.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Vehicle", aggregation: "count", filterRuleIds: ["active", "inspection_valid"] }, lawfulBasisTag: "legal_obligation" },
  ],

  namedFilters: {
    active: { description: "Active status", field: "status", operator: "EQUALS", value: "ACTIVE" },
    license_valid: { description: "PrDP unexpired", field: "licenseExpiresAt", operator: "DATE_NOT_EXPIRED" },
    inspection_valid: { description: "Vehicle roadworthiness unexpired", field: "inspectionValidUntil", operator: "DATE_NOT_EXPIRED" },
  },

  reportFormat: {
    formatId: "ZA_NPTR_STANDARD_V1",
    mandatedBy: "National Public Transport Regulator",
    delivery: "BOTH",
    sections: [
      { id: "subject", heading: "Subject of Request", fieldKeys: [], required: true },
      { id: "drivers", heading: "Driver Compliance", fieldKeys: ["active_drivers_count", "drivers_with_valid_license_count", "driver_personal_details_list"], required: true },
      { id: "trips", heading: "Trip Summary", fieldKeys: ["completed_trips_count"], required: true },
      { id: "vehicles", heading: "Vehicle Compliance", fieldKeys: ["active_vehicles_count", "vehicles_with_valid_inspection_count"], required: false },
    ],
    header: { logoText: "Bolt Sentinel", legalNotice: "Submitted to the National Public Transport Regulator." },
    footer: { signatureBlock: true, legalNotice: "Data accurate as at the date of submission. Personal information handled under POPIA." },
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: ".", thousands: " " },
    language: "en",
  },

  compliancePolicy: {
    privacyRegime: "POPIA",
    dataResidency: {
      storageRegion: "ZA",
      crossBorderTransferAllowed: false,
      allowedTransferRegions: [],
      note: "POPIA s.72 permits cross-border transfer only on specific grounds (adequate-protection laws, consent, contract necessity). Treat as restricted by default.",
    },
    piiClassification: [
      { fieldKey: "driverName", piiClass: "PERSONAL" },
      { fieldKey: "prdpNumber", piiClass: "PERSONAL" },
      { fieldKey: "address", piiClass: "PERSONAL" },
      { fieldKey: "driver_criminal_record_list", piiClass: "SPECIAL_CATEGORY" },
    ],
    lawfulBases: [
      { tag: "legal_obligation", label: "Compliance with a law (POPIA s.11(1)(c))", appliesToFieldKeys: ["active_drivers_count", "drivers_with_valid_license_count", "driver_personal_details_list", "completed_trips_count", "active_vehicles_count", "vehicles_with_valid_inspection_count"] },
      { tag: "consent", label: "Data-subject consent (POPIA s.26 special information)", appliesToFieldKeys: [] },
    ],
    purposeLimitation: {
      declaredPurposes: ["regulatory_reporting", "fleet_compliance"],
      restrictedDisclosureFieldKeys: ["driver_personal_details_list", "driver_criminal_record_list"],
    },
    retention: { documentRetentionMonths: 36, auditLogRetentionMonths: 60, autoPurgeAfterRetention: true },
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
