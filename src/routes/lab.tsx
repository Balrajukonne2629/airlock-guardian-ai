import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/lab")({
  head: () => ({
    meta: [
      { title: "Airlock Lab — LogAirlock" },
      { name: "description", content: "Paste a log line and watch both Airlock layers decide: naive agent vs Airlock-protected." },
      { property: "og:title", content: "Airlock Lab — LogAirlock" },
      { property: "og:description", content: "Test prompt injection against a SOC triage agent." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ComingSoon eyebrow="Lab / Containment" title="Airlock Lab" phase="Phase 2 — airlock-scan" />,
});
