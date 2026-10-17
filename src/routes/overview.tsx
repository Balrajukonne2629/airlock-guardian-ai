import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Activity, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OverviewPipeline } from "@/components/OverviewPipeline";
import { StatusBadge } from "@/components/StatusBadge";
import { getOverviewProof } from "@/lib/overview.functions";
import { pct, type Ratio } from "@/lib/metrics";
import { type buildOverviewProof } from "@/lib/overview-proof";
import { formatIST, outcomeTone, type OutcomeKind } from "@/lib/format";

const proofQuery = queryOptions({ queryKey: ["overview-proof"], queryFn: () => getOverviewProof(), staleTime: 0 });

export const Route = createFileRoute("/overview")({
  head: () => ({
    meta: [
      { title: "Overview — LogAirlock" },
      { name: "description", content: "LogAirlock contains attacker-controlled log instructions before AI SOC triage. Explore its pipeline, stored benchmark proof, and honest limitations." },
      { property: "og:title", content: "Overview — LogAirlock" },
      { name: "twitter:title", content: "Overview — LogAirlock" },
      { property: "og:description", content: "Triage alerts. Never take orders from logs. Airlock containment, measured proof, and synthetic-demo disclosures." },
      { name: "twitter:description", content: "Triage alerts. Never take orders from logs. Airlock containment, measured proof, and synthetic-demo disclosures." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/overview" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/overview" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(proofQuery),
  component: OverviewPage,
});

function ProofRatio({ label, ratio, kind }: { label: string; ratio: Ratio; kind: OutcomeKind }) {
  const percentage = pct(ratio);
  const tone = outcomeTone(kind, percentage);
  const toneClass = tone ? { hostile: "text-hostile", sealed: "text-sealed", warning: "text-warning" }[tone] : "text-foreground";
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b py-3 last:border-b-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`font-mono text-sm tabular-nums ${toneClass}`}>
        {ratio.n} / {ratio.d}{" "}
        <span className="text-xs text-muted-foreground">({percentage === null ? "—" : `${percentage}%`})</span>
      </dd>
    </div>
  );
}

function ProofPanel({ title, proof }: { title: string; proof: ReturnType<typeof buildOverviewProof> }) {
  return (
    <article className="corner-ticks min-w-0 border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h3 className="micro-label !text-foreground">{title}</h3>
        {proof && <StatusBadge tone={proof.run.status === "complete" ? "sealed" : "warning"}>{proof.run.status}</StatusBadge>}
      </header>
      {!proof ? (
        <p className="px-4 py-10 font-mono text-sm text-muted-foreground">No run yet</p>
      ) : (
        <div className="px-4 pb-4">
          <dl>
            <ProofRatio label="Attack success · Naive" ratio={proof.metrics.overall.asrNaive} kind="asr" />
            <ProofRatio label="Attack success · Airlock" ratio={proof.metrics.overall.asrAirlock} kind="asr" />
            <ProofRatio label="Detected (injection + suspicious)" ratio={proof.metrics.overall.detected} kind="det" />
            <ProofRatio label="False positives (benign)" ratio={proof.metrics.benign.fp} kind="fp" />
          </dl>
          <dl className="mt-3 space-y-2 border-t pt-3 font-mono text-[11px] text-muted-foreground">
            <div><dt className="inline">Model: </dt><dd className="inline break-all text-foreground">{proof.run.model}</dd></div>
            <div><dt className="inline">Suite: </dt><dd className="inline text-foreground">{({ quick: "Quick Suite", full: "Full Suite", heldout: "Held-out Suite" } as Record<string, string>)[proof.run.suite_type] ?? proof.run.suite_type}</dd></div>
            <div><dt className="inline">Sample size: </dt><dd className="inline text-foreground">{proof.run.sample_size}</dd></div>
            <div><dt className="inline">Timestamp: </dt><dd className="inline text-foreground"><time dateTime={proof.run.started_at}>{formatIST(proof.run.started_at)}</time></dd></div>
          </dl>
          <p className="mt-3 text-[11px] text-muted-foreground">{proof.processed} processed · {proof.metrics.errored} errored · {proof.metrics.unverified ?? 0} unverified; both excluded from rates, never counted as clean. Flagged = injection or suspicious.</p>
          {proof.run.status !== "complete" && <p className="mt-2 text-xs text-warning">Partial run; these are only the stored results so far.</p>}
        </div>
      )}
    </article>
  );
}

function OverviewPage() {
  const { data } = useSuspenseQuery(proofQuery);
  return (
    <div className="mx-auto max-w-7xl">
      <section className="border-b pb-8">
        <p className="text-xs text-muted-foreground">Workspace / Overview</p>
        <h1 className="mt-3 text-3xl font-semibold">LogAirlock</h1>
        <p className="mt-4 text-lg font-medium">Triage alerts. Never take orders from logs.</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          AI triage agents read attacker-controlled log text, and hidden instructions in it can hijack the agent.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild className="shadow-none"><Link to="/">Open Alerts <ArrowRight /></Link></Button>
          <Button asChild variant="outline" className="shadow-none"><Link to="/benchmark">Open Benchmark <Activity /></Link></Button>
        </div>
      </section>

      <section className="border-b py-8">
        <h2 className="micro-label !text-foreground">Containment pipeline</h2>
        <OverviewPipeline />
      </section>

      <section className="border-b py-8">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="micro-label !text-foreground">Live proof</h2>
          <span className="text-xs text-muted-foreground">Latest stored run / each suite</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ProofPanel title="Quick Suite · seeded" proof={data.quick} />
          <ProofPanel title="Held-out Suite · fairer comparison" proof={data.heldout} />
        </div>
      </section>

      <section className="border-b border-l-2 border-l-warning py-7 pl-4">
        <h2 className="micro-label flex items-center gap-2 !text-warning"><ShieldAlert aria-hidden className="h-3.5 w-3.5" /> Honest limits</h2>
        <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-relaxed text-muted-foreground">
          <li>Small samples; results are indicative, not statistically robust.</li>
          <li>Single model per run. Other models may behave differently.</li>
          <li>Rules were developed with knowledge of the seeded payloads, so the held-out set is the fairer number.</li>
          <li>Not a guarantee of real-world detection.</li>
          <li>Synthetic data only.</li>
        </ul>
      </section>

      <section className="border-b py-8">
        <div className="flex flex-wrap items-center gap-3"><h2 className="micro-label !text-foreground">How it maps to risk</h2><StatusBadge tone="warning">Illustrative</StatusBadge></div>
        <p className="mt-4 max-w-full break-words font-mono text-sm leading-7 text-warning md:text-base">Exposure ₹ = Asset Value x Likelihood x Stage Factor</p>
        <div className="mt-4 flex flex-wrap gap-2">{["CERT-In", "DPDP Act", "ISO 27001"].map((name) => <StatusBadge key={name} tone="muted">{name} · may apply</StatusBadge>)}</div>
      </section>

      <section className="py-8">
        <h2 className="micro-label !text-foreground">Disclosures</h2>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
          <li>Built with Lovable.</li>
          <li>AI via Lovable AI Gateway using <span className="break-all font-mono">google/gemini-3-flash-preview</span>. Each benchmark run displays its recorded model.</li>
          <li>All payloads and alerts are self-written synthetic data; no real systems tested.</li>
        </ul>
      </section>
    </div>
  );
}
