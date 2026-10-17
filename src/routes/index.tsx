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
  const navigate = useNavigate();
  const counts = data.reduce<Record<string, number>>((a, r) => ((a[r.severity] = (a[r.severity] ?? 0) + 1), a), {});

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Masthead — document header, not a card */}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6 border-b pb-6">
        <div>
          <p className="micro-label text-airlock">Queue · Live feed</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Alert Queue</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Every untrusted field passes the Airlock before the triage agent reads it.
          </p>
        </div>
        {/* Severity counters as oversized instrument numerals */}
        <div className="flex divide-x border-y">
          {(["Critical", "High", "Medium", "Low"] as const).map((s) => (
            <div key={s} className="px-5 py-3 text-center first:pl-0 last:pr-0">
              <div className={`font-mono text-3xl font-semibold leading-none tabular-nums ${SEV_TONE[s]}`}>
                {String(counts[s] ?? 0).padStart(2, "0")}
              </div>
              <div className="micro-label mt-2">{s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Queue table — ledger style, row rules only */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              {["ID", "Timestamp (UTC)", "Source IP", "Asset", "Alert type", "Severity", "Status", "Airlock"].map((h) => (
                <th key={h} className="micro-label px-3 py-2 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((a) => (
              <tr
                key={a.id}
                onClick={() => navigate({ to: "/incident/$id", params: { id: a.id } })}
                className="group cursor-pointer border-b transition-colors last:border-b-0 hover:bg-secondary/60"
              >
                <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">
                  <span className="mr-2 inline-block h-1.5 w-1.5 bg-airlock opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="text-airlock">{a.id}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 font-mono text-xs tabular-nums text-muted-foreground">
                  {new Date(a.occurred_at).toISOString().replace("T", " ").slice(0, 19)}
                </td>
                <td className="px-3 py-3 font-mono text-xs tabular-nums">{a.source_ip}</td>
                <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">{a.asset?.name}</td>
                <td className="px-3 py-3">{a.alert_type}</td>
                <td className="px-3 py-3"><StatusBadge tone={severityTone(a.severity)}>{a.severity}</StatusBadge></td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{a.status}</td>
                <td className="px-3 py-3"><AirlockIcon status={a.airlock_status} poisoned={a.poisoned} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {data.length} alerts · synthetic data · Airlock status updates after triage runs on an incident
      </p>
    </div>
  );
}
