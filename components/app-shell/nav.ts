import { LayoutDashboard, Inbox, Truck, ShieldCheck, Scale, FileUp, Target, ScrollText, Sparkles, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/home", label: "Home", icon: LayoutDashboard, group: "Operations" },
  { href: "/authority-requests", label: "Authority Requests", icon: Inbox, group: "Operations" },
  { href: "/fleet-onboarding", label: "Fleet Onboarding", icon: Truck, group: "Operations" },
  { href: "/compliance-monitoring", label: "Compliance Monitoring", icon: ShieldCheck, group: "Operations" },
  { href: "/rules", label: "Markets & Rules", icon: Scale, group: "Governance" },
  { href: "/regulation-intake", label: "Regulation Intake", icon: FileUp, group: "Governance" },
  { href: "/accuracy", label: "Accuracy", icon: Target, group: "Governance" },
  { href: "/audit", label: "Audit & Cost", icon: ScrollText, group: "Governance" },
  { href: "/assistant", label: "Assistant", icon: Sparkles, group: "Governance" },
];

export const NAV_GROUPS = ["Operations", "Governance"] as const;

export function sectionForPath(pathname: string): string | null {
  const match = NAV_ITEMS.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));
  return match?.label ?? null;
}
