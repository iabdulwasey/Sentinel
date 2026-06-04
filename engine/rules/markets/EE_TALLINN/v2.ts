import { defineRuleset } from "../../../types/ruleset";
import v1 from "./v1";

/**
 * Estonia v2 — a ruleset update that adds a mandatory driver criminal-record extract for
 * companies/operators. This is what re-flags previously-compliant partners (assessed under
 * v1) for review in the B2 monitoring "ruleset update" scenario. (Changelog is recorded on
 * the RegulatoryRuleset DB row at seed time.)
 */
export default defineRuleset({
  ...v1,
  version: 2,
  requiredDocuments: [
    ...v1.requiredDocuments,
    {
      docType: "DRIVER_BACKGROUND_CHECK",
      label: "Karistusregistri väljavõte (Criminal record extract)",
      requiredFor: ["COMPANY", "FLEET_OPERATOR"],
      expectedFields: [
        { key: "driverName", label: "Driver", type: "string", piiClass: "PERSONAL", required: true },
        { key: "referenceNumber", label: "Reference number", type: "string", piiClass: "PERSONAL", required: true },
        { key: "issueDate", label: "Issue date", type: "date", required: true },
        { key: "result", label: "Result", type: "string", piiClass: "SENSITIVE", required: true, example: "No entries" },
      ],
      validations: [
        {
          id: "EE.DRIVER_BACKGROUND_CHECK.PRESENT",
          description: "Background-check result present",
          field: "result",
          operator: "NOT_EMPTY",
          severity: "HIGH",
          failMessage: "Criminal-record extract result is missing.",
        },
      ],
      validityMonths: 12,
    },
  ],
});
