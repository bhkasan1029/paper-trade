"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export function LayoutShell({
  sidebar,
  topSearch,
  children,
}: {
  sidebar: React.ReactNode;
  topSearch: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div className="hidden lg:flex shrink-0 sticky top-0 h-screen self-start">
        {sidebar}
      </div>

      <div
        className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        <div
          className="absolute inset-0 bg-black/60 supports-backdrop-filter:backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
        <div
          className={`absolute inset-y-0 left-0 max-w-[85%] flex shadow-2xl transition-transform duration-200 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebar}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-3 -right-11 h-9 w-9 flex items-center justify-center rounded-md bg-background/80 border border-white/10 text-foreground"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 md:h-16 shrink-0 border-b border-sidebar-border flex items-center gap-2 md:gap-4 px-3 md:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="lg:hidden h-9 w-9 shrink-0 flex items-center justify-center rounded-md border border-black/10 bg-black/5 text-[#666666] hover:text-black"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          {topSearch}
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </>
  );
}
