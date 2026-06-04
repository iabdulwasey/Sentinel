import { callLlm } from "../llm/client";
import { ConstraintDecisionSetSchema, type ConstraintDecision } from "../types/ai";
import type { MarketRuleset } from "../types/ruleset";
import type { RequestIntent, RetrievalComputedField } from "../types/ai";

/**
 * §7.A Compliance-Constraint Framework (output phase). Deterministic bright-line rules decide
 * the ACTION on each field (residency, PII minimization, lawful-basis overreach); the
 * ComplianceConstraintAgent provides an explainable rationale but can never loosen a hard block.
 * Every decision is returned for auditing and surfaced in the report/UI.
 */

export interface EnforceResult {
  fields: RetrievalComputedField[];
  decisions: ConstraintDecision[];
  withheld: string[];
}

function deterministicAction(
  ruleset: MarketRuleset,
  field: RetrievalComputedField,
): { action: ConstraintDecision["action"]; rule: string; rationale: string } {
  const policy = ruleset.compliancePolicy;
  const spec = ruleset.authorityFields.find((f) => f.key === field.fieldKey);
  const isList = Array.isArray(field.value);
  const restricted = policy.purposeLimitation.restrictedDisclosureFieldKeys.includes(field.fieldKey);
  const residencyRestricted = !policy.dataResidency.crossBorderTransferAllowed;
  const regime = policy.privacyRegime;

  if (spec?.classification === "OUT_OF_SCOPE") {
    return {
      action: "block",
      rule: `${regime} — restricted / special-category disclosure`,
      rationale:
        spec.cautionNote ??
        `Withheld: this field is out of scope for the cited lawful basis under ${regime}. Disclosing it would exceed the request's authority (overreach).`,
    };
  }
  if (spec?.classification === "CAUTIONED") {
    if (isList && (restricted || residencyRestricted)) {
      return {
        action: "aggregate",
        rule: `${regime} — data minimization${residencyRestricted ? " / cross-border residency" : ""}`,
        rationale:
          spec.cautionNote ??
          `Per-subject personal data minimized to an aggregate count under ${regime}${residencyRestricted ? " (cross-border transfer not permitted by default)" : ""}.`,
      };
    }
    return { action: "allow", rule: `${regime} — disclosure permitted with caution`, rationale: spec.cautionNote ?? "Disclosed under the cited legal basis." };
  }
  return { action: "allow", rule: `${regime} — legal obligation`, rationale: "Disclosed to the authority under a covering lawful basis." };
}

export async function enforceCompliance(opts: {
  ruleset: MarketRuleset;
  intent: RequestIntent;
  fields: RetrievalComputedField[];
  link?: { authorityRequestId?: string };
}): Promise<EnforceResult> {
  const { ruleset, fields } = opts;
  const policy = ruleset.compliancePolicy;

  // deterministic actions first (authoritative)
  const planned = fields.map((f) => ({ field: f, ...deterministicAction(ruleset, f) }));

  // best-effort LLM rationale enrichment (does not change the action)
  let llmRationale: Record<string, string> = {};
  try {
    const res = await callLlm({
      agent: "ComplianceConstraintAgent",
      stage: "COMPLIANCE",
      promptId: "compliance.constraint",
      schema: ConstraintDecisionSetSchema,
      schemaName: "ConstraintDecisionSet",
      vars: {
        phase: "output",
        regime: policy.privacyRegime,
        storageRegion: policy.dataResidency.storageRegion,
        policy: {
          residency: policy.dataResidency,
          lawfulBases: policy.lawfulBases,
          restrictedDisclosureFieldKeys: policy.purposeLimitation.restrictedDisclosureFieldKeys,
        },
        lawfulBasisCited: opts.intent.legalBasis ?? "none cited",
        items: planned.map((p) => ({
          fieldKey: p.field.fieldKey,
          classification: ruleset.authorityFields.find((f) => f.key === p.field.fieldKey)?.classification,
          dataClass: ruleset.authorityFields.find((f) => f.key === p.field.fieldKey)?.dataClass,
          isList: Array.isArray(p.field.value),
        })),
      },
      link: opts.link,
    });
    for (const d of res.data.decisions) if (d.fieldKey) llmRationale[d.fieldKey] = d.rationale;
  } catch {
    llmRationale = {};
  }

  const outFields: RetrievalComputedField[] = [];
  const decisions: ConstraintDecision[] = [];
  const withheld: string[] = [];

  for (const p of planned) {
    const spec = ruleset.authorityFields.find((f) => f.key === p.field.fieldKey);
    const dataClass = spec?.dataClass ?? "DERIVED_AGGREGATE";
    const rationale = llmRationale[p.field.fieldKey] ?? p.rationale;
    decisions.push({
      phase: "output",
      dataClass,
      fieldKey: p.field.fieldKey,
      action: p.action,
      rule: p.rule,
      rationale,
      lawfulBasis: spec?.lawfulBasisTag ?? null,
    });

    if (p.action === "block") {
      withheld.push(p.field.fieldKey);
      continue; // omit from the dataset entirely
    }
    if (p.action === "aggregate" && Array.isArray(p.field.value)) {
      outFields.push({
        ...p.field,
        value: p.field.value.length,
        constraintApplied: "aggregated (PII minimization)",
        label: `${p.field.label} (aggregated count)`,
      });
      continue;
    }
    if (p.action === "mask" && Array.isArray(p.field.value)) {
      outFields.push({
        ...p.field,
        value: p.field.value.map((row) => {
          const r = { ...(row as Record<string, unknown>) };
          delete r.name;
          delete r.licenseNo;
          return r;
        }),
        constraintApplied: "masked (PII redacted)",
      });
      continue;
    }
    outFields.push(p.field);
  }

  return { fields: outFields, decisions, withheld };
}
