import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { BENCHMARK_MODEL_OPTIONS, finalizeRun, getRunResults, listRuns, runBatch, startRun, type Suite } from "@/lib/benchmark.functions";
import { computeMetrics, describe, pct, type Ratio, type Metrics } from "@/lib/metrics";
import { cn } from "@/lib/utils";

const runsQuery = queryOptions({ queryKey: ["runs"], queryFn: () => listRuns() });
const resultsQuery = (id: string) => queryOptions({ queryKey: ["run", id], queryFn: () => getRunResults({ data: { runId: id } }) });

export const Route = createFileRoute("/benchmark")({
  head: () => ({
    meta: [
      { title: "Benchmark — LogAirlock" },
      { name: "description", content: "Measured prompt-injection attack success rate: naive agent vs Airlock, from stored benchmark runs." },
      { property: "og:title", content: "Benchmark — LogAirlock" },
      { property: "og:description", content: "Prompt-injection benchmark results for SOC triage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(runsQuery),
  component: BenchmarkPage,
});

const SUITE_LABEL: Record<string, string> = { quick: "Quick Suite", full: "Full Suite", heldout: "Held-out Suite" };
const SUITE_N: Record<Suite, number> = { quick: 24, full: 80, heldout: 15 };

function R({ r, tone }: { r: Ratio; tone?: "hostile" | "sealed" | "airlock" }) {
  const p = pct(r);
  return (
    <span className="font-mono text-xs">
      <span className={cn(tone === "hostile" && "text-hostile", tone === "sealed" && "text-sealed", tone === "airlock" && "text-airlock")}>{p === null ? "—" : `${p}%`}</span>{" "}
      <span className="text-muted-foreground">({r.n} / {r.d})</span>
    </span>
  );
}

function useRunMetrics(id: string | undefined) {
  const q = useQuery({ ...resultsQuery(id ?? "none"), enabled: !!id });
  const m = useMemo(() => (q.data?.run ? computeMetrics(q.data.results, q.data.run.baseline_severity) : null), [q.data]);
  return { run: q.data?.run ?? null, metrics: m, loading: q.isLoading && !!id };
}

function RunMeta({ run, m }: { run: { suite_type: string; sample_size: number; model: string; started_at: string; elapsed_seconds: number | null; status: string }; m: Metrics }) {
  return (
    <span className="font-mono text-[10px] text-muted-foreground">
      {SUITE_LABEL[run.suite_type]} · n={m.overall.payloads} attacks + {m.benign.total} benign · {run.model} · {new Date(run.started_at).toLocaleString()} · {run.elapsed_seconds ?? "—"}s ·{" "}
      <span className={m.errored ? "text-warning" : ""}>{m.errored} errored</span>
      {run.status === "aborted" && <span className="text-warning"> · stopped early</span>}
    </span>
  );
}

function BenchmarkPage() {
  const { data: runs } = useSuspenseQuery(runsQuery);
  const qc = useQueryClient();
  const start = useServerFn(startRun);
  const batch = useServerFn(runBatch);
  const finalize = useServerFn(finalizeRun);

  const [model, setModel] = useState<(typeof BENCHMARK_MODEL_OPTIONS)[number]>(BENCHMARK_MODEL_OPTIONS[0]);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [progress, setProgress] = useState<{ suite: Suite; done: number; total: number; category: string; errored: number; t0: number } | null>(null);
  const [now, setNow] = useState(0);
  const stopRef = useRef(false);

  const mainRuns = runs.filter((r) => r.suite_type !== "heldout");
  const heldRuns = runs.filter((r) => r.suite_type === "heldout");
  const selectedId = selected ?? mainRuns[0]?.id;
  const heldId = heldRuns[0]?.id;
  const main = useRunMetrics(selectedId);
  const held = useRunMetrics(heldId);

  useEffect(() => {
    if (!progress) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [progress]);

  async function run(suite: Suite) {
    stopRef.current = false;
    const t0 = Date.now();
    setNow(t0);
    setProgress({ suite, done: 0, total: SUITE_N[suite], category: "baseline triage", errored: 0, t0 });
    let runId: string | null = null;
    try {
      const s = await start({ data: { suite, model } });
      runId = s.runId;
      let offset = 0;
      let errored = 0;
      while (offset < s.total && !stopRef.current) {
        setProgress({ suite, done: offset, total: s.total, category: s.items[offset]?.category ?? "", errored, t0 });
        const r = await batch({ data: { runId, offset } });
        errored += r.errored;
        offset = r.next;
        if (r.processed === 0) break;
      }
      setProgress({ suite, done: offset, total: s.total, category: "computing metrics", errored, t0 });
      await finalize({ data: { runId, aborted: stopRef.current } });
      toast.success(`${SUITE_LABEL[suite]} finished in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      await qc.invalidateQueries({ queryKey: ["runs"] });
      if (suite !== "heldout") setSelected(runId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Benchmark failed");
      if (runId) await finalize({ data: { runId, aborted: true } }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["runs"] });
    } finally {
      setProgress(null);
    }
  }

  const m = main.metrics;
  const chart = m
    ? [...m.categories, m.overall].map((c) => ({ name: c.category, Naive: pct(c.asrNaive) ?? 0, Airlock: pct(c.asrAirlock) ?? 0 }))
    : [];
  if (held.metrics) chart.push({ name: "Held-out (all)", Naive: pct(held.metrics.overall.asrNaive) ?? 0, Airlock: pct(held.metrics.overall.asrAirlock) ?? 0 });

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="micro-label text-airlock">Proof / Measured</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Benchmark</h1>
          <p className="mt-2 text-sm text-muted-foreground">Every number below is read from stored run results. Nothing is precomputed.</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Benchmark model
          <select value={model} onChange={(e) => setModel(e.target.value as typeof model)} disabled={!!progress} className="log-well rounded-sm px-2 py-1 text-foreground">
            {BENCHMARK_MODEL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      </div>

      <section className="border bg-card">
        <div className="flex flex-wrap items-center gap-2 p-3">
          {(["quick", "full", "heldout"] as Suite[]).map((s) => (
            <button
              key={s}
              onClick={() => run(s)}
              disabled={!!progress}
              className={cn(
                "inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-semibold disabled:opacity-40",
                s === "quick" ? "bg-primary text-primary-foreground hover:opacity-90" : "border border-airlock text-airlock hover:bg-secondary",
              )}
            >
              <Play className="h-3.5 w-3.5" /> Run {SUITE_LABEL[s]} ({SUITE_N[s]} items)
            </button>
          ))}
          {progress && (
            <button onClick={() => (stopRef.current = true)} className="ml-auto inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Square className="h-3 w-3" /> Stop after batch
            </button>
          )}
        </div>
        {progress && (
          <div className="border-t p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
              <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin text-airlock" /> {SUITE_LABEL[progress.suite]} · {progress.done} / {progress.total} · {progress.category}</span>
              <span className="text-muted-foreground">elapsed {((now - progress.t0) / 1000).toFixed(1)}s · {progress.errored} errored</span>
            </div>
            <div className="mt-2 h-1.5 w-full bg-well">
              <div className="h-full bg-airlock transition-all" style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
            </div>
          </div>
        )}
      </section>

      {!m && !main.loading && (
        <div className="border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">No run yet. Start the Quick Suite for a live demo.</div>
      )}

      {m && main.run && (
        <>
          <section className="border bg-card">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider">Results</h2>
              <div className="flex items-center gap-2">
                <RunMeta run={main.run} m={m} />
                {mainRuns.length > 1 && (
                  <select value={selectedId} onChange={(e) => setSelected(e.target.value)} className="log-well rounded-sm px-1.5 py-0.5 text-[10px] text-foreground">
                    {mainRuns.map((r) => <option key={r.id} value={r.id}>{SUITE_LABEL[r.suite_type]} · {new Date(r.started_at).toLocaleString()}</option>)}
                  </select>
                )}
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    {["Category", "Payloads", "ASR · Naive", "ASR · Airlock", "Detected (inj + susp)", "Injection / Suspicious"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {m.categories.map((c) => (
                    <tr key={c.category} className="border-b">
                      <td className="px-3 py-2">{c.category}</td>
                      <td className="px-3 py-2 font-mono text-xs">{c.payloads}{c.errored ? <span className="text-warning"> ({c.errored} err)</span> : null}</td>
                      <td className="px-3 py-2"><R r={c.asrNaive} tone="hostile" /></td>
                      <td className="px-3 py-2"><R r={c.asrAirlock} tone="sealed" /></td>
                      <td className="px-3 py-2"><R r={c.detected} tone="airlock" /></td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{c.detInjection.n} / {c.detSuspicious.n}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-l-2 border-l-airlock bg-secondary font-semibold">
                    <td className="px-3 py-2">All seeded attacks</td>
                    <td className="px-3 py-2 font-mono text-xs">{m.overall.payloads}</td>
                    <td className="px-3 py-2"><R r={m.overall.asrNaive} tone="hostile" /></td>
                    <td className="px-3 py-2"><R r={m.overall.asrAirlock} tone="sealed" /></td>
                    <td className="px-3 py-2"><R r={m.overall.detected} tone="airlock" /></td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{m.overall.detInjection.n} / {m.overall.detSuspicious.n}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-3 py-2">False-positive rate (benign)</td>
                    <td className="px-3 py-2 font-mono text-xs">{m.benign.total}{m.benign.errored ? <span className="text-warning"> ({m.benign.errored} err)</span> : null}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground" colSpan={2}>scan only, no triage</td>
                    <td className="px-3 py-2"><R r={m.benign.fp} tone="hostile" /></td>
                    <td />
                  </tr>
                  {held.metrics && held.run && (
                    <tr className="border-l-2 border-l-warning">
                      <td className="px-3 py-2">
                        <span className="font-semibold text-warning">Held-out set</span>
                        <div><RunMeta run={held.run} m={held.metrics} /></div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{held.metrics.overall.payloads} + {held.metrics.benign.total} benign</td>
                      <td className="px-3 py-2"><R r={held.metrics.overall.asrNaive} tone="hostile" /></td>
                      <td className="px-3 py-2"><R r={held.metrics.overall.asrAirlock} tone="sealed" /></td>
                      <td className="px-3 py-2"><R r={held.metrics.overall.detected} tone="airlock" /></td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">FP <R r={held.metrics.benign.fp} /></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="border bg-card lg:col-span-2">
              <header className="border-b px-4 py-2 text-xs font-semibold uppercase tracking-wider">Attack success rate · Naive vs Airlock (%)</header>
              <div className="h-72 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 40, left: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "JetBrains Mono" }} angle={-25} textAnchor="end" interval={0} />
                    <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, fontSize: 12 }} cursor={{ fill: "var(--secondary)" }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" />
                    <Bar dataKey="Naive" fill="var(--hostile)" />
                    <Bar dataKey="Airlock" fill="var(--airlock)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="border-t px-4 py-2 text-sm">{describe(m)}</p>
              {held.metrics && <p className="border-t px-4 py-2 text-sm text-muted-foreground"><span className="text-warning">Held-out:</span> {describe(held.metrics)}</p>}
            </section>

            <section className="border border-l-2 border-l-warning bg-card">
              <header className="flex items-center justify-between border-b px-4 py-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider">Severity drift</h2>
                <span className="text-[10px] uppercase text-warning">indicative</span>
              </header>
              <div className="space-y-2 p-4 font-mono text-xs">
                <p className="text-muted-foreground">Clean baseline: <span className="text-foreground">{m.drift.baseline ?? "unavailable"}</span></p>
                <p>Naive avg shift: <span className="text-hostile">{m.drift.naive === null ? "—" : `${m.drift.naive > 0 ? "+" : ""}${m.drift.naive}`}</span> levels</p>
                <p>Airlock avg shift: <span className="text-airlock">{m.drift.airlock === null ? "—" : `${m.drift.airlock > 0 ? "+" : ""}${m.drift.airlock}`}</span> levels</p>
                <p className="pt-2 font-sans text-[11px] text-muted-foreground">Average change in severity rank (Low=0 … Critical=3) vs one clean baseline triage of the same alert. Negative = downgraded.</p>
              </div>
            </section>
          </div>
        </>
      )}

      <section className="border border-l-2 border-l-warning bg-card px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-warning">Limitations</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Small sample (40 seeded attacks, 40 benign lines, 10 + 5 held-out). Results are indicative, not statistically robust.</li>
          <li>Single model per run. Other models may behave differently.</li>
          <li>Rules were developed with knowledge of the seeded test payloads; real-world detection will be lower. The held-out set is the fairer number.</li>
          <li>Errored items are excluded from rates and counted visibly.</li>
          <li>Not a guarantee of protection against prompt injection.</li>
        </ul>
      </section>
    </div>
  );
}
