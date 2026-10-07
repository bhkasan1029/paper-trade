"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Search,
  History,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, badge: null as string | null },
  { href: "/portfolios", label: "Portfolios", icon: Briefcase, badge: null as string | null },
  { href: "/watchlist", label: "Watchlist", icon: Star, badge: null as string | null },
  { href: "/search", label: "Search", icon: Search, badge: null as string | null },
  { href: "/history", label: "Order History", icon: History, badge: null as string | null },
];

export function SidebarNav({
  portfolioCount,
  watchlistCount,
}: {
  portfolioCount: number;
  watchlistCount: number;
}) {
  const pathname = usePathname();

  return (
    <nav className="px-3 space-y-1">
      {nav.map(({ href, label, icon: Icon, badge }) => {
        const active =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        const count =
          href === "/portfolios" && portfolioCount > 0
            ? String(portfolioCount)
            : href === "/watchlist" && watchlistCount > 0
              ? String(watchlistCount)
              : null;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-[14px] transition-colors relative",
              active
                ? "bg-sidebar-accent text-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
            <span className="flex-1">{label}</span>
            {count && (
              <span className="px-1.5 py-0.5 text-[11px] font-semibold tracking-wider rounded bg-primary/10 text-primary border border-primary/20">
                {count}
              </span>
            )}
            {!count && badge && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium tracking-wider rounded bg-white/5 text-muted-foreground border border-white/5">
                {badge}
              </span>
            )}
            {active && (
              <div className="absolute right-2 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_var(--primary)]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
