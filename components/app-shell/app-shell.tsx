"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { NAV_ITEMS, NAV_GROUPS } from "./nav";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, Sparkles, Globe, ChevronDown } from "lucide-react";
import { CommandPalette } from "@/components/assistant/command-palette";

export interface ShellUser {
  name: string;
  email: string;
  role: string;
}
export interface ShellMarket {
  code: string;
  country: string;
  cities: string[];
}

export function AppShell({ user, markets, children }: { user: ShellUser; markets: ShellMarket[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const market = params.get("market") ?? "ALL";

  const active = NAV_ITEMS.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));

  const setMarket = (val: string) => {
    const sp = new URLSearchParams(Array.from(params.entries()));
    if (val === "ALL") sp.delete("market");
    else sp.set("market", val);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen bg-surface-subtle">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex h-14 items-center border-b border-border px-4">
          <Link href="/home" className="transition-opacity hover:opacity-80">
            <Logo size="md" />
          </Link>
        </div>
        <nav className="scroll-slim flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group} className="space-y-0.5">
              <div className="eyebrow px-3 pb-1.5">{group}</div>
              {NAV_ITEMS.filter((n) => n.group === group).map((item) => {
                const Icon = item.icon;
                const isActive = active?.href === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
                      isActive ? "bg-brand-50 font-medium text-brand-800" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                    )}
                  >
                    {isActive && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500" />}
                    <Icon className={cn("size-[18px] shrink-0", isActive ? "text-brand-700" : "text-ink-muted group-hover:text-ink")} strokeWidth={2} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span className="size-1.5 rounded-full bg-brand-500" />
            Synthetic demo · private use
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-border bg-surface/85 px-6 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            {active && <active.icon className="size-4 text-ink-muted" strokeWidth={2} />}
            <span className="truncate font-medium text-ink">{active?.label ?? "Home"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={market} onValueChange={setMarket}>
              <SelectTrigger className="h-8 gap-1.5 rounded-md border-border pl-2.5 text-[13px] text-ink shadow-none data-[placeholder]:text-ink-muted">
                <Globe className="size-3.5 text-ink-muted" />
                <SelectValue placeholder="All markets" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="ALL">All markets</SelectItem>
                {markets.map((m) => (
                  <SelectItem key={m.code} value={m.code}>
                    {m.country} · {m.cities.join("/")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => window.dispatchEvent(new Event("sentinel-cmdk"))}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-[13px] text-ink-muted transition-colors hover:border-border-strong hover:text-ink"
            >
              <Sparkles className="size-3.5 text-brand-600" /> Ask
              <kbd className="ml-0.5 hidden rounded bg-surface-sunken px-1 text-[10px] text-ink-muted sm:inline">⌘K</kbd>
            </button>
            <div className="mx-1 h-5 w-px bg-border" />
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-md py-1 pl-1 pr-1.5 text-[13px] outline-none transition-colors hover:bg-surface-sunken">
                <span className="flex size-7 items-center justify-center rounded-full bg-brand-500 text-[11px] font-semibold text-[#06281A]">
                  {user.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                </span>
                <span className="hidden text-ink lg:inline">{user.name}</span>
                <ChevronDown className="hidden size-3.5 text-ink-muted lg:inline" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium text-ink">{user.name}</div>
                  <div className="meta font-normal">{user.email}</div>
                  <div className="mt-1.5 inline-block rounded-sm bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-muted">{user.role}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-danger focus:text-danger">
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-6 py-7 lg:px-8">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
