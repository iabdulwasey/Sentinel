"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  SlidersHorizontal, Sparkles, Plug, GitBranch, Target, ShieldCheck, Users, Bell, Lock,
  Loader2, Check, KeyRound, Eye, EyeOff, Copy, Trash2, Plus, Database, HardDrive, Webhook,
  CheckCircle2, AlertTriangle, Sun, Moon, Monitor, ArrowUpRight, ShieldAlert,
} from "lucide-react";
import { Panel } from "@/components/shared/panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Settings } from "@/lib/settings";
import { ROLES, PERMISSION_GROUPS, roleHasPermission } from "@/lib/rbac";

interface Meta {
  role: "ADMIN" | "REVIEWER";
  permissions: string[];
  activeRole: string;
  keyStatus: { source: string; last4: string | null };
  defaultModels: Record<string, string>;
  rateCard: Record<string, { input: number; output: number }>;
  liveThresholds: { PASS: number; REVIEW: number };
  datastore: string;
  storage: string;
  users: { id: string; name: string; email: string; roles: string[]; isActive: boolean }[];
  markets: { code: string; country: string; activeRulesetVersion: number }[];
  counts: { partners: number; requests: number; runs: number; audit: number };
  spendUsd: number;
}

const TABS = [
  { key: "general", label: "General", icon: SlidersHorizontal },
  { key: "ai", label: "AI & Models", icon: Sparkles },
  { key: "connectors", label: "Connectors & Data", icon: Plug },
  { key: "approvals", label: "Approval Workflows", icon: GitBranch },
  { key: "accuracy", label: "Confidence & Accuracy", icon: Target },
  { key: "compliance", label: "Compliance & Data", icon: ShieldCheck },
  { key: "team", label: "Team & Roles", icon: Users },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "security", label: "Audit & Security", icon: Lock },
] as const;

const MODEL_OPTIONS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5 — fast" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6 — balanced" },
  { id: "claude-opus-4-8", label: "Opus 4.8 — reasoning" },
];

const inputBase = "h-9 rounded-md border border-border bg-surface-sunken px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-brand-400 focus:ring-3 focus:ring-brand-500/15";

export function SettingsClient({ settings, meta }: { settings: Settings; meta: Meta }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("general");
  const [draft, setDraft] = useState<Settings>(settings);
  const [saving, setSaving] = useState<string | null>(null);
  const isAdmin = meta.permissions.includes("users.manage");

  function set<K extends keyof Settings>(section: K, value: Settings[K]) {
    setDraft((d) => ({ ...d, [section]: value }));
  }

  async function save(section: keyof Settings) {
    setSaving(section);
    try {
      const res = await fetch("/api/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ section, data: draft[section] }) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      toast.success("Settings saved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[212px_1fr]">
      {/* tab nav */}
      <nav className="flex gap-1 overflow-x-auto lg:sticky lg:top-20 lg:h-fit lg:flex-col lg:overflow-visible">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors lg:w-full",
                active ? "bg-brand-50 font-medium text-brand-800" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
              )}
            >
              <Icon className={cn("size-4 shrink-0", active ? "text-brand-700" : "text-ink-muted")} strokeWidth={2} />
              <span className="whitespace-nowrap">{t.label}</span>
            </button>
          );
        })}
      </nav>

      {/* content */}
      <div className="min-w-0 space-y-5">
        {tab === "general" && <GeneralTab draft={draft} set={set} save={save} saving={saving} meta={meta} />}
        {tab === "ai" && <AiTab draft={draft} set={set} save={save} saving={saving} meta={meta} isAdmin={isAdmin} onKeyChange={() => router.refresh()} />}
        {tab === "connectors" && <ConnectorsTab draft={draft} set={set} save={save} saving={saving} meta={meta} isAdmin={isAdmin} onTokens={() => router.refresh()} />}
        {tab === "approvals" && <ApprovalsTab draft={draft} set={set} save={save} saving={saving} />}
        {tab === "accuracy" && <AccuracyTab draft={draft} set={set} save={save} saving={saving} meta={meta} />}
        {tab === "compliance" && <ComplianceTab draft={draft} set={set} save={save} saving={saving} />}
        {tab === "team" && <TeamTab meta={meta} isAdmin={isAdmin} onChange={() => router.refresh()} />}
        {tab === "notifications" && <NotificationsTab draft={draft} set={set} save={save} saving={saving} />}
        {tab === "security" && <SecurityTab draft={draft} set={set} save={save} saving={saving} />}
      </div>
    </div>
  );
}

