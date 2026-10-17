import { Link, useRouterState } from "@tanstack/react-router";
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
  const presentation = useRouterState({ select: (state) => state.location.pathname === "/presentation" });
  if (presentation) return <>{children}</>;
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-background">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-x-8 px-5 md:px-8">
          <Link to="/overview" className="flex h-16 shrink-0 items-center gap-2.5">
            <AirlockMark />
            <span className="text-base font-semibold">LogAirlock</span>
          </Link>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground md:order-last">
            <Link to="/presentation" search={{ slide: 1, print: false }} className="text-muted-foreground hover:text-airlock">Deck</Link>
            <span className="hidden lg:inline">Demo Corp</span>
            <span className="rounded-sm border px-2 py-1">Synthetic data</span>
          </div>
          <nav aria-label="Main navigation" className="order-last flex w-full items-stretch justify-between md:order-none md:w-auto md:justify-start md:gap-6">
            {nav.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="flex h-12 items-center border-b-2 border-transparent px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:h-16"
                activeProps={{ className: "!text-airlock !border-airlock" }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 px-5 py-8 md:px-8 md:py-10">{children}</main>

      <footer className="border-t px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Triage alerts. Never take orders from logs.</span>
          <span className="hidden sm:inline">Airlock containment boundary · v0.4</span>
        </div>
      </footer>
    </div>
  );
}
