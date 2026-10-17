import { ChevronRight } from "lucide-react";
import { formatIST } from "@/lib/format";
import { createFileRoute, Link } from "@tanstack/react-router";
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
    return <span className="flex items-center gap-1.5 text-hostile"><ShieldAlert className="h-3.5 w-3.5" /><span className="font-mono text-[10px] uppercase tracking-wider">Quarantined</span></span>;
  if (status === "suspicious")
    return <span className="flex items-center gap-1.5 text-warning"><ShieldQuestion className="h-3.5 w-3.5" /><span className="font-mono text-[10px] uppercase tracking-wider">Suspicious</span></span>;
  if (status === "clean")
    return <span className="flex items-center gap-1.5 text-sealed"><ShieldCheck className="h-3.5 w-3.5" /><span className="font-mono text-[10px] uppercase tracking-wider">Clean</span></span>;
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground" title={poisoned ? "Contains untrusted fields — run triage to scan" : undefined}>
      <ShieldQuestion className="h-3.5 w-3.5" />
      <span className="font-mono text-[10px] uppercase tracking-wider">Unscanned</span>
    </span>
  );
}

const SEV_TONE: Record<string, string> = {
  Critical: "text-hostile",
  High: "text-warning",
  Medium: "text-airlock",
  Low: "text-muted-foreground",
};

function AlertsPage() {
  const { data } = useSuspenseQuery(alertsQuery);
  const counts = data.reduce<Record<string, number>>((a, r) => ((a[r.severity] = (a[r.severity] ?? 0) + 1), a), {});

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-6">
        <div>
          <p className="text-xs text-muted-foreground">Workspace / Alerts</p>
          <h1 className="mt-3 text-3xl font-semibold">Alert Queue</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Demo Corp <span className="mx-2 text-border">/</span> SOC-IN-01
          </p>
        </div>
      </div>
        <div className="grid grid-cols-2 gap-y-5 border-y py-5 sm:grid-cols-4">
          {(["Critical", "High", "Medium", "Low"] as const).map((s) => (
            <div key={s} className="border-l pl-5 first:border-l-0 first:pl-0">
              <div className="mb-2 text-sm text-muted-foreground">{s}</div>
              <div className={`text-2xl font-medium leading-none tabular-nums ${SEV_TONE[s]}`}>
                {counts[s] ?? 0}
              </div>
            </div>
          ))}
        </div>
      <section className="min-w-0">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">All alerts <span className="ml-2 font-normal text-muted-foreground">{data.length}</span></h2>
        <span className="text-xs text-muted-foreground">Latest activity</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              {["ID", "Timestamp", "Source IP", "Asset", "Alert type", "Severity", "Status", "Airlock", ""].map((h) => (
                <th key={h} className="bg-card px-3 py-3 text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr
                key={a.id}
                className="group relative border-b transition-colors last:border-b-0 hover:bg-secondary focus-within:bg-secondary"
              >
                <td className="whitespace-nowrap px-3 py-4 text-xs font-medium">
                  <Link to="/incident/$id" params={{ id: a.id }} className="text-foreground after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-1 focus-visible:after:ring-ring">{a.id}</Link>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-xs tabular-nums text-muted-foreground">
                  {formatIST(a.occurred_at)}
                </td>
                <td className="px-3 py-3 font-mono text-xs tabular-nums">{a.source_ip}</td>
                <td className="whitespace-nowrap px-3 py-4 text-xs">{a.asset?.name}</td>
                <td className="px-3 py-3">{a.alert_type}</td>
                <td className="px-3 py-3"><StatusBadge tone={severityTone(a.severity)}>{a.severity}</StatusBadge></td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{a.status}</td>
                <td className="px-3 py-3"><AirlockIcon status={a.airlock_status} poisoned={a.poisoned} /></td>
                <td className="w-8 px-2 py-3 text-muted-foreground transition-colors group-hover:text-airlock"><ChevronRight className="h-4 w-4" aria-hidden /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{data.length} alerts · Synthetic data</p>
      </section>
    </div>
  );
}
