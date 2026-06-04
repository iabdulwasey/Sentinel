import { defineRuleset } from "../../../types/ruleset";

/**
 * Estonia (Tallinn) — ride-hailing operating-permit regime, EU/GDPR. Bolt's home market.
 * Authority: Estonian Transport Administration (Transpordiamet). Illustrative synthetic ruleset.
 */
export default defineRuleset({
  marketCode: "EE_TALLINN",
  version: 1,
  country: "Estonia",
  regulator: { name: "Transpordiamet (Estonian Transport Administration)", code: "TRAM", website: "https://transpordiamet.ee" },
  region: "EU",
  timezone: "Europe/Tallinn",
  currency: "EUR",
  locale: "et",
  zones: ["Kesklinn", "Põhja-Tallinn", "Lasnamäe", "Mustamäe", "Kristiine", "Nõmme", "Pirita", "Haabersti"],

  requiredDocuments: [
    {
      docType: "OPERATOR_PERMIT",
      label: "Sõitjateveo tegevusluba (Ride-hailing operating permit)",
      requiredFor: ["COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "holderName", label: "Permit holder", type: "string", piiClass: "PERSONAL", required: true, example: "Tallinn Mobility OÜ" },
        { key: "permitNumber", label: "Permit number", type: "string", required: true, example: "EE-TVR-204418" },
        { key: "issuer", label: "Issuing authority", type: "string", required: true, example: "Transpordiamet" },
        { key: "issueDate", label: "Issue date", type: "date", required: true },
        { key: "expiryDate", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "EE.OPERATOR_PERMIT.NOT_EXPIRED", description: "Operating permit must be valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Operating permit has expired.", lawfulBasisTag: "legal_obligation" },
        { id: "EE.OPERATOR_PERMIT.NUMBER_FORMAT", description: "Permit number format", field: "permitNumber", operator: "MATCHES_REGEX", value: "^EE-TVR-\\d{6}$", severity: "MEDIUM", failMessage: "Permit number does not match the expected EE-TVR-###### format." },
        { id: "EE.OPERATOR_PERMIT.ISSUER", description: "Issued by Transpordiamet", field: "issuer", operator: "MATCHES_REGEX", value: "Transpordiamet", severity: "HIGH", failMessage: "Permit issuer is not the Transport Administration." },
      ],
      validityMonths: 60,
    },
    {
      docType: "BUSINESS_REGISTRATION",
      label: "Äriregistri väljavõte (Business Register extract)",
      requiredFor: ["COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "companyName", label: "Company name", type: "string", piiClass: "PERSONAL", required: true, example: "Tallinn Mobility OÜ" },
        { key: "registryCode", label: "Registry code", type: "string", required: true, example: "12345678" },
        { key: "address", label: "Registered address", type: "string", piiClass: "PERSONAL", required: true },
        { key: "issueDate", label: "Extract date", type: "date", required: true },
      ],
      validations: [
        { id: "EE.BUSINESS_REGISTRATION.CODE_FORMAT", description: "8-digit registry code", field: "registryCode", operator: "MATCHES_REGEX", value: "^\\d{8}$", severity: "HIGH", failMessage: "Registry code must be 8 digits." },
        { id: "EE.BUSINESS_REGISTRATION.NAME_PRESENT", description: "Company name present", field: "companyName", operator: "NOT_EMPTY", severity: "HIGH", failMessage: "Company name missing from the extract." },
      ],
      validityMonths: 12,
    },
    {
      docType: "VEHICLE_INSURANCE",
      label: "Liikluskindlustus (Commercial passenger-transport insurance)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "insurer", label: "Insurer", type: "string", required: true, example: "If P&C Insurance AS" },
        { key: "policyNumber", label: "Policy number", type: "string", required: true },
        { key: "holderName", label: "Policyholder", type: "string", piiClass: "PERSONAL", required: true },
        { key: "vehiclePlate", label: "Vehicle plate", type: "string", required: true, example: "123 ABC" },
        { key: "expiryDate", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "EE.VEHICLE_INSURANCE.NOT_EXPIRED", description: "Insurance must be valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Vehicle insurance has expired." },
        { id: "EE.VEHICLE_INSURANCE.PLATE_FORMAT", description: "Estonian plate format", field: "vehiclePlate", operator: "MATCHES_REGEX", value: "^\\d{3} [A-Z]{3}$", severity: "LOW", failMessage: "Plate does not match the Estonian ### ABC format." },
      ],
      validityMonths: 12,
    },
    {
      docType: "VEHICLE_REGISTRATION",
      label: "Registreerimistunnistus (Vehicle registration certificate)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "plate", label: "Registration plate", type: "string", required: true, example: "123 ABC" },
        { key: "vin", label: "VIN", type: "string", required: true },
        { key: "make", label: "Make", type: "string", required: true },
        { key: "model", label: "Model", type: "string", required: true },
        { key: "owner", label: "Registered owner", type: "string", piiClass: "PERSONAL", required: true },
        { key: "firstRegistration", label: "First registration", type: "date", required: true },
      ],
      validations: [
        { id: "EE.VEHICLE_REGISTRATION.VIN_FORMAT", description: "17-char VIN", field: "vin", operator: "MATCHES_REGEX", value: "^[A-HJ-NPR-Z0-9]{17}$", severity: "MEDIUM", failMessage: "VIN must be 17 characters." },
        { id: "EE.VEHICLE_REGISTRATION.PLATE_PRESENT", description: "Plate present", field: "plate", operator: "NOT_EMPTY", severity: "HIGH", failMessage: "Registration plate missing." },
      ],
      validityMonths: 120,
    },
    {
      docType: "VEHICLE_INSPECTION",
      label: "Tehnoülevaatus (Technical inspection)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "plate", label: "Vehicle plate", type: "string", required: true },
        { key: "station", label: "Inspection station", type: "string", required: true },
        { key: "inspectionDate", label: "Inspection date", type: "date", required: true },
        { key: "validUntil", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "EE.VEHICLE_INSPECTION.NOT_EXPIRED", description: "Inspection must be valid", field: "validUntil", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Vehicle technical inspection has lapsed." },
      ],
      validityMonths: 12,
    },
    {
      docType: "DRIVER_LICENSE",
      label: "Juhiluba (Driving licence)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "driverName", label: "Driver", type: "string", piiClass: "PERSONAL", required: true },
        { key: "licenseNumber", label: "Licence number", type: "string", piiClass: "PERSONAL", required: true },
        { key: "categories", label: "Categories", type: "string", required: true, example: "B" },
        { key: "expiryDate", label: "Valid until", type: "date", required: true },
      ],
      validations: [
        { id: "EE.DRIVER_LICENSE.NOT_EXPIRED", description: "Licence must be valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Driver licence has expired." },
        { id: "EE.DRIVER_LICENSE.CATEGORY_B", description: "Category B held", field: "categories", operator: "MATCHES_REGEX", value: "B", severity: "HIGH", failMessage: "Driver does not hold category B." },
      ],
      validityMonths: 120,
    },
  ],

  crossDocumentChecks: [
    {
      id: "EE.NAME_CONSISTENCY_PERMIT_REGISTRATION",
      description: "Operator permit holder matches the registered company name",
      docTypeA: "OPERATOR_PERMIT",
      docTypeB: "BUSINESS_REGISTRATION",
      fieldA: "holderName",
      fieldB: "companyName",
      operator: "CROSS_FIELD_EQUALS",
      severity: "HIGH",
      failMessage: "Operator permit holder does not match the business-registration company name.",
    },
    {
      id: "EE.INSURANCE_HOLDER_CONSISTENCY",
      description: "Insurance policyholder matches the registered company",
      docTypeA: "VEHICLE_INSURANCE",
      docTypeB: "BUSINESS_REGISTRATION",
      fieldA: "holderName",
      fieldB: "companyName",
      operator: "CROSS_FIELD_EQUALS",
      severity: "MEDIUM",
      failMessage: "Insurance policyholder differs from the registered company name.",
    },
  ],

  authorityFields: [
    {
      key: "active_drivers_count",
      label: "Active drivers",
      classification: "ANSWERABLE",
      description: "Count of drivers currently active for the operator.",
      dataClass: "DERIVED_AGGREGATE",
      source: { entity: "Driver", aggregation: "count", filterRuleIds: ["active"] },
      lawfulBasisTag: "legal_obligation",
    },
    {
      key: "drivers_with_valid_license_count",
      label: "Drivers with a valid licence",
      classification: "ANSWERABLE",
      description: "Count of active drivers whose driving licence is unexpired.",
      dataClass: "DERIVED_AGGREGATE",
      source: { entity: "Driver", aggregation: "count", filterRuleIds: ["active", "license_valid"] },
      lawfulBasisTag: "legal_obligation",
    },
    {
      key: "driver_license_status_list",
      label: "Driver licence validity (per driver)",
      classification: "ANSWERABLE",
      description: "Per-driver licence validity status. Disclosed to the transport authority under legal obligation.",
      dataClass: "PII_DIRECT",
      source: { entity: "Driver", aggregation: "list", field: "licenseExpiresAt" },
      lawfulBasisTag: "legal_obligation",
    },
    {
      key: "completed_trips_count",
      label: "Completed trips (zone/period)",
      classification: "ANSWERABLE",
      description: "Count of completed trips, filtered by the requested zone and period.",
      dataClass: "DERIVED_AGGREGATE",
      source: { entity: "Trip", aggregation: "count" },
      lawfulBasisTag: "legal_obligation",
    },
    {
      key: "active_vehicles_count",
      label: "Active vehicles",
      classification: "ANSWERABLE",
      description: "Count of vehicles currently active for the operator.",
      dataClass: "DERIVED_AGGREGATE",
      source: { entity: "Vehicle", aggregation: "count", filterRuleIds: ["active"] },
      lawfulBasisTag: "legal_obligation",
    },
    {
      key: "vehicles_with_valid_inspection_count",
      label: "Vehicles with a valid inspection",
      classification: "ANSWERABLE",
      description: "Count of active vehicles whose technical inspection is unexpired.",
      dataClass: "DERIVED_AGGREGATE",
      source: { entity: "Vehicle", aggregation: "count", filterRuleIds: ["active", "inspection_valid"] },
      lawfulBasisTag: "legal_obligation",
    },
    {
      key: "fleet_partners_list",
      label: "Fleet partners + permit numbers",
      classification: "ANSWERABLE",
      description: "List of fleet partners with their operating-permit numbers.",
      dataClass: "PII_DIRECT",
      source: { entity: "FleetPartner", aggregation: "list" },
      lawfulBasisTag: "legal_obligation",
    },
  ],

  namedFilters: {
    active: { description: "Active status", field: "status", operator: "EQUALS", value: "ACTIVE" },
    license_valid: { description: "Driving licence unexpired", field: "licenseExpiresAt", operator: "DATE_NOT_EXPIRED" },
    inspection_valid: { description: "Vehicle inspection unexpired", field: "inspectionValidUntil", operator: "DATE_NOT_EXPIRED" },
  },

  reportFormat: {
    formatId: "EE_TRAM_STANDARD_V1",
    mandatedBy: "Transpordiamet",
    delivery: "BOTH",
    sections: [
      { id: "subject", heading: "Päringu ese (Subject of request)", fieldKeys: [], required: true },
      { id: "drivers", heading: "Juhtide vastavus (Driver compliance)", fieldKeys: ["active_drivers_count", "drivers_with_valid_license_count", "driver_license_status_list"], required: true },
      { id: "trips", heading: "Sõitude kokkuvõte (Trip summary)", fieldKeys: ["completed_trips_count"], required: true },
      { id: "vehicles", heading: "Sõidukite vastavus (Vehicle compliance)", fieldKeys: ["active_vehicles_count", "vehicles_with_valid_inspection_count"], required: false },
    ],
    header: { logoText: "Bolt Sentinel", legalNotice: "Esitatud Transpordiameti päringu alusel." },
    footer: { signatureBlock: true, legalNotice: "Andmed on tõesed esitamise kuupäeva seisuga." },
    dateFormat: "DD.MM.YYYY",
    numberFormat: { decimal: ",", thousands: " " },
    language: "et",
  },

  compliancePolicy: {
    privacyRegime: "GDPR",
    dataResidency: {
      storageRegion: "EU",
      crossBorderTransferAllowed: true,
      allowedTransferRegions: ["EU"],
      note: "Intra-EU/EEA transfers permitted under GDPR; transfers outside the EEA require Article 46 safeguards.",
    },
    piiClassification: [
      { fieldKey: "driverName", piiClass: "PERSONAL" },
      { fieldKey: "licenseNumber", piiClass: "PERSONAL" },
      { fieldKey: "nationalId", piiClass: "SENSITIVE" },
      { fieldKey: "address", piiClass: "PERSONAL" },
    ],
    lawfulBases: [
      { tag: "legal_obligation", label: "Compliance with a legal obligation (GDPR Art. 6(1)(c))", appliesToFieldKeys: ["active_drivers_count", "drivers_with_valid_license_count", "driver_license_status_list", "completed_trips_count", "active_vehicles_count", "vehicles_with_valid_inspection_count", "fleet_partners_list"] },
    ],
    purposeLimitation: {
      declaredPurposes: ["regulatory_reporting", "fleet_compliance"],
      restrictedDisclosureFieldKeys: [],
    },
    retention: { documentRetentionMonths: 60, auditLogRetentionMonths: 84, autoPurgeAfterRetention: false },
  },

  riskModel: {
    factors: [
      { id: "completeness", label: "Document completeness", weight: 0.3, deriveFrom: "Share of required documents present and valid." },
      { id: "expiry_proximity", label: "Expiry proximity", weight: 0.25, deriveFrom: "Documents expiring within 30 days." },
      { id: "inconsistencies", label: "Cross-document inconsistencies", weight: 0.3, deriveFrom: "Failed cross-checks (name/holder mismatches)." },
      { id: "fleet_size", label: "Fleet size exposure", weight: 0.15, deriveFrom: "Number of vehicles/drivers under the partner." },
    ],
    bands: { low: [0, 33], medium: [34, 66], high: [67, 100] },
  },
});
