/*
 * Optional demo warm-up. Drives the §11 scenarios live through the running dev server so the
 * dashboard, Accuracy view, and Audit log open fully populated. Requires the dev server running
 * (it holds ANTHROPIC_API_KEY) and costs real tokens. Usage: `npm run dev` then `npm run db:warm`.
 */
const BASE = process.env.BASE ?? "http://localhost:3010";

async function login(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "reviewer@bolt.eu", password: "sentinel" }) });
  return (r.headers.get("set-cookie") ?? "").split(";")[0];
}

async function drive(cookie: string, processUrl: string, label: string) {
  const h = { cookie, "content-type": "application/json" };
  const proc = await (await fetch(`${BASE}${processUrl}`, { method: "POST", headers: h })).json();
  const runId = proc.data?.runId;
  if (!runId) {
    console.log(`  ${label}: could not start (${proc.error ?? "?"})`);
    return;
  }
  for (let i = 0; i < 12; i++) {
    const adv = await (await fetch(`${BASE}/api/pipelines/${runId}/advance`, { method: "POST", headers: h })).json();
    if (!adv.ok || !adv.data?.hasMore) break;
  }
  console.log(`  ${label}: done`);
}

async function main() {
  const { db } = await import("../lib/db");
  const cookie = await login();
  if (!cookie) throw new Error("login failed — is the dev server running on " + BASE + "?");

  console.log("Warming authority requests…");
  const arr = await db.authorityRequest.findMany({ where: { scenarioTag: { not: null } } });
  for (const r of arr) await drive(cookie, `/api/authority-requests/${r.id}/process`, r.reference);

  console.log("Warming onboarding partners…");
  const b1 = await db.fleetPartner.findMany({ where: { scenarioTag: { startsWith: "b1-" } } });
  for (const p of b1) await drive(cookie, `/api/partners/${p.id}/process`, p.reference);

  console.log("Running monitoring sweep…");
  const sweep = await (await fetch(`${BASE}/api/monitoring/sweep`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}" })).json();
  console.log("  sweep:", JSON.stringify(sweep.data ?? sweep));

  console.log("Warm complete.");
  await db.$disconnect();
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
