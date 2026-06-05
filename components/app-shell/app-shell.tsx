"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { NAV_ITEMS, NAV_GROUPS, UTILITY_NAV, type NavItem } from "./nav";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LogOut, Sparkles, Globe, ChevronsUpDown, Check, UserCog } from "lucide-react";
import { CommandPalette } from "@/components/assistant/command-palette";
import { AssistantDock } from "@/components/assistant/assistant-dock";
import { ThemeToggle } from "@/components/theme-toggle";
import { NAV_PERMISSION, ROLE_LABELS } from "@/lib/rbac";
import { toast } from "sonner";

export interface ShellUser {
  name: string;
  email: string;
  role: string;
  roles: string[];
  activeRole: string;
  permissions: string[];
}
export interface ShellMarket {
  code: string;
  country: string;
  cities: string[];
}

function initials(name: string) {
  const words = name.replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return words.map((s) => s[0]).slice(0, 2).join("").toUpperCase() || name.slice(0, 2).toUpperCase();
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
        active ? "bg-brand-50 font-medium text-brand-800" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
      )}
    >
      {active && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-500" />}
      <Icon className={cn("size-[18px] shrink-0", active ? "text-brand-700" : "text-ink-muted group-hover:text-ink")} strokeWidth={2} />
      {item.label}
    </Link>
  );
}

export function AppShell({ user, markets, children }: { user: ShellUser; markets: ShellMarket[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const market = params.get("market") ?? "ALL";

  const permOK = (n: NavItem) => {
    const perm = NAV_PERMISSION[n.href];
    return !perm || user.permissions.includes(perm);
  };
  const nav = NAV_ITEMS.filter(permOK);
  const utility = UTILITY_NAV.filter(permOK);
  const active = [...nav, ...utility].find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));

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

  const switchRole = async (role: string) => {
    if (role === user.activeRole) return;
    const res = await fetch("/api/auth/role", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role }) });
    const j = await res.json();
    if (j.ok) {
      toast.success(`Now viewing as ${ROLE_LABELS[role] ?? role}`);
      router.push("/home");
      router.refresh();
    } else toast.error(j.error ?? "Couldn't switch role");
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
          {NAV_GROUPS.map((group) => {
            const items = nav.filter((n) => n.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="space-y-0.5">
                <div className="eyebrow px-3 pb-1.5">{group}</div>
                {items.map((item) => <NavLink key={item.href} item={item} active={active?.href === item.href} />)}
              </div>
            );
          })}
        </nav>

        {/* Settings & User Guide — pinned at the bottom, just above the account menu */}
        {utility.length > 0 && (
          <div className="space-y-0.5 px-3 pb-1 pt-2">
            {utility.map((item) => <NavLink key={item.href} item={item} active={active?.href === item.href} />)}
          </div>
        )}

        {/* user panel — bottom of the sidebar */}
        <div className="border-t border-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left outline-none transition-colors hover:bg-surface-sunken">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-semibold text-[#06281A]">{initials(user.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{user.name}</span>
                <span className="block truncate text-[11px] text-ink-muted">{ROLE_LABELS[user.activeRole] ?? user.email}</span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-ink-muted" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56">
              <DropdownMenuLabel>
                <div className="text-sm font-medium text-ink">{user.name}</div>
                <div className="meta font-normal">{user.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-danger focus:text-danger">
                <LogOut className="size-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
              onClick={() => window.dispatchEvent(new Event("sentinel-assistant"))}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-[13px] text-ink-muted transition-colors hover:border-border-strong hover:text-ink"
            >
              <Sparkles className="size-3.5 text-brand-600" /> Ask
              <kbd className="ml-0.5 hidden rounded bg-surface-sunken px-1 text-[10px] text-ink-muted sm:inline">⌘J</kbd>
            </button>
            <ThemeToggle />
            <div className="mx-1 h-5 w-px bg-border" />
            {/* role switcher */}
            {user.roles.length > 1 ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-[13px] text-ink outline-none transition-colors hover:border-border-strong">
                  <UserCog className="size-3.5 text-brand-600" />
                  <span className="hidden max-w-[140px] truncate sm:inline">{ROLE_LABELS[user.activeRole] ?? user.activeRole}</span>
                  <ChevronsUpDown className="size-3.5 text-ink-muted" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Viewing as · switch role</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user.roles.map((r) => (
                    <DropdownMenuItem key={r} onClick={() => switchRole(r)} className="gap-2">
                      <span className={cn("flex size-4 items-center justify-center", r === user.activeRole ? "text-brand-600" : "text-transparent")}>
                        <Check className="size-3.5" />
                      </span>
                      <span className={cn(r === user.activeRole && "font-medium text-ink")}>{ROLE_LABELS[r] ?? r}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-[13px] text-ink">
                <UserCog className="size-3.5 text-brand-600" /> <span className="hidden sm:inline">{ROLE_LABELS[user.activeRole] ?? user.activeRole}</span>
              </span>
            )}
          </div>
        </header>
        <main className="min-w-0 flex-1 px-6 py-7 lg:px-8">{children}</main>
      </div>
      <CommandPalette />
      <AssistantDock />
    </div>
  );
}
