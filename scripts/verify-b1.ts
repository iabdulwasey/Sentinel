/* Drives a live B1 onboarding pipeline through the running dev server and prints results. */
const BASE = process.env.BASE ?? "http://localhost:3010";

async function main() {
  const scenarioTag = process.argv[2] ?? "b1-name-mismatch";
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "reviewer@bolt.eu", password: "sentinel" }),
  });
  const cookie = (loginRes.headers.get("set-cookie") ?? "").split(";")[0];
  const h = { cookie, "content-type": "application/json" };

  const { db } = await import("../lib/db");
  const p = await db.fleetPartner.findFirst({ where: { scenarioTag } });
  if (!p) throw new Error(`no partner for ${scenarioTag}`);
  console.log(`Partner ${p.reference} (${scenarioTag}) ${p.legalName} status=${p.status}`);

  const proc = await (await fetch(`${BASE}/api/partners/${p.id}/process`, { method: "POST", headers: h })).json();
  const runId = proc.data.runId;
  console.log(`runId=${runId}`);

  for (let i = 0; i < 8; i++) {
    const t0 = Date.now();
    const adv = await (await fetch(`${BASE}/api/pipelines/${runId}/advance`, { method: "POST", headers: h })).json();
    const st = await (await fetch(`${BASE}/api/pipelines/${runId}/status`, { headers: h })).json();
    console.log(`  +${((Date.now() - t0) / 1000).toFixed(1)}s  ${adv.data?.ranStage ?? "?"} → run=${st.data?.status}`);
    if (!adv.ok || !adv.data?.hasMore) break;
  }

  const final = await db.fleetPartner.findUnique({
    where: { id: p.id },
    include: { documents: true, validations: true, crossChecks: true, riskAssessments: { where: { isCurrent: true } } },
  });
  console.log(`\nFinal status: ${final?.status} · risk ${final?.riskScore}/${final?.riskBand} · completeness ${final?.completenessPct}%`);
  console.log(`Docs extraction confidence: ${final?.documents.map((d) => `${d.docType}=${d.extractionConfidence?.toFixed(2) ?? "-"}(${d.status})`).join(", ")}`);
  console.log(`Cross-checks: ${final?.crossChecks.map((c) => `${c.checkId}:${c.outcome}`).join(", ")}`);
  const fails = final?.validations.filter((v) => v.outcome === "FAIL") ?? [];
  console.log(`Validation fails (${fails.length}): ${fails.map((v) => v.ruleId).join(", ")}`);
  const dec = final?.decision as { outcome?: string; conditions?: string[]; rationale?: string; confidence?: number } | null;
  console.log(`Decision: ${dec?.outcome} (conf ${dec?.confidence}) conditions=${dec?.conditions?.length ?? 0}`);
  console.log(`  rationale: ${dec?.rationale?.slice(0, 220)}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
