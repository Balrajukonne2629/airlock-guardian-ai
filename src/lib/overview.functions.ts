import { createServerFn } from "@tanstack/react-start";
import { buildOverviewProof } from "./overview-proof";

export const getOverviewProof = createServerFn({ method: "GET" }).handler(async () => {
  const { publicClient } = await import("./supabase-public.server");
  const sb = publicClient();
  async function latest(suite: "quick" | "heldout") {
    const { data: run, error } = await sb.from("benchmark_runs")
      .select("id, suite_type, sample_size, model, status, started_at, baseline_severity")
      .eq("suite_type", suite).order("started_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error("Stored benchmark proof could not be loaded.");
    if (!run) return null;
    const { data: results, error: resultsError } = await sb.from("benchmark_results")
      .select("kind, category, status, scan_verdict, naive_success, airlock_success, naive_severity, airlock_severity")
      .eq("run_id", run.id);
    if (resultsError) throw new Error("Stored benchmark results could not be loaded.");
    return buildOverviewProof(run, results ?? []);
  }
  const [quick, heldout] = await Promise.all([latest("quick"), latest("heldout")]);
  return { quick, heldout };
});