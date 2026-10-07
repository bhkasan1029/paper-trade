"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const ranges = ["1D", "1W", "1M", "YTD", "ALL"] as const;

export function TimeRangeSwitcher() {
  const [active, setActive] = useState<(typeof ranges)[number]>("1M");
  return (
    <div className="inline-flex self-start md:self-auto items-center rounded-md border border-white/[0.06] bg-card/60 p-0.5 text-xs">
      {ranges.map((r) => (
        <button
          key={r}
          onClick={() => setActive(r)}
          className={cn(
            "px-2.5 py-1.5 md:py-1 rounded transition-colors",
            active === r
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r}
        </button>
      ))}
    </div>
  );
}
