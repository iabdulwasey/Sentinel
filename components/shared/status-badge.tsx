import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  FileCheck2,
  type LucideIcon,
} from "lucide-react";

type Tone = "success" | "warning" | "danger" | "neutral" | "brand";

const TONE: Record<Tone, string> = {
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  danger: "bg-danger-muted text-danger",
  neutral: "bg-surface-sunken text-ink-muted",
  brand: "bg-brand-50 text-brand-700",
};

interface Meta {
  tone: Tone;
  label: string;
  Icon: LucideIcon;
  spin?: boolean;
}

const MAP: Record<string, Meta> = {
  // ARR / onboarding
  RECEIVED: { tone: "neutral", label: "Received", Icon: Clock },
  QUEUED: { tone: "neutral", label: "Queued", Icon: Clock },
  PROCESSING: { tone: "brand", label: "Processing", Icon: Loader2, spin: true },
  RUNNING: { tone: "brand", label: "Running", Icon: Loader2, spin: true },
  PENDING_REVIEW: { tone: "warning", label: "Pending review", Icon: Clock },
  AWAITING_REVIEW: { tone: "warning", label: "Awaiting review", Icon: AlertTriangle },
  NEEDS_CLARIFICATION: { tone: "warning", label: "Needs clarification", Icon: AlertTriangle },
  APPROVED: { tone: "success", label: "Approved", Icon: CheckCircle2 },
  CONDITIONS_APPLIED: { tone: "warning", label: "Conditions applied", Icon: ShieldAlert },
  REJECTED: { tone: "danger", label: "Rejected", Icon: XCircle },
  DONE: { tone: "success", label: "Done", Icon: CheckCircle2 },
  COMPLETED: { tone: "success", label: "Completed", Icon: CheckCircle2 },
  FAILED: { tone: "danger", label: "Failed", Icon: XCircle },
  // monitoring
  COMPLIANT: { tone: "success", label: "Compliant", Icon: ShieldCheck },
  EXPIRING_SOON: { tone: "warning", label: "Expiring soon", Icon: Clock },
  DRIFT_DETECTED: { tone: "warning", label: "Drift detected", Icon: ShieldAlert },
  REMEDIATED: { tone: "success", label: "Remediated", Icon: CheckCircle2 },
  SUSPENDED_RECOMMENDED: { tone: "danger", label: "Suspend recommended", Icon: ShieldAlert },
  // documents
  UPLOADED: { tone: "neutral", label: "Uploaded", Icon: Clock },
  EXTRACTING: { tone: "brand", label: "Extracting", Icon: Loader2, spin: true },
  EXTRACTED: { tone: "neutral", label: "Extracted", Icon: FileCheck2 },
  VALIDATED: { tone: "success", label: "Validated", Icon: CheckCircle2 },
  FLAGGED: { tone: "warning", label: "Flagged", Icon: AlertTriangle },
  // validation outcomes
  PASS: { tone: "success", label: "Pass", Icon: CheckCircle2 },
  WARN: { tone: "warning", label: "Warn", Icon: AlertTriangle },
  FAIL: { tone: "danger", label: "Fail", Icon: XCircle },
  MATCH: { tone: "success", label: "Match", Icon: CheckCircle2 },
  MISMATCH: { tone: "danger", label: "Mismatch", Icon: XCircle },
  INDETERMINATE: { tone: "neutral", label: "Indeterminate", Icon: AlertTriangle },
  // risk bands
  LOW: { tone: "success", label: "Low risk", Icon: ShieldCheck },
  MEDIUM: { tone: "warning", label: "Medium risk", Icon: ShieldAlert },
  HIGH: { tone: "danger", label: "High risk", Icon: ShieldAlert },
};

export function StatusBadge({ status, label, size = "sm", className }: { status: string; label?: string; size?: "sm" | "md"; className?: string }) {
  const meta = MAP[status] ?? { tone: "neutral" as Tone, label: label ?? status, Icon: Clock };
  const Icon = meta.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-2xs" : "px-2.5 py-1 text-xs",
        TONE[meta.tone],
        className,
      )}
    >
      <Icon className={cn(size === "sm" ? "size-3" : "size-3.5", meta.spin && "animate-spin")} strokeWidth={2} />
      {label ?? meta.label}
    </span>
  );
}
