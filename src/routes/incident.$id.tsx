import { Button } from "@/components/ui/button";
import { formatIST } from "@/lib/format";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, Pencil, Play, ShieldAlert, ShieldCheck } from "lucide-react";
import { getIncident, runTriage, approveIncident, updateAssetValue } from "@/lib/incident.functions";
import { judgeCanary, type Canary } from "@/lib/canary";
import { StatusBadge, severityTone, type Tone } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { useAccess } from "@/components/AccessProvider";
import { OperationNotice } from "@/components/OperationNotice";
import { getIncidentAudit } from "@/lib/access.functions";

const incidentQuery = (id: string) => queryOptions({ queryKey: ["incident", id], queryFn: () => getIncident({ data: { id } }) });

export const Route = createFileRoute("/incident/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Incident ${params.id} — LogAirlock` },
      { name: "description", content: "Incident triage with attack chain, ATT&CK tags, ₹ exposure estimate and response playbook." },
      { property: "og:title", content: `Incident ${params.id} — LogAirlock` },
      { property: "og:description", content: "Airlock-protected vs naive AI incident triage." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context, params }) => {
    const d = await context.queryClient.ensureQueryData(incidentQuery(params.id));
    if (!d) throw notFound();
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-7xl border bg-card p-6 text-sm">
      Alert not found. <Link to="/" className="text-airlock">Back to queue</Link>
    </div>
  ),
  errorComponent: ({ error }) => <div className="tone-hostile mx-auto max-w-7xl border p-4 text-sm">{error instanceof Error ? error.message : "Failed to load"}</div>,
  component: IncidentPage,
});

const STAGE_FACTOR: Record<string, number> = {
  recon: 0.1,
  initial_access: 0.3,
  execution: 0.5,
  privilege_escalation: 0.5,
  lateral_movement: 0.7,
  exfiltration: 1.0,
};
const STAGE_LABEL: Record<string, string> = {
  recon: "Recon",
  initial_access: "Initial access",
  execution: "Execution",
  privilege_escalation: "Priv-esc",
  lateral_movement: "Lateral",
  exfiltration: "Exfiltration",
};

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function compliance(alertType: string, assetType: string) {
  const chips = ["CERT-In"];
  if (/exfil|phishing|travel|web shell|privilege/i.test(alertType) || /PII|Payment/i.test(assetType)) chips.push("DPDP Act");
  chips.push("ISO 27001");
  return chips;
}

