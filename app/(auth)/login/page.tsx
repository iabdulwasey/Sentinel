"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("reviewer@bolt.eu");
  const [password, setPassword] = useState("sentinel");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    const json = await res.json();
    setLoading(false);
    if (!json.ok) {
      toast.error(json.error ?? "Login failed");
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-subtle p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" mode="stacked" />
        </div>
        <div className="rounded-lg border border-border bg-card p-6 shadow-3">
          <h1 className="text-lg font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-xs text-ink-muted">Regulatory Operations Platform</p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <div className="mt-4 rounded-md bg-surface-sunken px-3 py-2 text-2xs text-ink-muted">
            Demo accounts: <span className="font-medium text-ink">reviewer@bolt.eu</span> or <span className="font-medium text-ink">admin@bolt.eu</span> · password <span className="font-medium text-ink">sentinel</span>
          </div>
        </div>
        <p className="mt-4 text-center text-2xs text-ink-muted">Synthetic demonstration. Not affiliated with Bolt.</p>
      </div>
    </div>
  );
}