// ── shared primitives ───────────────────────────────────────────────────────
function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink">{title}</div>
        {desc && <div className="meta mt-0.5 max-w-md leading-relaxed">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
function Rows({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-border">{children}</div>;
}
function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", checked ? "bg-brand-500" : "bg-border-strong", disabled && "cursor-not-allowed opacity-50")}>
      <span className={cn("inline-block size-4 transform rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
    </button>
  );
}
function Pct({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <input type="number" min={0} max={100} value={Math.round(value * 100)} disabled={disabled} onChange={(e) => onChange(Math.min(1, Math.max(0, (Number(e.target.value) || 0) / 100)))} className={cn(inputBase, "w-[72px] text-right tabular-data")} />
      <span className="meta">%</span>
    </span>
  );
}
function Num({ value, onChange, suffix, width = "w-24" }: { value: number; onChange: (v: number) => void; suffix?: string; width?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} className={cn(inputBase, width, "text-right tabular-data")} />
      {suffix && <span className="meta">{suffix}</span>}
    </span>
  );
}
function SaveBar({ onSave, saving, dirtyKey }: { onSave: () => void; saving: string | null; dirtyKey: string }) {
  return (
    <div className="flex justify-end border-t border-border px-5 py-3">
      <Button onClick={onSave} disabled={saving === dirtyKey} size="sm">
        {saving === dirtyKey ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save changes
      </Button>
    </div>
  );
}
function Dot({ ok }: { ok: boolean }) {
  return <span className={cn("inline-block size-2 rounded-full", ok ? "bg-success" : "bg-warning")} />;
}

// ── General ─────────────────────────────────────────────────────────────────
function GeneralTab({ draft, set, save, saving, meta }: { draft: Settings; set: <K extends keyof Settings>(s: K, v: Settings[K]) => void; save: (s: keyof Settings) => void; saving: string | null; meta: Meta }) {
  function setTheme(mode: "light" | "dark" | "system") {
    const isDark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
    document.cookie = `theme=${isDark ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
    try { localStorage.setItem("theme", isDark ? "dark" : "light"); } catch {}
    toast.success(`Theme: ${mode}`);
  }
  return (
    <>
      <Panel title="Workspace" icon={SlidersHorizontal} flush>
        <div className="px-5">
          <Rows>
            <Row title="Workspace name" desc="Shown across the console.">
              <input value={draft.general.workspaceName} onChange={(e) => set("general", { ...draft.general, workspaceName: e.target.value })} className={cn(inputBase, "w-56")} />
            </Row>
            <Row title="Default market" desc="The market filter applied when you open the console.">
              <select value={draft.general.defaultMarket} onChange={(e) => set("general", { ...draft.general, defaultMarket: e.target.value })} className={cn(inputBase, "w-56")}>
                <option value="ALL">All markets</option>
                {meta.markets.map((m) => <option key={m.code} value={m.code}>{m.country} ({m.code})</option>)}
              </select>
            </Row>
            <Row title="Manual baseline" desc="Hours a request/onboarding takes by hand — the benchmark behind 'time saved'.">
              <Num value={draft.general.manualBaselineHours} onChange={(v) => set("general", { ...draft.general, manualBaselineHours: v })} suffix="hours" />
            </Row>
          </Rows>
        </div>
        <SaveBar onSave={() => save("general")} saving={saving} dirtyKey="general" />
      </Panel>

      <Panel title="Appearance" icon={Sun}>
        <div className="flex items-center justify-between gap-4">
          <div className="meta max-w-md leading-relaxed">Theme preference for this device. Dark is the default; your choice is remembered.</div>
          <div className="flex gap-1.5">
            {[{ m: "light", I: Sun }, { m: "dark", I: Moon }, { m: "system", I: Monitor }].map(({ m, I }) => (
              <button key={m} onClick={() => setTheme(m as "light" | "dark" | "system")} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-border-strong hover:text-ink">
                <I className="size-3.5" /> <span className="capitalize">{m}</span>
              </button>
            ))}
          </div>
        </div>
      </Panel>
    </>
  );
}

// ── AI & Models ──────────────────────────────────────────────────────────────
function AiTab({ draft, set, save, saving, meta, isAdmin, onKeyChange }: { draft: Settings; set: <K extends keyof Settings>(s: K, v: Settings[K]) => void; save: (s: keyof Settings) => void; saving: string | null; meta: Meta; isAdmin: boolean; onKeyChange: () => void }) {
  const [keyInput, setKeyInput] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const connected = meta.keyStatus.source !== "none";

  async function saveKey(clear = false) {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/anthropic-key", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: clear ? null : keyInput }) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      toast.success(clear ? "Key cleared — falling back to env" : "API key saved");
      setKeyInput("");
      onKeyChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Panel title="Anthropic API key" icon={KeyRound}>
        <div className="flex items-center gap-2 text-[13px]">
          <Dot ok={connected} />
          {connected ? (
            <span className="text-ink">Connected · key ending <span className="tabular-data font-medium">…{meta.keyStatus.last4}</span> <span className="meta">({meta.keyStatus.source === "override" ? "set here" : "from environment"})</span></span>
          ) : (
            <span className="text-warning">No key configured — live AI calls will fail.</span>
          )}
        </div>
        {isAdmin ? (
          <div className="mt-4 space-y-3">
            <div className="relative">
              <input type={show ? "text" : "password"} value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="sk-ant-…" className={cn(inputBase, "h-10 w-full pr-10 font-mono")} />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-muted hover:text-ink">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => saveKey(false)} disabled={busy || !keyInput.trim()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save key</Button>
              {meta.keyStatus.source === "override" && <Button size="sm" variant="outline" onClick={() => saveKey(true)} disabled={busy}>Clear override</Button>}
              <span className="meta">Stored server-side, never displayed. Overrides the env var.</span>
            </div>
          </div>
        ) : (
          <p className="meta mt-3">Only admins can change the API key.</p>
        )}
      </Panel>

      <Panel title="Model routing" icon={Sparkles} flush>
        <div className="px-5">
          <p className="meta py-3 leading-relaxed">Each agent runs on a tier; pick the model per tier. Reasoning handles legal interpretation, extraction, generation, and synthesis; balanced handles mapping/scoring; fast handles forecasting.</p>
          <Rows>
            {(["fast", "balanced", "reasoning"] as const).map((tier) => (
              <Row key={tier} title={`${tier[0].toUpperCase()}${tier.slice(1)} tier`} desc={`Default ${MODEL_OPTIONS.find((m) => m.id === meta.defaultModels[tier])?.label ?? meta.defaultModels[tier]} · $${meta.rateCard[draft.ai.tiers[tier]]?.input}/$${meta.rateCard[draft.ai.tiers[tier]]?.output} per 1M in/out`}>
                <select value={draft.ai.tiers[tier]} onChange={(e) => set("ai", { ...draft.ai, tiers: { ...draft.ai.tiers, [tier]: e.target.value as Settings["ai"]["tiers"]["fast"] } })} className={cn(inputBase, "w-56")}>
                  {MODEL_OPTIONS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </Row>
            ))}
            <Row title="Prompt caching" desc="Cache the system prompt + ruleset prefix (5-min TTL) to cut cost and latency.">
              <Toggle checked={draft.ai.promptCaching} onChange={(v) => set("ai", { ...draft.ai, promptCaching: v })} />
            </Row>
            <Row title="Monthly budget alert" desc={`AI spend to date: $${meta.spendUsd.toFixed(2)}. Warn when the month exceeds this.`}>
              <Num value={draft.ai.monthlyBudgetUsd ?? 0} onChange={(v) => set("ai", { ...draft.ai, monthlyBudgetUsd: v })} suffix="USD" />
            </Row>
          </Rows>
        </div>
        <SaveBar onSave={() => save("ai")} saving={saving} dirtyKey="ai" />
      </Panel>
    </>
  );
}

// ── Connectors & Data ─────────────────────────────────────────────────────────
const ARR_CHANNELS = ["manual", "email", "portal", "webhook", "api"];
const ONB_CHANNELS = ["manual", "portal", "upload", "webhook", "api"];
function ChannelChips({ all, selected, onToggle }: { all: string[]; selected: string[]; onToggle: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((c) => {
        const on = selected.includes(c);
        return (
          <button key={c} type="button" onClick={() => onToggle(c)} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors", on ? "border-brand-400 bg-brand-50 text-brand-700" : "border-border bg-surface text-ink-muted hover:border-border-strong")}>{c}</button>
        );
      })}
    </div>
  );
}
function ConnectorsTab({ draft, set, save, saving, meta, isAdmin, onTokens }: { draft: Settings; set: <K extends keyof Settings>(s: K, v: Settings[K]) => void; save: (s: keyof Settings) => void; saving: string | null; meta: Meta; isAdmin: boolean; onTokens: () => void }) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const c = draft.connectors;

  function toggleChannel(field: "arrIntakeChannels" | "onboardingIntakeChannels", ch: string) {
    const cur = c[field];
    set("connectors", { ...c, [field]: cur.includes(ch) ? cur.filter((x) => x !== ch) : [...cur, ch] });
  }
  async function genToken() {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/api-tokens", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label }) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      setRevealed(j.data.token);
      setLabel("");
      onTokens();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    const res = await fetch(`/api/settings/api-tokens?id=${id}`, { method: "DELETE" });
    const j = await res.json();
    if (j.ok) { toast.success("Token revoked"); onTokens(); } else toast.error(j.error);
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Panel title="Operations datastore" icon={Database}>
          <div className="flex items-center gap-2 text-[13px] text-ink"><Dot ok /> {meta.datastore === "turso" ? "Turso (libSQL)" : "SQLite (local)"}<span className="meta">· connected</span></div>
          <p className="meta mt-2 leading-relaxed">The source of truth for partners, drivers, vehicles, and trips. The deterministic executor queries it — the LLM never does.</p>
        </Panel>
        <Panel title="Document storage" icon={HardDrive}>
          <div className="flex items-center gap-2 text-[13px] text-ink"><Dot ok /> {meta.storage === "vercel-blob" ? "Vercel Blob" : "Local filesystem"}<span className="meta">· connected</span></div>
          <p className="meta mt-2 leading-relaxed">Where uploaded partner documents and regulation PDFs are stored and fetched for native PDF reading.</p>
        </Panel>
      </div>

      <Panel title="Data intake channels" icon={Plug} flush>
        <div className="px-5">
          <Rows>
            <Row title="Authority requests" desc="Where regulator requests enter Sentinel for the ARR pipeline.">
              <ChannelChips all={ARR_CHANNELS} selected={c.arrIntakeChannels} onToggle={(ch) => toggleChannel("arrIntakeChannels", ch)} />
            </Row>
            <Row title="Partner onboarding" desc="Where fleet-partner document packs arrive for the B1 pipeline.">
              <ChannelChips all={ONB_CHANNELS} selected={c.onboardingIntakeChannels} onToggle={(ch) => toggleChannel("onboardingIntakeChannels", ch)} />
            </Row>
            <Row title="Inbound webhook" desc="Accept pushed intake events at the endpoint below (HMAC-signed with an ingest token).">
              <Toggle checked={c.inboundWebhookEnabled} onChange={(v) => set("connectors", { ...c, inboundWebhookEnabled: v })} />
            </Row>
          </Rows>
          {c.inboundWebhookEnabled && (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-surface-sunken px-3 py-2">
              <Webhook className="size-3.5 shrink-0 text-ink-muted" />
              <code className="truncate font-mono text-[11px] text-ink">{typeof window !== "undefined" ? window.location.origin : ""}/api/ingest/webhook</code>
            </div>
          )}
        </div>
        <SaveBar onSave={() => save("connectors")} saving={saving} dirtyKey="connectors" />
      </Panel>

      <Panel title="API ingest tokens" icon={KeyRound} flush>
        <div className="px-5 py-1">
          {c.apiTokens.length === 0 ? (
            <p className="meta py-3">No tokens yet. Generate one for an external system to push data into Sentinel.</p>
          ) : (
            <ul className="divide-y divide-border">
              {c.apiTokens.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-ink">{t.label}</div>
                    <div className="meta tabular-data">{t.preview} · {new Date(t.createdAt).toISOString().slice(0, 10)}</div>
                  </div>
                  {isAdmin && <button onClick={() => revoke(t.id)} className="rounded-md p-1.5 text-ink-muted transition-colors hover:bg-danger-muted hover:text-danger"><Trash2 className="size-4" /></button>}
                </li>
              ))}
            </ul>
          )}
          {revealed && (
            <div className="my-3 rounded-md border border-brand-200 bg-brand-50 p-3">
              <div className="meta mb-1 flex items-center gap-1.5 text-brand-800"><CheckCircle2 className="size-3.5" /> Copy this token now — it won&rsquo;t be shown again.</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate font-mono text-[11px] text-ink">{revealed}</code>
                <button onClick={() => { navigator.clipboard?.writeText(revealed); toast.success("Copied"); }} className="rounded-md p-1.5 text-ink-muted hover:text-ink"><Copy className="size-3.5" /></button>
              </div>
            </div>
          )}
          {isAdmin && (
            <div className="flex items-center gap-2 py-3">
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Token label (e.g. Partner portal)" className={cn(inputBase, "flex-1")} />
              <Button size="sm" onClick={genToken} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Generate</Button>
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}

// ── Approval Workflows ─────────────────────────────────────────────────────────
function ApprovalsTab({ draft, set, save, saving }: { draft: Settings; set: <K extends keyof Settings>(s: K, v: Settings[K]) => void; save: (s: keyof Settings) => void; saving: string | null }) {
  const a = draft.approvals;
  const gates = [
    { surface: "Authority Requests (ARR)", locked: "AI never submits to an authority — a human approves every export before submission." },
    { surface: "Fleet Onboarding (B1)", locked: "AI never auto-approves or rejects a partner — a human makes every go/no-go decision." },
    { surface: "Compliance Monitoring (B2)", locked: "AI never auto-suspends — drift and expiries are routed to a human." },
  ];
  return (
    <>
      <Panel title="Human-in-the-loop gates" icon={GitBranch}>
        <p className="meta mb-3 leading-relaxed">These gates are non-negotiable governance — AI proposes, a human binds. They can&rsquo;t be turned off.</p>
        <ul className="space-y-2.5">
          {gates.map((g) => (
            <li key={g.surface} className="flex items-start gap-2.5 rounded-md border border-border bg-surface-sunken/50 px-3 py-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
              <div><div className="text-[13px] font-medium text-ink">{g.surface}</div><div className="meta mt-0.5 leading-relaxed">{g.locked}</div></div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Approval policy" icon={GitBranch} flush>
        <div className="px-5">
          <Rows>
            <Row title="Dual approval — authority export" desc="Require a second reviewer to co-sign before an ARR report can be exported for submission.">
              <Toggle checked={a.dualApprovalForArrExport} onChange={(v) => set("approvals", { ...a, dualApprovalForArrExport: v })} />
            </Row>
            <Row title="Dual approval — partner rejection" desc="Require a second reviewer to confirm a fleet-partner rejection.">
              <Toggle checked={a.dualApprovalForPartnerReject} onChange={(v) => set("approvals", { ...a, dualApprovalForPartnerReject: v })} />
            </Row>
            <Row title="Dual approval — suspension recommendation" desc="Require a second reviewer before a suspension is recommended to operations.">
              <Toggle checked={a.dualApprovalForSuspension} onChange={(v) => set("approvals", { ...a, dualApprovalForSuspension: v })} />
            </Row>
            <Row title="Auto-route low-confidence to review" desc="Outputs below the review threshold are flagged for mandatory human attention.">
              <Toggle checked={a.autoRouteBelowConfidence} onChange={(v) => set("approvals", { ...a, autoRouteBelowConfidence: v })} />
            </Row>
          </Rows>
        </div>
        <SaveBar onSave={() => save("approvals")} saving={saving} dirtyKey="approvals" />
      </Panel>
    </>
  );
}

// ── Confidence & Accuracy ─────────────────────────────────────────────────────
function AccuracyTab({ draft, set, save, saving, meta }: { draft: Settings; set: <K extends keyof Settings>(s: K, v: Settings[K]) => void; save: (s: keyof Settings) => void; saving: string | null; meta: Meta }) {
  const a = draft.accuracy;
  return (
    <Panel title="Confidence-gating policy (§7.B)" icon={Target} flush>
      <div className="px-5">
        <p className="meta py-3 leading-relaxed">The thresholds that decide when a figure passes silently, gets soft-flagged, or hard-blocks for human review. Applied everywhere a figure is produced.</p>
        <Rows>
          <Row title="Pass threshold" desc="At or above this, standard fields are accepted silently.">
            <Pct value={a.passThreshold} onChange={(v) => set("accuracy", { ...a, passThreshold: v })} />
          </Row>
          <Row title="Review threshold" desc="Below pass and at/above this → completes but flagged for a human.">
            <Pct value={a.reviewThreshold} onChange={(v) => set("accuracy", { ...a, reviewThreshold: v })} />
          </Row>
          <Row title="Financial fields" desc="Higher bar for monetary figures.">
            <Pct value={a.financialThreshold} onChange={(v) => set("accuracy", { ...a, financialThreshold: v })} />
          </Row>
          <Row title="Sensitive / special-category fields" desc="Highest bar for sensitive personal data.">
            <Pct value={a.sensitiveThreshold} onChange={(v) => set("accuracy", { ...a, sensitiveThreshold: v })} />
          </Row>
          <Row title="Block on unverified figure" desc="Hard-block if a figure fails the deterministic figure-vs-source check.">
            <Toggle checked={a.blockOnUnverifiedFigure} onChange={(v) => set("accuracy", { ...a, blockOnUnverifiedFigure: v })} />
          </Row>
          <Row title="Block on validation mismatch" desc="Hard-block if self-validation flags a checklist mismatch.">
            <Toggle checked={a.blockOnValidationMismatch} onChange={(v) => set("accuracy", { ...a, blockOnValidationMismatch: v })} />
          </Row>
        </Rows>
        <div className="meta py-3">Engine defaults: pass {Math.round(meta.liveThresholds.PASS * 100)}% · review {Math.round(meta.liveThresholds.REVIEW * 100)}%. <Link href="/accuracy" className="text-brand-700 hover:underline">View accuracy →</Link></div>
      </div>
      <SaveBar onSave={() => save("accuracy")} saving={saving} dirtyKey="accuracy" />
    </Panel>
  );
}

// ── Compliance & Data ──────────────────────────────────────────────────────────
function ComplianceTab({ draft, set, save, saving }: { draft: Settings; set: <K extends keyof Settings>(s: K, v: Settings[K]) => void; save: (s: keyof Settings) => void; saving: string | null }) {
  const c = draft.compliance;
  return (
    <Panel title="Compliance & data policy (§7.A)" icon={ShieldCheck} flush>
      <div className="px-5">
        <p className="meta py-3 leading-relaxed">Org-level defaults. Per-market residency, lawful bases, and retention are defined in each ruleset — see <Link href="/rules" className="text-brand-700 hover:underline">Markets &amp; Rules</Link>.</p>
        <Rows>
          <Row title="Block cross-border transfers by default" desc="Unless a market ruleset explicitly permits it (e.g. NDPA strict residency).">
            <Toggle checked={c.blockCrossBorderByDefault} onChange={(v) => set("compliance", { ...c, blockCrossBorderByDefault: v })} />
          </Row>
          <Row title="Document retention" desc="How long partner documents are retained.">
            <Num value={c.documentRetentionMonths} onChange={(v) => set("compliance", { ...c, documentRetentionMonths: v })} suffix="months" />
          </Row>
          <Row title="Audit log retention" desc="How long the hash-chained audit log is retained.">
            <Num value={c.auditRetentionMonths} onChange={(v) => set("compliance", { ...c, auditRetentionMonths: v })} suffix="months" />
          </Row>
          <Row title="Auto-purge after retention" desc="Automatically purge records once past their retention window.">
            <Toggle checked={c.autoPurgeAfterRetention} onChange={(v) => set("compliance", { ...c, autoPurgeAfterRetention: v })} />
          </Row>
        </Rows>
      </div>
      <SaveBar onSave={() => save("compliance")} saving={saving} dirtyKey="compliance" />
    </Panel>
  );
}

// ── Team & Roles ────────────────────────────────────────────────────────────────
function RoleChips({ selected, onToggle, disabled }: { selected: string[]; onToggle: (r: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ROLES.map((r) => {
        const on = selected.includes(r.key);
        return (
          <button key={r.key} type="button" disabled={disabled} title={r.description} onClick={() => onToggle(r.key)} className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors", on ? "border-brand-400 bg-brand-50 text-brand-700" : "border-border bg-surface text-ink-muted hover:border-border-strong", disabled && "cursor-default opacity-80 hover:border-border")}>
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function TeamTab({ meta, isAdmin, onChange }: { meta: Meta; isAdmin: boolean; onChange: () => void }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ name: string; email: string; password: string; roles: string[] }>({ name: "", email: "", password: "", roles: ["compliance_reviewer"] });
  const [busy, setBusy] = useState(false);
  const [draftRoles, setDraftRoles] = useState<Record<string, string[]>>(() => Object.fromEntries(meta.users.map((u) => [u.id, u.roles])));

  async function patchUser(id: string, data: { roles?: string[]; isActive?: boolean }) {
    const res = await fetch("/api/settings/users", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...data }) });
    const j = await res.json();
    if (j.ok) { toast.success("Updated"); onChange(); } else toast.error(j.error);
  }
  function toggleRole(id: string, roleKey: string) {
    const cur = draftRoles[id] ?? [];
    const next = cur.includes(roleKey) ? cur.filter((r) => r !== roleKey) : [...cur, roleKey];
    if (next.length === 0) { toast.error("A user needs at least one role."); return; }
    setDraftRoles((d) => ({ ...d, [id]: next }));
    patchUser(id, { roles: next });
  }
  function toggleFormRole(roleKey: string) {
    setForm((f) => ({ ...f, roles: f.roles.includes(roleKey) ? f.roles.filter((r) => r !== roleKey) : [...f.roles, roleKey] }));
  }
  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/users", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      toast.success(`${form.email} added`);
      setForm({ name: "", email: "", password: "", roles: ["compliance_reviewer"] });
      setAdding(false);
      onChange();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }

  return (
    <>
      <Panel title={`Team · ${meta.users.length}`} icon={Users} flush actions={isAdmin ? <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}><Plus className="size-4" /> Add teammate</Button> : undefined}>
        {adding && (
          <div className="space-y-3 border-b border-border bg-surface-sunken/50 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" className={cn(inputBase, "min-w-40 flex-1")} />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@bolt.eu" className={cn(inputBase, "min-w-48 flex-1")} />
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Set a password" className={cn(inputBase, "min-w-40 flex-1")} />
            </div>
            <div>
              <div className="eyebrow mb-1.5">Assign roles</div>
              <RoleChips selected={form.roles} onToggle={toggleFormRole} />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={add} disabled={busy || !form.email || !form.name || form.password.length < 6}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Create user</Button>
            </div>
          </div>
        )}
        <table className="w-full">
          <thead><tr className="border-b border-border"><th className="th">User</th><th className="th">Roles</th><th className="th text-right">Active</th></tr></thead>
          <tbody className="divide-y divide-border">
            {meta.users.map((u) => (
              <tr key={u.id}>
                <td className="td align-top">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-full bg-brand-500/15 text-[11px] font-semibold text-brand-700">{u.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}</span>
                    <div><div className="text-[13px] font-medium text-ink">{u.name}</div><div className="meta">{u.email}</div></div>
                  </div>
                </td>
                <td className="td"><RoleChips selected={draftRoles[u.id] ?? u.roles} onToggle={(r) => toggleRole(u.id, r)} disabled={!isAdmin} /></td>
                <td className="td text-right"><div className="flex justify-end"><Toggle checked={u.isActive} disabled={!isAdmin} onChange={(v) => patchUser(u.id, { isActive: v })} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isAdmin && <p className="meta px-5 py-3">You can view the team. Only admins can assign roles or add teammates.</p>}
      </Panel>

      {/* RBAC matrix */}
      <Panel title="Roles & permissions (RBAC)" icon={ShieldCheck} flush>
        <div className="scroll-slim overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-border">
                <th className="th">Role</th>
                {PERMISSION_GROUPS.map((g) => <th key={g.label} className="th text-center">{g.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ROLES.map((r) => (
                <tr key={r.key}>
                  <td className="td">
                    <div className="text-[13px] font-medium text-ink">{r.label}</div>
                    <div className="meta max-w-xs leading-snug">{r.description}</div>
                  </td>
                  {PERMISSION_GROUPS.map((g) => {
                    const granted = g.perms.filter((p) => roleHasPermission(r.key, p)).length;
                    const full = granted === g.perms.length;
                    return (
                      <td key={g.label} className="td text-center">
                        {full ? <Check className="mx-auto size-4 text-brand-600" /> : granted > 0 ? <span className="mx-auto block size-1.5 rounded-full bg-warning" /> : <span className="text-ink-muted">–</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="meta flex items-center gap-3 border-t border-border px-5 py-3">
          <span className="inline-flex items-center gap-1"><Check className="size-3.5 text-brand-600" /> full</span>
          <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-warning" /> partial</span>
          <span className="inline-flex items-center gap-1">– none</span>
        </div>
      </Panel>
    </>
  );
}

// ── Notifications ────────────────────────────────────────────────────────────────
function NotificationsTab({ draft, set, save, saving }: { draft: Settings; set: <K extends keyof Settings>(s: K, v: Settings[K]) => void; save: (s: keyof Settings) => void; saving: string | null }) {
  const n = draft.notifications;
  const triggers: { key: keyof Settings["notifications"]["triggers"]; title: string; desc: string }[] = [
    { key: "expiryForecast", title: "Expiry forecast", desc: "Upcoming credential / inspection expiries." },
    { key: "driftDetected", title: "Drift detected", desc: "New vehicles without valid documents, fleet growth, lapses." },
    { key: "pendingReview", title: "Pending review", desc: "A pipeline opened a human-in-the-loop gate." },
    { key: "slaBreach", title: "SLA breach", desc: "An authority-request deadline is at risk." },
    { key: "rulesetReflag", title: "Ruleset re-flag", desc: "A ruleset update requires partner re-validation." },
    { key: "lowConfidenceBlock", title: "Low-confidence block", desc: "An output blocked on a confidence gate." },
  ];
  return (
    <>
      <Panel title="Notification triggers" icon={Bell} flush>
        <div className="px-5"><Rows>
          {triggers.map((t) => (
            <Row key={t.key} title={t.title} desc={t.desc}>
              <Toggle checked={n.triggers[t.key]} onChange={(v) => set("notifications", { ...n, triggers: { ...n.triggers, [t.key]: v } })} />
            </Row>
          ))}
        </Rows></div>
        <SaveBar onSave={() => save("notifications")} saving={saving} dirtyKey="notifications" />
      </Panel>

      <Panel title="Channels" icon={Webhook} flush>
        <div className="px-5"><Rows>
          <Row title="In-app" desc="Show alerts in the console.">
            <Toggle checked={n.inApp} onChange={(v) => set("notifications", { ...n, inApp: v })} />
          </Row>
          <Row title="Email" desc="Send notification emails to this address.">
            <div className="flex items-center gap-2">
              {n.emailEnabled && <input value={n.emailAddress} onChange={(e) => set("notifications", { ...n, emailAddress: e.target.value })} placeholder="ops@bolt.eu" className={cn(inputBase, "w-52")} />}
              <Toggle checked={n.emailEnabled} onChange={(v) => set("notifications", { ...n, emailEnabled: v })} />
            </div>
          </Row>
          <Row title="Outbound webhook" desc="POST events to a downstream system.">
            <div className="flex items-center gap-2">
              {n.outboundWebhookEnabled && <input value={n.outboundWebhookUrl} onChange={(e) => set("notifications", { ...n, outboundWebhookUrl: e.target.value })} placeholder="https://…" className={cn(inputBase, "w-52")} />}
              <Toggle checked={n.outboundWebhookEnabled} onChange={(v) => set("notifications", { ...n, outboundWebhookEnabled: v })} />
            </div>
          </Row>
        </Rows></div>
        <SaveBar onSave={() => save("notifications")} saving={saving} dirtyKey="notifications" />
      </Panel>
    </>
  );
}

// ── Audit & Security ─────────────────────────────────────────────────────────────
function SecurityTab({ draft, set, save, saving }: { draft: Settings; set: <K extends keyof Settings>(s: K, v: Settings[K]) => void; save: (s: keyof Settings) => void; saving: string | null }) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; brokenAt?: number; entries: number } | null>(null);

  async function verify() {
    setVerifying(true);
    try {
      const res = await fetch("/api/settings/audit-verify", { method: "POST" });
      const j = await res.json();
      if (j.ok) setResult(j.data); else toast.error(j.error);
    } finally { setVerifying(false); }
  }
  return (
    <>
      <Panel title="Audit integrity" icon={ShieldCheck}>
        <p className="meta leading-relaxed">Every action is appended to a hash-chained, tamper-evident audit log. Recompute the chain to verify it hasn&rsquo;t been altered.</p>
        <div className="mt-3 flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={verify} disabled={verifying}>{verifying ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Verify chain</Button>
          {result && (
            result.ok ? (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-success"><CheckCircle2 className="size-4" /> Intact · {result.entries} entries verified</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-danger"><AlertTriangle className="size-4" /> Broken at entry #{result.brokenAt}</span>
            )
          )}
          <Link href="/audit" className="meta inline-flex items-center gap-1 hover:text-ink">Open audit log <ArrowUpRight className="size-3" /></Link>
        </div>
      </Panel>

      <Panel title="Session" icon={Lock} flush>
        <div className="px-5"><Rows>
          <Row title="Session timeout" desc="Sign reviewers out after this period of inactivity.">
            <Num value={draft.security.sessionTimeoutHours} onChange={(v) => set("security", { ...draft.security, sessionTimeoutHours: v })} suffix="hours" />
          </Row>
        </Rows></div>
        <SaveBar onSave={() => save("security")} saving={saving} dirtyKey="security" />
      </Panel>

      <Panel title="Danger zone" icon={ShieldAlert} className="border-danger/30">
        <p className="meta leading-relaxed">Destructive operations (re-seeding demo data, purging runs) are performed via the guarded admin endpoint and CLI — intentionally not exposed here.</p>
      </Panel>
    </>
  );
}
