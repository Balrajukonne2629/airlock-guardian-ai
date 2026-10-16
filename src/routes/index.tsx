import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { listAlerts } from "@/lib/alerts.functions";
import { StatusBadge, severityTone } from "@/components/StatusBadge";

const alertsQuery = queryOptions({ queryKey: ["alerts"], queryFn: () => listAlerts() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Alert Queue — LogAirlock" },
      { name: "description", content: "SOC alert queue with Airlock prompt-injection scanning on every untrusted log field." },
      { property: "og:title", content: "Alert Queue — LogAirlock" },
      { property: "og:description", content: "Triage alerts. Never take orders from logs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(alertsQuery),
  component: AlertsPage,
});

function AirlockIcon({ status, poisoned }: { status: string; poisoned: boolean }) {
  if (status === "quarantined")
    return <span className="flex items-center gap-1.5 text-hostile"><ShieldAlert className="h-4 w-4" /><span className="font-mono text-[10px] uppercase">Quarantined</span></span>;
  if (status === "clean")
    return <span className="flex items-center gap-1.5 text-sealed"><ShieldCheck className="h-4 w-4" /><span className="font-mono text-[10px] uppercase">Clean</span></span>;
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground" title={poisoned ? "Contains untrusted fields — run triage to scan" : undefined}>
      <ShieldQuestion className="h-4 w-4" />
      <span className="font-mono text-[10px] uppercase">Unscanned</span>
    </span>
  );
}

function AlertsPage() {
  const { data } = useSuspenseQuery(alertsQuery);
  const navigate = useNavigate();
  const counts = data.reduce<Record<string, number>>((a, r) => ((a[r.severity] = (a[r.severity] ?? 0) + 1), a), {});

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-airlock">Queue / Live</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Alert Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every untrusted field passes the Airlock before the triage agent reads it.</p>
        </div>
        <div className="grid grid-cols-4 border bg-card">
          {(["Critical", "High", "Medium", "Low"] as const).map((s) => (
            <div key={s} className="border-r px-4 py-2 last:border-r-0">
              <div className="font-mono text-lg font-semibold">{counts[s] ?? 0}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              {["ID", "Timestamp (UTC)", "Source IP", "Asset", "Alert type", "Severity", "Status", "Airlock"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr
                key={a.id}
                onClick={() => navigate({ to: "/incident/$id", params: { id: a.id } })}
                className="cursor-pointer border-b border-l-2 border-l-transparent transition-colors last:border-b-0 hover:border-l-airlock hover:bg-secondary"
              >
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-airlock">{a.id}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-muted-foreground">
                  {new Date(a.occurred_at).toISOString().replace("T", " ").slice(0, 19)}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">{a.source_ip}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">{a.asset?.name}</td>
                <td className="px-3 py-2.5">{a.alert_type}</td>
                <td className="px-3 py-2.5"><StatusBadge tone={severityTone(a.severity)}>{a.severity}</StatusBadge></td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.status}</td>
                <td className="px-3 py-2.5"><AirlockIcon status={a.airlock_status} poisoned={a.poisoned} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-[10px] text-muted-foreground">
        {data.length} alerts · synthetic data · Airlock status updates after triage runs on an incident
      </p>
    </div>
  );
}
