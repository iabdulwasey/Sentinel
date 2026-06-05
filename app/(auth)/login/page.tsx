"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck, FileText, Activity, Sparkles, Mail, Lock, CheckCircle2, UserCog } from "lucide-react";
import { BoltMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const DEMO = [
  { email: "admin@bolt.eu", role: "Administrator", initials: "DA", icon: UserCog, recommended: true },
  { email: "reviewer@bolt.eu", role: "Compliance Reviewer", initials: "RR", icon: ShieldCheck, recommended: false },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@bolt.eu");
  const [password, setPassword] = useState("sentinel");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Sign in failed");
        setLoading(false);
        return;
      }
      router.push("/home");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setLoading(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded-lg border border-border bg-surface-sunken pl-10 text-[0.9rem] text-ink outline-none transition-all placeholder:text-ink-muted hover:border-border-strong focus:border-brand-400 focus:ring-3 focus:ring-brand-500/15";

  return (
    <div className="relative flex min-h-screen flex-col bg-surface-subtle lg:flex-row">
      {/* theme switcher — top-right, above both rails */}
      <div className="absolute right-4 top-4 z-30">
        <ThemeToggle />
      </div>

      {/* ── Brand rail (theme-aware: dark green canvas / light mint canvas) ── */}
      <div className="relative hidden flex-col justify-between overflow-hidden px-12 py-10 lg:flex lg:w-[55%]" style={{ background: "var(--rail-bg)" }}>
        <span aria-hidden className="pointer-events-none absolute -left-[12%] -top-[12%] h-[460px] w-[460px] rounded-full" style={{ background: "var(--rail-orb-1)", filter: "blur(150px)" }} />
        <span aria-hidden className="pointer-events-none absolute -bottom-[14%] right-[2%] h-[420px] w-[420px] rounded-full" style={{ background: "var(--rail-orb-2)", filter: "blur(150px)" }} />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(to right, var(--rail-grid) 1px, transparent 1px), linear-gradient(to bottom, var(--rail-grid) 1px, transparent 1px)",
            backgroundSize: "3rem 3rem",
            maskImage: "radial-gradient(ellipse at 35% 40%, black 45%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse at 35% 40%, black 45%, transparent 100%)",
          }}
        />

        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <BoltMark size={30} />
            <span className="text-[1.55rem] font-semibold leading-none tracking-[-0.02em]" style={{ backgroundImage: "var(--rail-wordmark)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
              Bolt Sentinel
            </span>
          </div>
          <div className="mt-2.5 text-[0.68rem] font-medium uppercase tracking-[0.24em]" style={{ color: "var(--rail-eyebrow)" }}>Regulatory Operations Platform</div>
        </div>

        <div className="relative z-10 max-w-[540px]">
          <h1 className="text-[2.7rem] font-semibold leading-[1.08] tracking-[-0.02em] lg:text-[3.1rem]" style={{ backgroundImage: "var(--rail-hero)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            Regulatory compliance,
            <br />
            <span style={{ color: "var(--rail-accent)", WebkitTextFillColor: "var(--rail-accent)" }}>on autopilot.</span>
          </h1>
          <p className="mt-5 max-w-[460px] text-[1.02rem] font-light leading-relaxed" style={{ color: "var(--rail-text-muted)" }}>
            Answer authority requests, onboard fleet partners, and monitor a live portfolio across markets — with provenance, confidence, and a human in the loop on every decision.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5 text-[0.78rem]">
            {["GDPR", "NDPA", "POPIA"].map((r) => (
              <span key={r} className="rounded-full border px-3 py-1 font-medium" style={{ borderColor: "var(--rail-pill-border)", background: "var(--rail-pill-bg)", color: "var(--rail-text)" }}>{r}</span>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute right-12 top-[24%] z-0 hidden xl:block">
          <GlassCard icon={<FileText className="size-3.5" />} title="authority.requests" metric="4h" unit="→ seconds" delay="0s">
            <Bars />
          </GlassCard>
        </div>
        <div className="pointer-events-none absolute right-[20%] bottom-[20%] z-0 hidden xl:block">
          <GlassCard icon={<Activity className="size-3.5" />} title="portfolio.health" metric="98.2" unit="% compliant" delay="1.6s">
            <Sparkline />
          </GlassCard>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-[0.7rem]" style={{ color: "var(--rail-footer)" }}>
          <ShieldCheck className="size-3.5" />© {new Date().getFullYear()} · Bolt Sentinel · Synthetic demonstration
        </div>
      </div>

      {/* ── Form rail (theme-aware) ─────────────────────────────────────── */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-12 sm:px-10 lg:w-[45%]">
        <div className="relative w-full max-w-[400px]">
          {/* soft brand glow behind the card for depth */}
          <div aria-hidden className="pointer-events-none absolute -top-10 left-1/2 h-44 w-4/5 -translate-x-1/2 rounded-full bg-brand-500/15 blur-3xl" />

          {/* mobile brand */}
          <div className="relative mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <BoltMark size={26} />
            <span className="text-xl font-semibold tracking-tight text-ink">Bolt Sentinel</span>
          </div>

          {/* card */}
          <div className="panel relative overflow-hidden rounded-2xl p-8" style={{ boxShadow: "var(--shadow-4)" }}>
            {/* top brand accent hairline */}
            <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(to right, transparent, rgba(52,209,134,0.6), transparent)" }} />

            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-500/12 text-brand-600 ring-1 ring-brand-500/20">
              <Lock className="size-[18px]" strokeWidth={2} />
            </span>
            <h2 className="mt-4 text-[1.45rem] font-semibold leading-tight tracking-[-0.01em] text-ink">Welcome back</h2>
            <p className="mt-1 text-[0.85rem] text-ink-muted">Sign in to your Bolt Sentinel workspace</p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-[0.8rem] font-medium text-ink">Email address</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    placeholder="you@bolt.eu"
                    autoComplete="username"
                    required
                    className={cn(inputClass, "pr-3.5")}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5">
                  <label htmlFor="password" className="block text-[0.8rem] font-medium text-ink">Password</label>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className={cn(inputClass, "pr-11")}
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} tabIndex={-1} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface hover:text-ink">
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-muted px-3 py-2.5">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-danger" />
                  <span className="text-[0.82rem] font-medium text-danger">{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group relative inline-flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-lg text-[0.92rem] font-semibold text-[#04130c] transition-all disabled:opacity-60"
                style={{ background: "linear-gradient(to right, #34d186, #22a766)", boxShadow: "0 8px 22px rgba(52,209,134,0.32)" }}
              >
                <span aria-hidden className="absolute inset-0 translate-y-full bg-white/20 transition-transform duration-300 group-hover:translate-y-0" />
                <span className="relative inline-flex items-center gap-2">
                  {loading ? <><Loader2 className="size-4 animate-spin" /> Signing in…</> : <>Sign in <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></>}
                </span>
              </button>
            </form>
          </div>

          {/* demo accounts */}
          <div className="relative mt-6">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="inline-flex items-center gap-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                <Sparkles className="size-3 text-brand-600" /> Demo accounts
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-2">
              {DEMO.map((u) => {
                const Icon = u.icon;
                const selected = email === u.email;
                return (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => { setEmail(u.email); setPassword("sentinel"); setError(null); }}
                    aria-pressed={selected}
                    className={cn(
                      "group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
                      selected ? "border-brand-400 bg-brand-50" : "border-border bg-surface hover:border-border-strong hover:bg-surface-sunken",
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-[0.72rem] font-semibold tracking-wide text-brand-700">{u.initials}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[0.82rem] font-medium text-ink">
                        <Icon className="size-3.5 shrink-0 text-brand-600" /> {u.role}
                        {u.recommended && <span className="rounded-full bg-brand-500/15 px-1.5 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wide text-brand-700">Default</span>}
                      </span>
                      <span className="block truncate font-mono text-[0.68rem] text-ink-muted">{u.email}</span>
                    </span>
                    {selected ? (
                      <CheckCircle2 className="size-4 shrink-0 text-brand-600" />
                    ) : (
                      <ArrowRight className="size-3.5 shrink-0 -translate-x-1 text-ink-muted opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-center text-[0.68rem] text-ink-muted">Password <span className="font-medium text-ink">sentinel</span> · Synthetic demo · not affiliated with Bolt.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Brand-rail glass metric cards ──────────────────────────────────────────
function GlassCard({ icon, title, metric, unit, delay, children }: { icon: React.ReactNode; title: string; metric: string; unit: string; delay: string; children: React.ReactNode }) {
  return (
    <div className="w-56 rounded-xl border px-4 py-3" style={{ background: "var(--rail-card-bg)", borderColor: "var(--rail-card-border)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", animation: `floaty 8s ease-in-out infinite ${delay}`, opacity: 0.95 }}>
      <div className="flex items-center gap-2 text-[0.66rem] uppercase tracking-wider" style={{ color: "var(--rail-card-title)" }}>
        <span className="text-brand-500">{icon}</span>
        <span className="font-mono">{title}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="font-mono text-[1.55rem] font-semibold" style={{ color: "var(--rail-card-metric)" }}>{metric}</span>
        <span className="text-[0.7rem]" style={{ color: "var(--rail-card-unit)" }}>{unit}</span>
      </div>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}
function Bars() {
  const h = [42, 66, 32, 80, 52, 90, 60];
  return (
    <div className="flex h-8 items-end gap-1">
      {h.map((v, i) => (
        <div key={i} className="flex-1 rounded-sm" style={{ height: `${v}%`, background: "linear-gradient(to top, rgba(52,209,134,0.2), rgba(52,209,134,0.7))" }} />
      ))}
    </div>
  );
}
function Sparkline() {
  return (
    <svg viewBox="0 0 200 32" className="h-8 w-full">
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(52,209,134,0.5)" />
          <stop offset="100%" stopColor="rgba(52,209,134,0)" />
        </linearGradient>
      </defs>
      <path d="M0 24 L24 20 L48 26 L72 14 L96 18 L120 9 L144 13 L168 6 L192 10 L200 8 L200 32 L0 32 Z" fill="url(#spark)" />
      <path d="M0 24 L24 20 L48 26 L72 14 L96 18 L120 9 L144 13 L168 6 L192 10" stroke="#34d186" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