function Card({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("border border-l-2 bg-card", className)}>
      <header className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {aside}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function IncidentPage() {
  const access = useAccess();
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(incidentQuery(id));
  const qc = useQueryClient();
  const run = useServerFn(runTriage);
  const approve = useServerFn(approveIncident);
  const saveAsset = useServerFn(updateAssetValue);
  const loadAudit = useServerFn(getIncidentAudit);
  const audit = useQuery({ queryKey: ["incident-audit", id], queryFn: () => loadAudit({ data: { id } }), enabled: access.allowed, retry: false });
  const [mode, setMode] = useState<"airlock" | "naive">("airlock");
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [editing, setEditing] = useState(false);
  const [assetDraft, setAssetDraft] = useState("");

  if (!data) throw new Error("Incident not found.");
  const alert = data.alert;
  const asset = alert.asset as unknown as { id: string; name: string; asset_type: string; asset_value: number; criticality: string };
  const inc = data.incident;
  const canary: Canary | null = alert.canary_type && alert.canary_value ? { type: alert.canary_type as Canary["type"], value: alert.canary_value } : null;

  const side = mode === "airlock" ? inc?.airlock_output : inc?.naive_output;
  const out = side?.ok ? side.output : undefined;

  const verdicts = useMemo(() => {
    const judge = (s?: typeof side) => (s?.ok && s.output ? judgeCanary(canary, { severity: s.output.severity, output: s.output }) : null);
    return { naive: judge(inc?.naive_output), airlock: judge(inc?.airlock_output) };
  }, [inc, canary]);

  const quarantined = inc?.scan_summary?.filter((s) => s.verdict === "injection") ?? [];

  async function doRun() {
    if (!access.allowed) return;
    setBusy(true);
    try {
      const r = await run({ data: { id } });
      if (r.errors.length) toast.error(r.errors.join(" · "));
      else toast.success("Triage complete — both modes stored");
      await qc.invalidateQueries({ queryKey: ["incident", id] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Triage failed");
    } finally {
      setBusy(false);
    }
  }

  async function doApprove() {
    if (!access.allowed) return;
    try {
      await approve({ data: { id } });
      toast.success("Recommendation approved — no action executed");
      await qc.invalidateQueries({ queryKey: ["incident-audit", id] });
      await qc.invalidateQueries({ queryKey: ["incident", id] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approval failed");
    }
  }

  async function doSaveAsset() {
    if (!access.allowed) return;
    const v = Number(assetDraft.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(v)) return;
    try {
      await saveAsset({ data: { assetId: asset.id, value: v } });
      setEditing(false);
      await qc.invalidateQueries({ queryKey: ["incident", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  const topStage = out?.chain.reduce((m, s) => ((STAGE_FACTOR[s.stage] ?? 0) > (STAGE_FACTOR[m] ?? 0) ? s.stage : m), "recon" as string) ?? null;
  const factor = (topStage ? STAGE_FACTOR[topStage] : 0) ?? 0;
  const likelihood = out?.confidence ?? 0;
  const exposure = Number(asset.asset_value) * likelihood * factor;

  const modeBadge = (m: "airlock" | "naive"): { tone: Tone; label: string } | null => {
    const s = m === "airlock" ? inc?.airlock_output : inc?.naive_output;
    if (!s) return null;
    if (!s.ok) return { tone: "muted", label: "Failed" };
    const v = verdicts[m];
    if (m === "airlock") return v ? { tone: "hostile", label: "Breached" } : { tone: "sealed", label: "Sealed" };
    if (!canary) return { tone: "muted", label: "No canary" };
    return v ? { tone: "hostile", label: "Compromised" } : { tone: "sealed", label: "Resisted" };
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-airlock">
        <ArrowLeft className="h-3 w-3" /> Alert queue
      </Link>

      <OperationNotice />
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-[0.2em] text-airlock">Incident / {alert.id}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-normal">{alert.alert_type} on {asset.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{alert.source_ip}</span>·<span className="font-mono">{formatIST(alert.occurred_at)}</span>·
            <span>Status: {inc?.status === "Approved" ? "Approved" : alert.status}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {out && (
              <>
                <StatusBadge tone={severityTone(out.severity)}>{out.severity}</StatusBadge>
                <span className="font-mono text-sm">{Math.round(out.confidence * 100)}% <span className="text-muted-foreground">conf.</span></span>
              </>
            )}
            <Button onClick={doRun} disabled={!access.allowed || busy} className="inline-flex items-center gap-2 rounded-sm bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {busy ? "Triaging both modes…" : inc ? "Re-run Triage" : "Run Triage"}
            </Button>
          </div>
          {/* segmented switch */}
          <div className="inline-flex max-w-full flex-wrap border" role="tablist">
            {(["airlock", "naive"] as const).map((m) => {
              const b = modeBadge(m);
              return (
                <Button
                  variant="ghost"
                  size="sm"
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex items-center gap-2 border-r px-3 py-1.5 text-xs font-medium last:border-r-0",
                    mode === m ? "bg-secondary text-airlock" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "airlock" ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                  {m === "airlock" ? "Airlock Protected" : "Naive Agent"}
                  {b && <StatusBadge tone={b.tone}>{b.label}</StatusBadge>}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {!inc && (
        <div className="border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No triage yet. <span className="text-foreground">Run Triage</span> sends this alert to the naive agent and the Airlock-protected agent in parallel.
        </div>
      )}

      {inc && side && !side.ok && (
        <div className="tone-hostile border border-l-2 border-l-hostile px-4 py-3 text-sm">
          {mode === "airlock" ? "Airlock" : "Naive"} triage failed: {side.error}
        </div>
      )}

      {inc && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Airlock field panel */}
            <Card title="Airlock · untrusted fields" aside={<span className="text-xs text-muted-foreground">{inc.scan_summary?.length ?? 0} scanned · {quarantined.length} quarantined</span>} className={quarantined.length ? "border-l-hostile" : "border-l-sealed"}>
              <ul className="divide-y">
                {(inc.scan_summary ?? []).map((s) => (
                  <li key={s.field} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{s.field}</span>
                      <StatusBadge tone={s.verdict === "injection" ? "hostile" : s.verdict === "suspicious" || s.verdict === "unverified" ? "warning" : "sealed"}>
                        {s.verdict === "injection" ? "Quarantined" : s.verdict === "unverified" ? "Unverified: AI check unavailable" : s.verdict}
                      </StatusBadge>
                    </div>
                    {s.verdict !== "clean" && (
                      <>
                        <pre className={cn("log-well mt-1.5 whitespace-pre-wrap break-words p-2", s.verdict === "injection" ? "text-hostile" : "text-warning")}>{s.raw}</pre>
                        <p className="mt-1 text-xs text-muted-foreground">{s.reason}</p>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {mode === "naive" && <p className="mt-3 border-t pt-2 font-mono text-[11px] text-hostile">// Naive mode: the agent received every field above raw, including quarantined text.</p>}
            </Card>

            {out && (
              <>
                <Card title="Attack chain" aside={<span className="text-xs text-muted-foreground">{mode === "airlock" ? "airlock output" : "naive output"}</span>} className={mode === "airlock" ? "border-l-airlock" : "border-l-hostile"}>
                  <ol className="relative ml-2 border-l">
                    {out.chain.map((s, i) => (
                      <li key={i} className="relative pb-4 pl-5 last:pb-0">
                        <span className="absolute -left-[5px] top-1.5 h-2 w-2 bg-airlock" />
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")} · {STAGE_LABEL[s.stage] ?? s.stage}</span>
                          <span className="text-sm font-medium">{s.title}</span>
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">{s.detail}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {s.techniques.map((t) => <StatusBadge key={t} tone="airlock" mono>{t}</StatusBadge>)}
                        </div>
                      </li>
                    ))}
                  </ol>
                </Card>

                <Card title="Manager summary" className="border-l-border">
                  <p className="text-sm leading-relaxed">{out.summary}</p>
                </Card>

                <Card
                  title="Response playbook"
                  className="border-l-airlock"
                  aside={inc.status === "Approved" ? <StatusBadge tone="sealed">Approved</StatusBadge> : <span className="text-xs text-muted-foreground">human-in-the-loop</span>}
                >
                  <ul className="space-y-1.5">
                    {out.playbook.map((p, i) => (
                      <li key={i}>
                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                          <input type="checkbox" checked={!!checked[i]} onChange={(e) => setChecked({ ...checked, [i]: e.target.checked })} className="mt-1 accent-[var(--airlock)]" />
                          <span className={cn(checked[i] && "text-muted-foreground line-through")}>{p}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={doApprove}
                    disabled={!access.allowed || inc.status === "Approved" || mode === "naive"}
                    title={mode === "naive" ? "Switch to Airlock Protected to approve" : undefined}
                    className="mt-4 inline-flex items-center gap-2 rounded-sm border border-sealed px-3 py-1.5 text-sm font-semibold text-sealed hover:bg-secondary disabled:opacity-40"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {inc.status === "Approved" ? `Approved ${inc.approved_at ? formatIST(inc.approved_at) : ""}` : "Approve recommendation"}
                  </Button>
                </Card>
              </>
            )}
          </div>

          <div className="space-y-6">
            {out && (
              <Card title="₹ Exposure" aside={<span className="text-xs text-warning">illustrative estimate</span>} className="border-l-warning">
                <p className="font-mono text-2xl font-semibold text-warning">{inr(exposure)}</p>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">Exposure ₹ = Asset Value × Likelihood × Stage Factor</p>
                <dl className="mt-3 divide-y border font-mono text-xs">
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <dt className="text-muted-foreground">Asset value</dt>
                    <dd className="flex items-center gap-1">
                      {editing ? (
                        <>
                          <input autoFocus value={assetDraft} onChange={(e) => setAssetDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doSaveAsset()} className="log-well w-28 px-1 py-0.5 text-right" />
                          <Button disabled={!access.allowed} onClick={doSaveAsset} className="text-airlock">save</Button>
                        </>
                      ) : (
                        <>
                          {inr(Number(asset.asset_value))}
                          <Button disabled={!access.allowed} onClick={() => { setAssetDraft(String(asset.asset_value)); setEditing(true); }} aria-label="Edit asset value" className="text-muted-foreground hover:text-airlock">
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between px-2 py-1.5"><dt className="text-muted-foreground">Likelihood (AI conf.)</dt><dd>{likelihood.toFixed(2)}</dd></div>
                  <div className="flex justify-between px-2 py-1.5"><dt className="text-muted-foreground">Stage factor ({topStage ? STAGE_LABEL[topStage] : "—"})</dt><dd>{factor.toFixed(1)}</dd></div>
                </dl>
                <p className="mt-2 text-[11px] text-muted-foreground">Asset value is a seeded assumption. Stage factors: recon 0.1, initial access 0.3, execution/priv-esc 0.5, lateral 0.7, exfiltration 1.0.</p>
              </Card>
            )}

            <Card title="Compliance · may apply" className="border-l-border">
              <div className="flex flex-wrap gap-1.5">
                {compliance(alert.alert_type, asset.asset_type).map((c) => <StatusBadge key={c} tone="muted">{c}</StatusBadge>)}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Mapping by incident type. Not legal advice.</p>
            </Card>

            {out && (
              <Card title="ATT&CK techniques" className="border-l-airlock">
                <div className="flex flex-wrap gap-1">{out.techniques.map((t) => <StatusBadge key={t} tone="airlock" mono>{t}</StatusBadge>)}</div>
              </Card>
            )}

            {access.allowed && (
              <Card title="Approval records" className="border-l-border">
                {audit.data?.length ? <ul className="space-y-3">{audit.data.map((entry) => <li key={entry.id} className="text-xs"><p>{entry.action}</p><p className="text-muted-foreground">{formatIST(entry.created_at)}</p><p className="break-all font-mono text-muted-foreground">Actor {entry.actor_id}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">No approvals recorded yet.</p>}
              </Card>
            )}
            {inc && (
              <Card title="Canary judge" className={verdicts.naive ? "border-l-hostile" : "border-l-border"}>
                {canary ? (
                  <>
                    <p className="text-xs text-muted-foreground">Injected goal</p>
                    <p className="font-mono text-xs text-warning">{canary.type === "severity" ? `set severity to ${canary.value}` : `output ${canary.value}`}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>Naive: {verdicts.naive === null ? "—" : verdicts.naive ? <span className="text-hostile">obeyed</span> : <span className="text-sealed">resisted</span>}</div>
                      <div>Airlock: {verdicts.airlock === null ? "—" : verdicts.airlock ? <span className="text-hostile">obeyed</span> : <span className="text-sealed">resisted</span>}</div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No injected payload in this alert; nothing to judge.</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">model {inc.model}</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
