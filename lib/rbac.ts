/**
 * Role-based access control. Users hold one or more roles; a session has ONE active role (the
 * lens you act through — switch it in the top bar). Permissions derive from the active role.
 * Admins map roles to users in Settings → Team & Roles. The legacy User.role ("ADMIN"|"REVIEWER")
 * is kept in sync and derived from the active role so existing checks keep working.
 */

export interface RoleDef {
  key: string;
  label: string;
  description: string;
}

export const ROLES: RoleDef[] = [
  { key: "admin", label: "Administrator", description: "Full access — settings, users, connectors, and every surface." },
  { key: "compliance_reviewer", label: "Compliance Reviewer", description: "Review and approve authority-request reports." },
  { key: "onboarding_officer", label: "Onboarding Officer", description: "Make fleet-partner go / no-go decisions." },
  { key: "compliance_monitor", label: "Compliance Monitor", description: "Watch the live portfolio; remediate drift and expiries." },
  { key: "regulatory_author", label: "Regulatory Author", description: "Import regulations and activate market rulesets." },
  { key: "authority_liaison", label: "Authority Liaison", description: "Export and submit reports to authorities." },
  { key: "auditor", label: "Auditor", description: "Read-only access to audit, accuracy, and records." },
];
export const ROLE_KEYS = ROLES.map((r) => r.key);
export const ROLE_LABELS: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.key, r.label]));
export const ROLE_DESCRIPTIONS: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.key, r.description]));

export const PERMISSIONS = [
  "home.view",
  "arr.view",
  "arr.review",
  "arr.export",
  "onboarding.view",
  "onboarding.decide",
  "monitoring.view",
  "monitoring.act",
  "rules.view",
  "rules.author",
  "accuracy.view",
  "audit.view",
  "assistant.use",
  "settings.view",
  "settings.manage",
  "users.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Short labels for the RBAC matrix columns. */
export const PERMISSION_GROUPS: { label: string; perms: Permission[] }[] = [
  { label: "Authority requests", perms: ["arr.view", "arr.review", "arr.export"] },
  { label: "Fleet onboarding", perms: ["onboarding.view", "onboarding.decide"] },
  { label: "Monitoring", perms: ["monitoring.view", "monitoring.act"] },
  { label: "Rules", perms: ["rules.view", "rules.author"] },
  { label: "Insight", perms: ["accuracy.view", "audit.view", "assistant.use"] },
  { label: "Administration", perms: ["settings.view", "settings.manage", "users.manage"] },
];

const ALL: Permission[] = [...PERMISSIONS];
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: ALL,
  compliance_reviewer: ["home.view", "arr.view", "arr.review", "arr.export", "accuracy.view", "audit.view", "rules.view", "assistant.use", "settings.view"],
  onboarding_officer: ["home.view", "onboarding.view", "onboarding.decide", "rules.view", "assistant.use"],
  compliance_monitor: ["home.view", "monitoring.view", "monitoring.act", "rules.view", "assistant.use"],
  regulatory_author: ["home.view", "rules.view", "rules.author", "assistant.use"],
  authority_liaison: ["home.view", "arr.view", "arr.export", "assistant.use"],
  auditor: ["home.view", "audit.view", "accuracy.view", "rules.view", "arr.view", "onboarding.view", "monitoring.view", "assistant.use"],
};

export function permissionsForRoles(roles: string[]): Permission[] {
  const set = new Set<Permission>();
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r] ?? []) set.add(p);
  return [...set];
}
export function hasPermission(perms: string[], p: Permission): boolean {
  return perms.includes(p);
}
export function roleHasPermission(roleKey: string, p: Permission): boolean {
  return (ROLE_PERMISSIONS[roleKey] ?? []).includes(p);
}

/** Coerce a stored roles array (+ legacy single role) into a valid, non-empty role list. */
export function normalizeRoles(rawRoles: unknown, legacyRole?: string | null): string[] {
  const arr = Array.isArray(rawRoles) ? (rawRoles as unknown[]).filter((r): r is string => typeof r === "string" && ROLE_KEYS.includes(r)) : [];
  if (arr.length) return arr;
  return legacyRole === "ADMIN" ? ["admin"] : ["compliance_reviewer"];
}
export function defaultActiveRole(roles: string[]): string {
  return roles.includes("admin") ? "admin" : (roles[0] ?? "compliance_reviewer");
}
export function legacyRole(activeRole: string): "ADMIN" | "REVIEWER" {
  return activeRole === "admin" ? "ADMIN" : "REVIEWER";
}
export function deriveLegacyFromRoles(roles: string[]): "ADMIN" | "REVIEWER" {
  return roles.includes("admin") ? "ADMIN" : "REVIEWER";
}

/** Nav href → the permission required to see it. */
export const NAV_PERMISSION: Record<string, Permission> = {
  "/home": "home.view",
  "/authority-requests": "arr.view",
  "/fleet-onboarding": "onboarding.view",
  "/compliance-monitoring": "monitoring.view",
  "/rules": "rules.view",
  "/regulation-intake": "rules.author",
  "/accuracy": "accuracy.view",
  "/audit": "audit.view",
  "/assistant": "assistant.use",
  "/settings": "settings.view",
};
