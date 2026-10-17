import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Activity, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OverviewPipeline } from "@/components/OverviewPipeline";
import { StatusBadge } from "@/components/StatusBadge";
import { getOverviewProof } from "@/lib/overview.functions";
import { pct, type Ratio } from "@/lib/metrics";
import { type buildOverviewProof } from "@/lib/overview-proof";

const proofQuery = queryOptions({ queryKey: ["overview-proof"], queryFn: () => getOverviewProof(), staleTime: 0 });

export const Route = createFileRoute("/overview")({
  head: () => ({
    meta: [
      { title: "Overview — LogAirlock" },
      { name: "description", content: "LogAirlock contains attacker-controlled log instructions before AI SOC triage. Explore its pipeline, stored benchmark proof, and honest limitations." },
      { property: "og:title", content: "Overview — LogAirlock" },
      { property: "og:description", content: "Triage alerts. Never take orders from logs. Airlock containment, measured proof, and synthetic-demo disclosures." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/overview" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/overview" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(proofQuery),
  component: OverviewPage,
});

function ProofRatio({ label, ratio, tone }: { label: string; ratio: Ratio; tone: "hostile" | "sealed" | "airlock" }) {
  const percentage = pct(ratio);
  const toneClass = { hostile: "text-hostile", sealed: "text-sealed", airlock: "text-airlock" }[tone];
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b py-3 last:border-b-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`font-mono text-sm ${toneClass}`}>{ratio.n} / {ratio.d} <span className="text-xs text-muted-foreground">({percentage === null ? "—" : `${percentage}%`})</span></dd>
    </div>
  );
}

function ProofPanel({ title, proof }: { title: string; proof: ReturnType<typeof buildOverviewProof> }) {
  return (
    <article className="min-w-0 rounded-sm border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {proof && <StatusBadge tone={proof.run.status === "complete" ? "sealed" : "warning"}>{proof.run.status}</StatusBadge>}
      </header>
      {!proof ? <p className="px-4 py-10 font-mono text-sm text-muted-foreground">No run yet</p> : <div className="px-4 pb-4">
        <dl>
          <ProofRatio label="Naive compromised" ratio={proof.metrics.overall.asrNaive} tone="hostile" />
          <ProofRatio label="Airlock compromised" ratio={proof.metrics.overall.asrAirlock} tone="sealed" />
          <ProofRatio label="Airlock flagged attacks" ratio={proof.metrics.overall.detected} tone="airlock" />
          <ProofRatio label="False positives / benign" ratio={proof.metrics.benign.fp} tone="hostile" />
        </dl>
        <dl className="mt-3 space-y-2 border-t pt-3 font-mono text-[11px] text-muted-foreground">
          <div><dt className="inline">Model: </dt><dd className="inline break-all text-foreground">{proof.run.model}</dd></div>
          <div><dt className="inline">Suite: </dt><dd className="inline text-foreground">{proof.run.suite_type}</dd></div>
          <div><dt className="inline">Sample size: </dt><dd className="inline text-foreground">{proof.run.sample_size}</dd></div>
          <div><dt className="inline">Timestamp: </dt><dd className="inline text-foreground"><time dateTime={proof.run.started_at}>{proof.run.started_at.replace("T", " ").replace("Z", " UTC")}</time></dd></div>
        </dl>
        <p className="mt-3 text-[11px] text-muted-foreground">{proof.processed} processed · {proof.metrics.errored} errored; errors excluded from rates. Flagged = injection or suspicious.</p>
        {proof.run.status !== "complete" && <p className="mt-2 text-xs text-warning">Partial run; these are only the stored results so far.</p>}
      </div>}
    </article>
  );
}

function OverviewPage() {
  const { data } = useSuspenseQuery(proofQuery);
  return (
    <div className="mx-auto max-w-7xl">
      <section className="border-b pb-8 pt-4 md:pt-7">
        <p className="font-mono text-[10px] uppercase text-airlock">AI SOC / Containment boundary</p>
        <h1 className="mt-3 text-4xl font-semibold md:text-5xl">LogAirlock</h1>
        <p className="mt-4 text-lg font-medium md:text-xl">Triage alerts. Never take orders from logs.</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">AI triage agents read attacker-controlled log text, and hidden instructions in it can hijack the agent.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild className="shadow-none"><Link to="/">Open Alerts <ArrowRight /></Link></Button>
          <Button asChild variant="outline" className="shadow-none"><Link to="/benchmark">Open Benchmark <Activity /></Link></Button>
        </div>
      </section>

      <section className="border-b py-7">
        <h2 className="text-sm font-semibold uppercase">Containment pipeline</h2>
        <OverviewPipeline />
      </section>

      <section className="border-b py-7">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase">Live proof</h2>
          <span className="font-mono text-[10px] text-muted-foreground">Latest stored run / each suite</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ProofPanel title="Quick Suite · seeded" proof={data.quick} />
          <ProofPanel title="Held-out Suite · fairer comparison" proof={data.heldout} />
        </div>
      </section>

      <section className="border-b border-l-2 border-l-warning py-6 pl-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase text-warning"><ShieldAlert aria-hidden className="h-4 w-4" /> Honest limits</h2>
        <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-relaxed text-muted-foreground">
          <li>Small samples; results are indicative, not statistically robust.</li>
          <li>Single model per run. Other models may behave differently.</li>
          <li>Rules were developed with knowledge of the seeded payloads, so the held-out set is the fairer number.</li>
          <li>Not a guarantee of real-world detection.</li>
          <li>Synthetic data only.</li>
        </ul>
      </section>

      <section className="border-b py-7">
        <div className="flex flex-wrap items-center gap-3"><h2 className="text-sm font-semibold uppercase">How it maps to risk</h2><StatusBadge tone="warning">Illustrative</StatusBadge></div>
        <p className="mt-4 max-w-full break-words font-mono text-sm leading-7 text-warning md:text-base">Exposure ₹ = Asset Value x Likelihood x Stage Factor</p>
        <div className="mt-4 flex flex-wrap gap-2">{["CERT-In", "DPDP Act", "ISO 27001"].map((name) => <StatusBadge key={name} tone="muted">{name} · may apply</StatusBadge>)}</div>
      </section>

      <section className="py-7">
        <h2 className="text-sm font-semibold uppercase">Disclosures</h2>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
          <li>Built with Lovable.</li>
          <li>AI via Lovable AI Gateway using <span className="break-all font-mono">google/gemini-3-flash-preview</span>. Each benchmark run displays its recorded model.</li>
          <li>All payloads and alerts are self-written synthetic data; no real systems tested.</li>
        </ul>
      </section>
    </div>
  );
}