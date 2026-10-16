import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/benchmark")({
  head: () => ({
    meta: [
      { title: "Benchmark — LogAirlock" },
      { name: "description", content: "Measured attack success rate: naive agent vs Airlock, from stored benchmark runs." },
      { property: "og:title", content: "Benchmark — LogAirlock" },
      { property: "og:description", content: "Prompt-injection benchmark results for SOC triage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BenchmarkPage,
});

function BenchmarkPage() {
  return (
    <div className="space-y-4">
      <ComingSoon eyebrow="Proof / Measured" title="Benchmark" phase="Phase 4 — run-benchmark" />
      <section className="mx-auto max-w-7xl border border-l-2 border-l-warning bg-card px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-warning">Limitations</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Small sample (40 attacks, 40 benign lines). Results are indicative, not statistically robust.</li>
          <li>Single model per run. Other models may behave differently.</li>
          <li>Rules were developed with knowledge of the test payloads; real-world detection will be lower.</li>
          <li>Not a guarantee of protection against prompt injection.</li>
        </ul>
      </section>
    </div>
  );
}
