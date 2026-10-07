import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  badge?: React.ReactNode;
  sub?: React.ReactNode;
  footer?: React.ReactNode;
  accent?: "primary" | "warning" | "negative" | "none";
  className?: string;
}

export function MetricCard({
  label,
  value,
  badge,
  sub,
  footer,
  accent = "none",
  className,
}: MetricCardProps) {
  const dot = {
    primary: "bg-primary shadow-[0_0_6px_var(--primary)]",
    warning: "bg-warning shadow-[0_0_6px_var(--warning)]",
    negative: "bg-negative shadow-[0_0_6px_var(--negative)]",
    none: "bg-muted-foreground/40",
  }[accent];

  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.06] bg-card p-4 md:p-6 flex flex-col gap-3 md:gap-4 min-h-[160px] md:min-h-[220px]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
          <span className="label-caps truncate">{label}</span>
        </div>
        {badge}
      </div>

      <div className="num text-[20px] md:text-[26px] font-semibold tracking-tight leading-none mt-1 break-all">
        {value}
      </div>

      {sub && <div className="text-[12px] md:text-[13px] text-muted-foreground num">{sub}</div>}

      {footer && <div className="mt-auto pt-3 border-t border-white/[0.04]">{footer}</div>}
    </div>
  );
}

export function MicroBadge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "primary" | "warning" | "negative";
}) {
  const styles = {
    muted: "bg-white/5 text-muted-foreground border-white/5",
    primary: "bg-primary/10 text-primary border-primary/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    negative: "bg-negative/10 text-negative border-negative/20",
  }[tone];
  return (
    <span
      className={cn(
        "px-1.5 py-0.5 text-[11px] font-medium tracking-wider rounded border",
        styles,
      )}
    >
      {children}
    </span>
  );
}
