import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

function AirlockMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-airlock" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3" y="3" width="18" height="18" />
      <path d="M12 3v18" />
      <path d="M9 12h-2M17 12h-2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const nav = [
  { to: "/overview", label: "Overview" },
  { to: "/", label: "Alerts" },
  { to: "/lab", label: "Lab" },
  { to: "/benchmark", label: "Benchmark" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top rail — one continuous instrument strip */}
      <header className="sticky top-0 z-20 border-b bg-background">
        <div className="flex h-12 items-stretch">
          <Link to="/overview" className="flex items-center gap-2.5 border-r px-4">
            <AirlockMark />
            <span className="font-mono text-sm font-semibold tracking-[0.18em]">LOGAIRLOCK</span>
          </Link>
          <nav className="flex items-stretch overflow-x-auto">
            {nav.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="flex items-center border-r px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "!text-airlock bg-secondary shadow-[inset_0_-2px_0_0_var(--airlock)]" }}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto hidden items-center gap-3 border-l px-4 sm:flex">
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-sealed animate-lamp" />
              Demo Corp / SOC-IN-01
            </span>
            <span className="tone-warning border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]">
              Synthetic data
            </span>
          </div>
        </div>
      </header>

      <main className="bg-hairline-grid flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>

      <footer className="border-t px-4 py-3 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>Triage alerts. Never take orders from logs.</span>
          <span className="sm:hidden tone-warning border px-1.5 py-0.5">Synthetic data</span>
          <span className="hidden sm:inline">Airlock containment boundary · v0.4</span>
        </div>
      </footer>
    </div>
  );
}
