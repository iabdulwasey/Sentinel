import { defineRuleset } from "../../../types/ruleset";

/**
 * Portugal (Lisbon/Porto) — TVDE regime (operator licences, CMTVDE driver certificates,
 * TVDE vehicle badges, IPO inspections), EU/GDPR. Authority: IMT. Illustrative synthetic ruleset.
 */
export default defineRuleset({
  marketCode: "PT_LISBON",
  version: 1,
  country: "Portugal",
  regulator: { name: "Instituto da Mobilidade e dos Transportes (IMT)", code: "IMT", website: "https://www.imt-ip.pt" },
  region: "EU",
  timezone: "Europe/Lisbon",
  currency: "EUR",
  locale: "pt-PT",
  zones: ["Baixa", "Chiado", "Alfama", "Belém", "Parque das Nações", "Alcântara", "Porto-Baixa", "Porto-Boavista"],

  requiredDocuments: [
    {
      docType: "TVDE_OPERATOR_LICENSE",
      label: "Licença de operador TVDE (TVDE operator licence)",
      requiredFor: ["COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "holderName", label: "Operador", type: "string", piiClass: "PERSONAL", required: true, example: "Lisboa Mobilidade, Lda." },
        { key: "licenseNumber", label: "N.º de licença IMT", type: "string", required: true, example: "TVDE-204418" },
        { key: "expiryDate", label: "Válido até", type: "date", required: true },
      ],
      validations: [
        { id: "PT.TVDE_OPERATOR_LICENSE.NOT_EXPIRED", description: "Operator licence valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "TVDE operator licence has expired.", lawfulBasisTag: "legal_obligation" },
        { id: "PT.TVDE_OPERATOR_LICENSE.NUMBER_FORMAT", description: "IMT licence format", field: "licenseNumber", operator: "MATCHES_REGEX", value: "^TVDE-\\d{6}$", severity: "MEDIUM", failMessage: "Licence number does not match TVDE-###### format." },
      ],
      validityMonths: 120,
    },
    {
      docType: "TVDE_DRIVER_CERTIFICATE",
      label: "Certificado de motorista TVDE (CMTVDE)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "driverName", label: "Motorista", type: "string", piiClass: "PERSONAL", required: true },
        { key: "certificateNumber", label: "N.º do certificado", type: "string", piiClass: "PERSONAL", required: true },
        { key: "expiryDate", label: "Válido até", type: "date", required: true },
      ],
      validations: [
        { id: "PT.TVDE_DRIVER_CERTIFICATE.NOT_EXPIRED", description: "CMTVDE valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "TVDE driver certificate (CMTVDE) has expired." },
      ],
      validityMonths: 60,
    },
    {
      docType: "VEHICLE_TVDE_BADGE",
      label: "Dístico TVDE (Vehicle TVDE badge)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "plate", label: "Matrícula", type: "string", required: true, example: "AA-00-AA" },
        { key: "badgeNumber", label: "N.º do dístico", type: "string", required: true },
        { key: "imtLicenseNumber", label: "Licença IMT associada", type: "string", required: true },
      ],
      validations: [
        { id: "PT.VEHICLE_TVDE_BADGE.PRESENT", description: "Badge number present", field: "badgeNumber", operator: "NOT_EMPTY", severity: "HIGH", failMessage: "TVDE vehicle badge number missing." },
      ],
      validityMonths: 120,
    },
    {
      docType: "VEHICLE_INSPECTION",
      label: "Inspeção Periódica Obrigatória (IPO)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "plate", label: "Matrícula", type: "string", required: true },
        { key: "validUntil", label: "Válido até", type: "date", required: true },
      ],
      validations: [
        { id: "PT.VEHICLE_INSPECTION.NOT_EXPIRED", description: "IPO valid", field: "validUntil", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Periodic inspection (IPO) has lapsed." },
      ],
      validityMonths: 12,
    },
    {
      docType: "VEHICLE_INSURANCE",
      label: "Seguro de transporte de passageiros (Passenger insurance)",
      requiredFor: ["INDIVIDUAL", "COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "insurer", label: "Seguradora", type: "string", required: true },
        { key: "policyNumber", label: "Apólice", type: "string", required: true },
        { key: "vehiclePlate", label: "Matrícula", type: "string", required: true },
        { key: "expiryDate", label: "Válido até", type: "date", required: true },
      ],
      validations: [
        { id: "PT.VEHICLE_INSURANCE.NOT_EXPIRED", description: "Insurance valid", field: "expiryDate", operator: "DATE_NOT_EXPIRED", severity: "CRITICAL", failMessage: "Vehicle insurance has expired." },
      ],
      validityMonths: 12,
    },
    {
      docType: "BUSINESS_REGISTRATION",
      label: "Certidão permanente / NIF (Business registration)",
      requiredFor: ["COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "companyName", label: "Empresa", type: "string", piiClass: "PERSONAL", required: true },
        { key: "nif", label: "NIF", type: "string", required: true, example: "501234567" },
        { key: "address", label: "Sede", type: "string", piiClass: "PERSONAL", required: true },
      ],
      validations: [
        { id: "PT.BUSINESS_REGISTRATION.NIF_FORMAT", description: "9-digit NIF", field: "nif", operator: "MATCHES_REGEX", value: "^\\d{9}$", severity: "HIGH", failMessage: "NIF must be 9 digits." },
      ],
      validityMonths: 12,
    },
  ],

  crossDocumentChecks: [
    { id: "PT.NAME_CONSISTENCY", description: "Operator licence holder matches registered company", docTypeA: "TVDE_OPERATOR_LICENSE", docTypeB: "BUSINESS_REGISTRATION", fieldA: "holderName", fieldB: "companyName", operator: "CROSS_FIELD_EQUALS", severity: "HIGH", failMessage: "TVDE operator licence holder does not match the registered company." },
    { id: "PT.BADGE_LICENCE_LINK", description: "Vehicle badge references the operator licence", docTypeA: "VEHICLE_TVDE_BADGE", docTypeB: "TVDE_OPERATOR_LICENSE", fieldA: "imtLicenseNumber", fieldB: "licenseNumber", operator: "CROSS_FIELD_EQUALS", severity: "MEDIUM", failMessage: "Vehicle TVDE badge does not reference the operator's IMT licence." },
  ],

  authorityFields: [
    { key: "active_drivers_count", label: "Motoristas ativos (Active drivers)", classification: "ANSWERABLE", description: "Count of active drivers.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Driver", aggregation: "count", filterRuleIds: ["active"] }, lawfulBasisTag: "legal_obligation" },
    { key: "drivers_with_valid_license_count", label: "Motoristas com CMTVDE válido", classification: "ANSWERABLE", description: "Active drivers with a valid certificate.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Driver", aggregation: "count", filterRuleIds: ["active", "license_valid"] }, lawfulBasisTag: "legal_obligation" },
    { key: "driver_license_status_list", label: "Validade do certificado (por motorista)", classification: "ANSWERABLE", description: "Per-driver certificate validity, disclosed under legal obligation.", dataClass: "PII_DIRECT", source: { entity: "Driver", aggregation: "list", field: "licenseExpiresAt" }, lawfulBasisTag: "legal_obligation" },
    { key: "completed_trips_count", label: "Viagens concluídas (zona/período)", classification: "ANSWERABLE", description: "Completed trips filtered by zone/period.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Trip", aggregation: "count" }, lawfulBasisTag: "legal_obligation" },
    { key: "active_vehicles_count", label: "Veículos ativos (Active vehicles)", classification: "ANSWERABLE", description: "Count of active vehicles.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Vehicle", aggregation: "count", filterRuleIds: ["active"] }, lawfulBasisTag: "legal_obligation" },
    { key: "vehicles_with_valid_inspection_count", label: "Veículos com IPO válida", classification: "ANSWERABLE", description: "Active vehicles with a valid IPO.", dataClass: "DERIVED_AGGREGATE", source: { entity: "Vehicle", aggregation: "count", filterRuleIds: ["active", "inspection_valid"] }, lawfulBasisTag: "legal_obligation" },
    { key: "fleet_partners_list", label: "Parceiros de frota + licenças", classification: "ANSWERABLE", description: "Fleet partners with operator-licence numbers.", dataClass: "PII_DIRECT", source: { entity: "FleetPartner", aggregation: "list" }, lawfulBasisTag: "legal_obligation" },
  ],

  namedFilters: {
    active: { description: "Active status", field: "status", operator: "EQUALS", value: "ACTIVE" },
    license_valid: { description: "Driver certificate unexpired", field: "licenseExpiresAt", operator: "DATE_NOT_EXPIRED" },
    inspection_valid: { description: "Vehicle inspection unexpired", field: "inspectionValidUntil", operator: "DATE_NOT_EXPIRED" },
  },

  reportFormat: {
    formatId: "PT_IMT_STANDARD_V1",
    mandatedBy: "Instituto da Mobilidade e dos Transportes",
    delivery: "BOTH",
    sections: [
      { id: "subject", heading: "Objeto do pedido (Subject of request)", fieldKeys: [], required: true },
      { id: "drivers", heading: "Conformidade dos motoristas (Driver compliance)", fieldKeys: ["active_drivers_count", "drivers_with_valid_license_count", "driver_license_status_list"], required: true },
      { id: "trips", heading: "Resumo de viagens (Trip summary)", fieldKeys: ["completed_trips_count"], required: true },
      { id: "vehicles", heading: "Conformidade dos veículos (Vehicle compliance)", fieldKeys: ["active_vehicles_count", "vehicles_with_valid_inspection_count"], required: false },
    ],
    header: { logoText: "Bolt Sentinel", legalNotice: "Apresentado a pedido do IMT." },
    footer: { signatureBlock: true, legalNotice: "Dados verdadeiros à data de apresentação." },
    dateFormat: "DD/MM/YYYY",
    numberFormat: { decimal: ",", thousands: "." },
    language: "pt-PT",
  },

  compliancePolicy: {
    privacyRegime: "GDPR",
    dataResidency: { storageRegion: "EU", crossBorderTransferAllowed: true, allowedTransferRegions: ["EU"], note: "Intra-EU/EEA transfers permitted under GDPR; non-EEA transfers require Article 46 safeguards." },
    piiClassification: [
      { fieldKey: "driverName", piiClass: "PERSONAL" },
      { fieldKey: "certificateNumber", piiClass: "PERSONAL" },
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
      { id: "expiry_proximity", label: "Expiry proximity", weight: 0.25, deriveFrom: "Documents expiring within 30 days." },
      { id: "inconsistencies", label: "Cross-document inconsistencies", weight: 0.3, deriveFrom: "Failed cross-checks." },
      { id: "fleet_size", label: "Fleet size exposure", weight: 0.15, deriveFrom: "Vehicles/drivers under the partner." },
    ],
    bands: { low: [0, 33], medium: [34, 66], high: [67, 100] },
  },
});
