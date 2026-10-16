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
  component: () => <ComingSoon eyebrow="Proof / Measured" title="Benchmark" phase="Phase 4 — run-benchmark" />,
});
