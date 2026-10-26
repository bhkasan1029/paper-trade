import { MicroBadge } from "./metric-card";

export function StatusBanner() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-card/60 px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row md:items-center gap-3">
      <div className="flex items-start md:items-center gap-2 md:gap-3 min-w-0">
        <MicroBadge tone="muted">● ENGINE ONLINE</MicroBadge>
        <span className="text-[13px] md:text-[14px] min-w-0">
          <span className="font-medium">Phase 1 Foundation Active:</span>{" "}
          <span className="text-muted-foreground">
            Schema wired, navigation live, market data connects in Phase 2.
          </span>
        </span>
      </div>
      <div className="md:ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] md:text-[12px] text-muted-foreground">
        <span>
          <span className="label-caps mr-1">Mode</span>
          <span className="text-foreground">Zero-Risk Sandbox</span>
        </span>
        <span className="hidden md:inline h-3 w-px bg-white/10" />
        <span>
          <span className="label-caps mr-1">DB</span>
          <span className="text-foreground">Postgres · Local</span>
        </span>
      </div>
    </div>
  );
}
