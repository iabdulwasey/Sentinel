import { defineRuleset } from "../../../types/ruleset";

/**
 * Romania (Bucharest) — ARR alternative-transport authorization regime, EU/GDPR.
 * Authority: Autoritatea Rutieră Română (ARR). Distinctive 6-month ITP cycle.
 * Illustrative synthetic ruleset.
 */
export default defineRuleset({
  marketCode: "RO_BUCHAREST",
  version: 1,
  country: "Romania",
  regulator: { name: "Autoritatea Rutieră Română (ARR)", code: "ARR", website: "https://www.arr.ro" },
  region: "EU",
  timezone: "Europe/Bucharest",
  currency: "RON",
  locale: "ro",
  zones: ["Sector 1", "Sector 2", "Sector 3", "Sector 4", "Sector 5", "Sector 6"],

  requiredDocuments: [
    {
      docType: "ALT_TRANSPORT_AUTHORIZATION",
      label: "Autorizație transport alternativ (Alternative-transport authorization)",
      requiredFor: ["COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "holderName", label: "Titular", type: "string", piiClass: "PERSONAL", required: true, example: "București Mobility SRL" },
        { key: "authorizationNumber", label: "Număr autorizație", type: "string", required: true, example: "ARR-B-204418" },
        { key: "issuer", label: "Autoritate emitentă", type: "string", required: true, example: "ARR" },
        { key: "expiryDate", label: "Valabil până la", type: "date", required: true },
      ],
      validations: [
        { id: "RO.ALT_TRANSPORT_AUTHORIZATION.NOT_EXPIRED", description: "Authorization valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Alternative-transport authorization has expired.", lawfulBasisTag: "legal_obligation" },
        { id: "RO.ALT_TRANSPORT_AUTHORIZATION.NUMBER_FORMAT", description: "ARR number format", field: "authorizationNumber", operator: "MATCHES_REGEX", value: "^ARR-B-\\d{6}$", severity: "MEDIUM", failMessage: "Authorization number does not match ARR-B-###### format." },
      ],
      validityMonths: 60,
    },
    {
      docType: "DRIVER_ATTESTATION",
      label: "Atestat profesional (Driver professional attestation)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "driverName", label: "Conducător auto", type: "string", piiClass: "PERSONAL", required: true },
        { key: "attestationNumber", label: "Număr atestat", type: "string", piiClass: "PERSONAL", required: true },
        { key: "expiryDate", label: "Valabil până la", type: "date", required: true },
      ],
      validations: [
        { id: "RO.DRIVER_ATTESTATION.NOT_EXPIRED", description: "Attestation valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Driver professional attestation has expired." },
      ],
      validityMonths: 60,
    },
    {
      docType: "VEHICLE_ITP",
      label: "Inspecție Tehnică Periodică (ITP)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "plate", label: "Număr înmatriculare", type: "string", required: true, example: "B 12 ABC" },
        { key: "validUntil", label: "Valabil până la", type: "date", required: true },
      ],
      validations: [
        { id: "RO.VEHICLE_ITP.NOT_EXPIRED", description: "ITP valid (6-month cycle)", field: "validUntil", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Periodic technical inspection (ITP) has lapsed." },
        { id: "RO.VEHICLE_ITP.PLATE_FORMAT", description: "Bucharest plate format", field: "plate", operator: "MATCHES_REGEX", value: "^B \\d{2,3} [A-Z]{3}$", severity: "LOW", failMessage: "Plate does not match the Bucharest 'B ## ABC' format." },
      ],
      validityMonths: 6,
    },
    {
      docType: "VEHICLE_INSURANCE",
      label: "Asigurare RCA (Motor third-party insurance)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "insurer", label: "Asigurator", type: "string", required: true },
        { key: "policyNumber", label: "Număr poliță", type: "string", required: true },
        { key: "vehiclePlate", label: "Număr înmatriculare", type: "string", required: true },
        { key: "expiryDate", label: "Valabil până la", type: "date", required: true },
      ],
      validations: [
        { id: "RO.VEHICLE_INSURANCE.NOT_EXPIRED", description: "Insurance valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Vehicle insurance (RCA) has expired." },
      ],
      validityMonths: 12,
    },
    {
      docType: "VEHICLE_REGISTRATION",
      label: "Certificat de înmatriculare (Vehicle registration)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "plate", label: "Număr înmatriculare", type: "string", required: true },
        { key: "vin", label: "Serie șasiu (VIN)", type: "string", required: true },
        { key: "owner", label: "Proprietar", type: "string", piiClass: "PERSONAL", required: true },
        { key: "firstRegistration", label: "Prima înmatriculare", type: "date", required: true },
      ],
      validations: [
        { id: "RO.VEHICLE_REGISTRATION.VIN_FORMAT", description: "17-char VIN", field: "vin", operator: "MATCHES_REGEX", value: "^[A-HJ-NPR-Z0-9]{17}$", severity: "MEDIUM", failMessage: "VIN must be 17 characters." },
      ],
      validityMonths: 120,
    },
    {
      docType: "BUSINESS_REGISTRATION",
      label: "Certificat ONRC / CUI (Business registration)",
      requiredFor: ["COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "companyName", label: "Denumire", type: "string", piiClass: "PERSONAL", required: true },
        { key: "cui", label: "CUI", type: "string", required: true, example: "RO12345678" },
        { key: "address", label: "Sediu social", type: "string", piiClass: "PERSONAL", required: true },
      ],
      validations: [
        { id: "RO.BUSINESS_REGISTRATION.CUI_FORMAT", description: "CUI format", field: "cui", operator: "MATCHES_REGEX", value: "^RO\\d{2,10}$", severity: "HIGH", failMessage: "CUI must match RO######## format." },
      ],
      validityMonths: 12,
    },
  ],

  crossDocumentChecks: [
    { id: "RO.NAME_CONSISTENCY", description: "Authorization holder matches registered company", docTypeA: "ALT_TRANSPORT_AUTHORIZATION", docTypeB: "BUSINESS_REGISTRATION", fieldA: "holderName", fieldB: "companyName", operator: "CROSS_FIELD_EQUALS", severity: "HIGH", failMessage: "Authorization holder does not match the registered company name." },
    { id: "RO.INSURANCE_PLATE_LINK", description: "Insurance plate matches a registered vehicle", docTypeA: "VEHICLE_INSURANCE", docTypeB: "VEHICLE_REGISTRATION", fieldA: "vehiclePlate", fieldB: "plate", operator: "CROSS_FIELD_EQUALS", severity: "MEDIUM", failMessage: "Insurance plate does not match the vehicle registration." },
  ],

  authorityFields: [
    { key: "active_drivers_count", label: "Conducători activi (Active drivers)", classification: "ANSWERABLE", description: "Count of active drivers.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Driver", aggregation: "count", filterRuleIds: ["active"] }, lawfulBasisTag: "legal_obligation" },
    { key: "drivers_with_valid_license_count", label: "Conducători cu atestat valabil", classification: "ANSWERABLE", description: "Active drivers with a valid attestation.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Driver", aggregation: "count", filterRuleIds: ["active", "license_valid"] }, lawfulBasisTag: "legal_obligation" },
    { key: "driver_license_status_list", label: "Valabilitate atestat (pe conducător)", classification: "ANSWERABLE", description: "Per-driver attestation validity, disclosed under legal obligation.", dataClass: "PII_DIRECT", source: { entity: "Driver", aggregation: "list", field: "licenseExpiresAt" }, lawfulBasisTag: "legal_obligation" },
    { key: "completed_trips_count", label: "Curse finalizate (sector/perioadă)", classification: "ANSWERABLE", description: "Completed trips filtered by zone/period.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Trip", aggregation: "count" }, lawfulBasisTag: "legal_obligation" },
    { key: "active_vehicles_count", label: "Vehicule active (Active vehicles)", classification: "ANSWERABLE", description: "Count of active vehicles.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Vehicle", aggregation: "count", filterRuleIds: ["active"] }, lawfulBasisTag: "legal_obligation" },
    { key: "vehicles_with_valid_inspection_count", label: "Vehicule cu ITP valabil", classification: "ANSWERABLE", description: "Active vehicles with a valid ITP.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Vehicle", aggregation: "count", filterRuleIds: ["active", "inspection_valid"] }, lawfulBasisTag: "legal_obligation" },
    { key: "fleet_partners_list", label: "Parteneri de flotă + autorizații", classification: "ANSWERABLE", description: "Fleet partners with authorization numbers.", dataClass: "PII_DIRECT", source: { entity: "FleetPartner", aggregation: "list" }, lawfulBasisTag: "legal_obligation" },
  ],

  namedFilters: {
    active: { description: "Active status", field: "status", operator: "EQUALS", value: "ACTIVE" },
    license_valid: { description: "Driver attestation unexpired", field: "licenseExpiresAt", operator: "DATE_NOT_EXPIRED" },
    inspection_valid: { description: "Vehicle ITP unexpired", field: "inspectionValidUntil", operator: "DATE_NOT_EXPIRED" },
  },

  reportFormat: {
    formatId: "RO_ARR_STANDARD_V1",
    mandatedBy: "Autoritatea Rutieră Română",
    delivery: "BOTH",
    sections: [
      { id: "subject", heading: "Obiectul solicitării (Subject of request)", fieldKeys: [], required: true },
      { id: "drivers", heading: "Conformitatea conducătorilor (Driver compliance)", fieldKeys: ["active_drivers_count", "drivers_with_valid_license_count", "driver_license_status_list"], required: true },
      { id: "trips", heading: "Sumar curse (Trip summary)", fieldKeys: ["completed_trips_count"], required: true },
      { id: "vehicles", heading: "Conformitatea vehiculelor (Vehicle compliance)", fieldKeys: ["active_vehicles_count", "vehicles_with_valid_inspection_count"], required: false },
    ],
    header: { logoText: "Bolt Sentinel", legalNotice: "Transmis la solicitarea ARR." },
    footer: { signatureBlock: true, legalNotice: "Datele sunt corecte la data transmiterii." },
    dateFormat: "DD.MM.YYYY",
    numberFormat: { decimal: ",", thousands: "." },
    language: "ro",
  },

  compliancePolicy: {
    privacyRegime: "GDPR",
    dataResidency: { storageRegion: "EU", crossBorderTransferAllowed: true, allowedTransferRegions: ["EU"], note: "Intra-EU/EEA transfers permitted under GDPR; non-EEA transfers require Article 46 safeguards." },
    piiClassification: [
      { fieldKey: "driverName", piiClass: "PERSONAL" },
      { fieldKey: "attestationNumber", piiClass: "PERSONAL" },
      { fieldKey: "address", piiClass: "PERSONAL" },
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
      { id: "expiry_proximity", label: "Expiry proximity", weight: 0.25, deriveFrom: "Documents expiring within 30 days (ITP every 6 months)." },
      { id: "inconsistencies", label: "Cross-document inconsistencies", weight: 0.3, deriveFrom: "Failed cross-checks." },
      { id: "fleet_size", label: "Fleet size exposure", weight: 0.15, deriveFrom: "Vehicles/drivers under the partner." },
    ],
    bands: { low: [0, 33], medium: [34, 66], high: [67, 100] },
  },
});
