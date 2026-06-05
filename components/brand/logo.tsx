import { cn } from "@/lib/utils";

/*
 * Original mark — an approximation of Bolt's brand language for an internal demo.
 * This is NOT Bolt's proprietary logo. Do not distribute or present as Bolt-affiliated.
 * If ever made public, swap for a neutral mark (see README IP guardrail).
 */

type LogoSize = "sm" | "md" | "lg";
type LogoMode = "lockup" | "mark" | "stacked";

const PX: Record<LogoSize, number> = { sm: 20, md: 24, lg: 32 };
const TEXT: Record<LogoSize, string> = { sm: "text-sm", md: "text-base", lg: "text-lg" };

export function BoltMark({ size = 24, className, fill = "var(--color-brand-500)" }: { size?: number; className?: string; fill?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Angular lightning bolt: sharp diagonal zigzag. */}
      <path d="M14.5 2 L4 13.6 h6.2 l-1 8.4 L20 10.2 h-6.2 z" fill={fill} />
    </svg>
  );
}

export function Logo({
  size = "md",
  mode = "lockup",
  onDark = false,
  className,
}: {
  size?: LogoSize;
  mode?: LogoMode;
  onDark?: boolean;
  className?: string;
}) {
  const wordmark = (
    <span
      className={cn(
        "font-semibold tracking-tight leading-none",
        TEXT[size],
        onDark ? "text-white" : "text-ink",
      )}
    >
      Bolt Sentinel
    </span>
  );

  if (mode === "mark") {
    return <BoltMark size={PX[size]} className={className} />;
  }

  if (mode === "stacked") {
    return (
      <div className={cn("flex flex-col items-center gap-1.5", className)}>
        <BoltMark size={PX[size] + 8} />
        {wordmark}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)} aria-label="Bolt Sentinel">
      <BoltMark size={PX[size]} />
      {wordmark}
    </div>
  );
}
