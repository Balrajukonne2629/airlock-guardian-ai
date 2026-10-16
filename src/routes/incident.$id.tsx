import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/incident/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Incident ${params.id} — LogAirlock` },
      { name: "description", content: "Incident triage with attack chain, ATT&CK tags, ₹ exposure estimate and playbook." },
      { property: "og:title", content: `Incident ${params.id} — LogAirlock` },
      { property: "og:description", content: "Airlock-protected incident triage." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Incident,
});

function Incident() {
  const { id } = Route.useParams();
  return <ComingSoon eyebrow={`Incident / ${id}`} title="Incident Triage" phase="Phase 3 — triage" />;
}
