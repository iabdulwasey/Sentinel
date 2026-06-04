import { ScrollText, ShieldCheck, ShieldX, Cpu, User as UserIcon, Server } from "lucide-react";
import { db } from "@/lib/db";
import { verifyAuditChain } from "@/engine/governance/audit";
import { PageHeader } from "@/components/shared/page-header";
import { KpiStat } from "@/components/shared/kpi-stat";
import { formatCost, formatDurationMs } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const [entries, chain, aiAgg, aiByModel, totalEvents] = await Promise.all([
    db.auditLog.findMany({ orderBy: { id: "desc" }, take: 60, include: { actorUser: { select: { name: true } } } }),
    verifyAuditChain(),
    db.aiCallLog.aggregate({ _sum: { costMicroUsd: true, tokensIn: true, tokensOut: true }, _count: true }),
    db.aiCallLog.groupBy({ by: ["model"], _sum: { costMicroUsd: true }, _count: true }),
    db.auditLog.count(),
  ]);

  const ActorIcon = (t: string) => (t === "AI" ? Cpu : t === "HUMAN" ? UserIcon : Server);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Audit & Cost Ledger"
        description="Every action — human or AI — is appended to a tamper-evident, hash-chained log with model, prompt version, cost, and confidence."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4 shadow-2">
          <div className="flex items-center justify-between"><span className="text-xs font-medium text-ink-muted">Chain integrity</span></div>
          <div className="mt-2 flex items-center gap-2">
            {chain.ok ? <ShieldCheck className="size-5 text-success" /> : <ShieldX className="size-5 text-danger" />}
            <span className={chain.ok ? "text-lg font-semibold text-success" : "text-lg font-semibold text-danger"}>{chain.ok ? "Verified" : `Broken @ ${chain.brokenAt}`}</span>
          </div>
          <div className="mt-0.5 text-2xs text-ink-muted tabular-data">{totalEvents} entries</div>
        </div>
        <KpiStat label="AI cost (total)" value={formatCost(aiAgg._sum.costMicroUsd ?? 0)} sublabel={`${aiAgg._count} calls`} icon={Cpu} tone="brand" />
        <KpiStat label="Tokens in/out" value={`${(((aiAgg._sum.tokensIn ?? 0) + (aiAgg._sum.tokensOut ?? 0)) / 1000).toFixed(0)}k`} sublabel="input + output" />
        <div className="rounded-lg border border-border bg-card p-4 shadow-2">
          <span className="text-xs font-medium text-ink-muted">Cost by model</span>
          <ul className="mt-2 space-y-1 text-2xs">
            {aiByModel.map((m) => (
              <li key={m.model} className="flex justify-between"><span className="text-ink">{m.model.replace("claude-", "")}</span><span className="tabular-data text-ink-muted">{formatCost(m._sum.costMicroUsd ?? 0)} · {m._count}</span></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-2">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3"><ScrollText className="size-4 text-ink-muted" /> <h2 className="text-sm font-semibold text-ink">Audit log</h2></div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="th">#</th>
              <th className="th">Actor</th>
              <th className="th">Action</th>
              <th className="th">Entity</th>
              <th className="th">AI detail</th>
              <th className="th">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((e) => {
              const Icon = ActorIcon(e.actorType);
              return (
                <tr key={e.id} className="hover:bg-surface-sunken/40">
                  <td className="td tabular-data text-2xs text-ink-muted">{e.id}</td>
                  <td className="td">
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink">
                      <Icon className="size-3.5 text-ink-muted" /> {e.actorUser?.name ?? e.actorType}
                    </span>
                  </td>
                  <td className="td text-xs font-medium text-ink">{e.action}</td>
                  <td className="td text-2xs text-ink-muted">{e.entity}</td>
                  <td className="td text-2xs text-ink-muted tabular-data">
                    {e.aiModel ? `${e.aiModel.replace("claude-", "")}${e.promptVersion ? " · " + e.promptVersion : ""}${e.costMicroUsd ? " · " + formatCost(e.costMicroUsd) : ""}` : "—"}
                  </td>
                  <td className="td text-2xs text-ink-muted tabular-data">{e.ts.toISOString().slice(0, 19).replace("T", " ")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
