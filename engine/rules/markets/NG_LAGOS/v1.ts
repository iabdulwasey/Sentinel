import { defineRuleset } from "../../../types/ruleset";

/**
 * Nigeria (Lagos) — state-level ride-hailing permits, NDPA data regime (non-EU).
 * Authority: Lagos State Ministry of Transportation / LASDRI. NDPA imposes strict
 * cross-border residency (s.43 default prohibition). Illustrative synthetic ruleset.
 */
export default defineRuleset({
  marketCode: "NG_LAGOS",
  version: 1,
  country: "Nigeria",
  regulator: { name: "Lagos State Ministry of Transportation / LASDRI", code: "LAGOS_MOT" },
  region: "NG",
  timezone: "Africa/Lagos",
  currency: "NGN",
  locale: "en",
  zones: ["Ikeja", "Lekki", "Ikoyi", "Victoria Island", "Surulere", "Yaba", "Apapa", "Epe"],

  requiredDocuments: [
    {
      docType: "SERVICE_ENTITY_PERMIT",
      label: "Service Entity Permit (Lagos State)",
      requiredFor: ["COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "holderName", label: "Service entity", type: "string", piiClass: "PERSONAL", required: true, example: "Lagos Mobility Limited" },
        { key: "permitNumber", label: "Permit number", type: "string", required: true, example: "LSG-SEP-204418" },
        { key: "expiryDate", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "NG.SERVICE_ENTITY_PERMIT.NOT_EXPIRED", description: "Permit valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Service Entity Permit has expired.", lawfulBasisTag: "legal_obligation" },
        { id: "NG.SERVICE_ENTITY_PERMIT.NUMBER_FORMAT", description: "Permit format", field: "permitNumber", operator: "MATCHES_REGEX", value: "^LSG-SEP-\\d{6}$", severity: "MEDIUM", failMessage: "Permit number does not match LSG-SEP-###### format." },
      ],
      validityMonths: 12,
    },
    {
      docType: "OPERATOR_PROVISIONAL_LICENSE",
      label: "Operator's Provisional License",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "holderName", label: "Operator", type: "string", piiClass: "PERSONAL", required: true },
        { key: "licenseNumber", label: "Licence number", type: "string", required: true },
        { key: "expiryDate", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "NG.OPERATOR_PROVISIONAL_LICENSE.NOT_EXPIRED", description: "Licence valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "HIGH", failMessage: "Operator's provisional licence has expired." },
      ],
      validityMonths: 12,
    },
    {
      docType: "VEHICLE_ROADWORTHINESS",
      label: "Roadworthiness Certificate",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "plate", label: "Plate", type: "string", required: true, example: "LSR-123AB" },
        { key: "validUntil", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "NG.VEHICLE_ROADWORTHINESS.NOT_EXPIRED", description: "Roadworthiness valid", field: "validUntil", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Roadworthiness certificate has lapsed." },
        { id: "NG.VEHICLE_ROADWORTHINESS.PLATE_FORMAT", description: "Lagos plate format", field: "plate", operator: "MATCHES_REGEX", value: "^[A-Z]{3}-\\d{3}[A-Z]{2}$", severity: "LOW", failMessage: "Plate does not match the Lagos format." },
      ],
      validityMonths: 12,
    },
    {
      docType: "VEHICLE_INSURANCE",
      label: "Comprehensive Insurance",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "insurer", label: "Insurer", type: "string", required: true },
        { key: "policyNumber", label: "Policy number", type: "string", required: true },
        { key: "vehiclePlate", label: "Plate", type: "string", required: true },
        { key: "expiryDate", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "NG.VEHICLE_INSURANCE.NOT_EXPIRED", description: "Insurance valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Vehicle insurance has expired." },
      ],
      validityMonths: 12,
    },
    {
      docType: "LASDRI_CERTIFICATE",
      label: "LASDRI Driver Certificate",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "driverName", label: "Driver", type: "string", piiClass: "PERSONAL", required: true },
        { key: "lasdriNumber", label: "LASDRI number", type: "string", piiClass: "PERSONAL", required: true },
        { key: "expiryDate", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "NG.LASDRI_CERTIFICATE.NOT_EXPIRED", description: "LASDRI valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "HIGH", failMessage: "LASDRI certificate has expired." },
      ],
      validityMonths: 24,
    },
    {
      docType: "BUSINESS_REGISTRATION",
      label: "CAC Registration (RC number)",
      requiredFor: ["COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "companyName", label: "Company", type: "string", piiClass: "PERSONAL", required: true },
        { key: "rcNumber", label: "RC number", type: "string", required: true, example: "RC1234567" },
        { key: "address", label: "Registered address", type: "string", piiClass: "PERSONAL", required: true },
      ],
      validations: [
        { id: "NG.BUSINESS_REGISTRATION.RC_FORMAT", description: "RC number format", field: "rcNumber", operator: "MATCHES_REGEX", value: "^RC\\d{6,7}$", severity: "HIGH", failMessage: "RC number must match RC###### format." },
      ],
      validityMonths: 24,
    },
  ],

  crossDocumentChecks: [
    { id: "NG.NAME_CONSISTENCY", description: "Service-entity holder matches registered company", docTypeA: "SERVICE_ENTITY_PERMIT", docTypeB: "BUSINESS_REGISTRATION", fieldA: "holderName", fieldB: "companyName", operator: "CROSS_FIELD_EQUALS", severity: "HIGH", failMessage: "Service-entity permit holder does not match the registered company name." },
    { id: "NG.INSURANCE_PLATE_LINK", description: "Insurance plate matches roadworthiness plate", docTypeA: "VEHICLE_INSURANCE", docTypeB: "VEHICLE_ROADWORTHINESS", fieldA: "vehiclePlate", fieldB: "plate", operator: "CROSS_FIELD_EQUALS", severity: "MEDIUM", failMessage: "Insurance plate does not match the roadworthiness certificate." },
  ],

  authorityFields: [
    { key: "active_drivers_count", label: "Active drivers", classification: "ANSWERABLE", description: "Count of active drivers.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Driver", aggregation: "count", filterRuleIds: ["active"] }, lawfulBasisTag: "legal_obligation" },
    { key: "drivers_with_valid_license_count", label: "Drivers with valid LASDRI", classification: "ANSWERABLE", description: "Active drivers with an unexpired LASDRI certificate.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Driver", aggregation: "count", filterRuleIds: ["active", "license_valid"] }, lawfulBasisTag: "legal_obligation" },
    {
      key: "driver_personal_details_list",
      label: "Driver personal details (per driver)",
      classification: "CAUTIONED",
      description: "Per-driver personal details. NDPA minimization applies.",
      dataClass: "PII_DIRECT",
      source: { entity: "Driver", aggregation: "list", field: "licenseExpiresAt" },
      cautionNote: "Aggregate only — per-driver personal data is minimized under NDPA; return counts, not PII rows, absent a documented NDPA transfer basis.",
      lawfulBasisTag: "legal_obligation",
    },
    { key: "completed_trips_count", label: "Completed trips (zone/period)", classification: "ANSWERABLE", description: "Completed trips filtered by zone/period.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Trip", aggregation: "count" }, lawfulBasisTag: "legal_obligation" },
    { key: "active_vehicles_count", label: "Active vehicles", classification: "ANSWERABLE", description: "Count of active vehicles.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Vehicle", aggregation: "count", filterRuleIds: ["active"] }, lawfulBasisTag: "legal_obligation" },
    { key: "vehicles_with_valid_inspection_count", label: "Vehicles with valid roadworthiness", classification: "ANSWERABLE", description: "Active vehicles with valid roadworthiness.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Vehicle", aggregation: "count", filterRuleIds: ["active", "inspection_valid"] }, lawfulBasisTag: "legal_obligation" },
    { key: "fleet_partners_list", label: "Fleet partners + permit numbers", classification: "CAUTIONED", description: "Fleet partners with permit numbers; minimized for cross-border.", dataClass: "PII_DIRECT", source: { entity: "FleetPartner", aggregation: "list" }, cautionNote: "Contains operator personal data — apply NDPA minimization before any transfer outside Nigeria.", lawfulBasisTag: "legal_obligation" },
  ],

  namedFilters: {
    active: { description: "Active status", field: "status", operator: "EQUALS", value: "ACTIVE" },
    license_valid: { description: "LASDRI certificate unexpired", field: "licenseExpiresAt", operator: "DATE_NOT_EXPIRED" },
    inspection_valid: { description: "Vehicle roadworthiness unexpired", field: "inspectionValidUntil", operator: "DATE_NOT_EXPIRED" },
  },

  reportFormat: {
    formatId: "NG_LAGOS_STANDARD_V1",
    mandatedBy: "Lagos State Ministry of Transportation",
    delivery: "BOTH",
    sections: [
      { id: "subject", heading: "Subject of Request", fieldKeys: [], required: true },
      { id: "drivers", heading: "Driver Compliance", fieldKeys: ["active_drivers_count", "drivers_with_valid_license_count", "driver_personal_details_list"], required: true },
      { id: "trips", heading: "Trip Summary", fieldKeys: ["completed_trips_count"], required: true },
      { id: "vehicles", heading: "Vehicle Compliance", fieldKeys: ["active_vehicles_count", "vehicles_with_valid_inspection_count"], required: false },
    ],
    header: { logoText: "Bolt Sentinel", legalNotice: "Submitted to the Lagos State Ministry of Transportation." },
    footer: { signatureBlock: true, legalNotice: "Data accurate as at the date of submission. Personal data handled under the NDPA." },
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: ".", thousands: "," },
    language: "en",
  },

  compliancePolicy: {
    privacyRegime: "NDPA",
    dataResidency: {
      storageRegion: "NG",
      crossBorderTransferAllowed: false,
      allowedTransferRegions: [],
      note: "NDPA s.43 prohibits cross-border transfer of personal data by default absent an adequacy decision, the NDPC's approval, or appropriate safeguards (e.g. SCCs). Per-driver PII must be minimized/aggregated before any transfer outside Nigeria.",
    },
    piiClassification: [
      { fieldKey: "driverName", piiClass: "PERSONAL" },
      { fieldKey: "lasdriNumber", piiClass: "PERSONAL" },
      { fieldKey: "address", piiClass: "PERSONAL" },
    ],
    lawfulBases: [
      { tag: "legal_obligation", label: "Legal obligation / regulatory compliance (NDPA)", appliesToFieldKeys: ["active_drivers_count", "drivers_with_valid_license_count", "driver_personal_details_list", "completed_trips_count", "active_vehicles_count", "vehicles_with_valid_inspection_count", "fleet_partners_list"] },
    ],
    purposeLimitation: {
      declaredPurposes: ["regulatory_reporting", "fleet_compliance"],
      restrictedDisclosureFieldKeys: ["driver_personal_details_list", "fleet_partners_list"],
    },
    retention: { documentRetentionMonths: 24, auditLogRetentionMonths: 60, autoPurgeAfterRetention: true },
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
