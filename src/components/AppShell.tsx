import { Link } from "@tanstack/react-router";
import { Activity, FlaskConical, ListChecks, PanelsTopLeft } from "lucide-react";
import type { ReactNode } from "react";

function AirlockMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-airlock" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3" y="3" width="18" height="18" />
      <path d="M12 3v18" />
      <path d="M9 12h-2M17 12h-2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const nav = [
  { to: "/overview", label: "Overview", icon: PanelsTopLeft },
  { to: "/", label: "Alerts", icon: ListChecks },
  { to: "/lab", label: "Airlock Lab", icon: FlaskConical },
  { to: "/benchmark", label: "Benchmark", icon: Activity },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <AirlockMark />
          <span className="text-sm font-semibold tracking-tight">LogAirlock</span>
        </div>
        <nav className="flex flex-col py-2">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-2.5 border-l-2 border-transparent px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              activeProps={{ className: "!border-airlock bg-sidebar-accent !text-foreground" }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t p-4 font-mono text-[10px] leading-relaxed text-muted-foreground">
          Triage alerts.
          <br />
          Never take orders from logs.
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex min-h-14 flex-wrap items-center justify-between gap-2 border-b bg-background px-4 py-2 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex items-center gap-2 md:hidden">
              <AirlockMark />
            </div>
            <nav className="flex flex-wrap gap-x-3 gap-y-2 md:hidden">
              {nav.map(({ to, label }) => (
                <Link key={to} to={to} activeOptions={{ exact: to === "/" }} className="text-xs text-muted-foreground" activeProps={{ className: "!text-airlock" }}>
                  {label}
                </Link>
              ))}
            </nav>
            <span className="hidden text-sm font-medium md:inline">Demo Corp</span>
            <span className="hidden font-mono text-xs text-muted-foreground md:inline">/ SOC-IN-01</span>
          </div>
          <span className="tone-warning rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider">
            Synthetic demo data
          </span>
        </header>
        <main className="bg-hairline-grid flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
