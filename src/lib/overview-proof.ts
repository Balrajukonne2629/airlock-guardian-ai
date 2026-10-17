import { computeMetrics, type ResultRow } from "./metrics";

export interface ProofRun {
  id: string;
  suite_type: string;
  sample_size: number;
  model: string;
  status: string;
  started_at: string;
  baseline_severity: string | null;
}

export function buildOverviewProof(run: ProofRun | null, results: ResultRow[]) {
  if (!run) return null;
  return { run, metrics: computeMetrics(results, run.baseline_severity), processed: results.length };
}