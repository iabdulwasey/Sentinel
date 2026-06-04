/* Drives a live ARR pipeline through the running dev server and prints stage-by-stage results. */
const BASE = process.env.BASE ?? "http://localhost:3010";

async function main() {
  const scenarioTag = process.argv[2] ?? "arr-tallinn-clean";
  // login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "reviewer@bolt.eu", password: "sentinel" }),
  });
  const cookie = (loginRes.headers.get("set-cookie") ?? "").split(";")[0];
  if (!cookie) throw new Error("login failed");
  const h = { cookie, "content-type": "application/json" };

  // resolve the request id from the DB
  const { db } = await import("../lib/db");
  const reqRow = await db.authorityRequest.findFirst({ where: { scenarioTag } });
  if (!reqRow) throw new Error(`no request for ${scenarioTag}`);
  console.log(`Request ${reqRow.reference} (${scenarioTag}) status=${reqRow.status}`);

  const proc = await (await fetch(`${BASE}/api/authority-requests/${reqRow.id}/process`, { method: "POST", headers: h })).json();
  const runId = proc.data.runId;
  console.log(`runId=${runId}`);

  for (let i = 0; i < 10; i++) {
    const t0 = Date.now();
    const adv = await (await fetch(`${BASE}/api/pipelines/${runId}/advance`, { method: "POST", headers: h })).json();
    const st = await (await fetch(`${BASE}/api/pipelines/${runId}/status`, { headers: h })).json();
    console.log(`  +${((Date.now() - t0) / 1000).toFixed(1)}s  ${adv.data?.ranStage ?? "?"} → run=${st.data?.status}`);
    if (!adv.ok) {
      console.log("  advance error:", adv.error);
      break;
    }
    if (!adv.data?.hasMore) break;
  }

  const final = await db.authorityRequest.findUnique({ where: { id: reqRow.id }, include: { reportFields: true } });
  const report = final?.generatedReport as { title?: string; figures?: { fieldKey: string; value: unknown }[] } | null;
  const selfVal = final?.selfValidation as { overallConfidence?: number; allFiguresVerified?: boolean } | null;
  console.log(`\nFinal status: ${final?.status}`);
  console.log(`Report: ${report?.title ?? "(none)"}`);
  console.log(`Figures: ${(report?.figures ?? []).map((f) => `${f.fieldKey}=${f.value}`).join(", ")}`);
  console.log(`Self-validation: confidence=${selfVal?.overallConfidence} allVerified=${selfVal?.allFiguresVerified}`);
  console.log(`ReportFields: ${final?.reportFields.length} (verified: ${final?.reportFields.filter((f) => f.verified).length})`);

  const calls = await db.aiCallLog.findMany({ where: { authorityRequestId: reqRow.id }, orderBy: { createdAt: "asc" } });
  console.log(`\nAI calls: ${calls.length}`);
  for (const c of calls) console.log(`  ${c.agent} (${c.model.replace("claude-", "")}, ${c.promptVersion}) ${c.tokensIn}+${c.tokensOut}tok ${(c.costMicroUsd / 1e6).toFixed(4)}$ ${c.latencyMs}ms ${c.ok ? "ok" : "ERR:" + c.errorText}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
