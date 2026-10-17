import { expect, it } from "vitest";
import { buildOverviewProof, type ProofRun } from "./overview-proof";
import type { ResultRow } from "./metrics";

const run: ProofRun = { id: "stored-run", suite_type: "quick", sample_size: 5, model: "stored-model", status: "complete", started_at: "2026-10-17T02:20:00Z", baseline_severity: "Critical" };
const row: ResultRow = { kind: "attack", category: "override", status: "ok", scan_verdict: "injection", naive_success: true, airlock_success: false, naive_severity: "Low", airlock_severity: "Critical" };

it("returns no proof when no stored run exists", () => {
  expect(buildOverviewProof(null, [row])).toBeNull();
});
it("derives every proof count from stored result rows", () => {
  const proof = buildOverviewProof(run, [row, { ...row, naive_success: false }, { ...row, status: "errored" }, { ...row, kind: "benign", scan_verdict: "suspicious" }, { ...row, kind: "benign", scan_verdict: "clean" }]);
  expect(proof?.metrics.overall.asrNaive).toEqual({ n: 1, d: 2 });
  expect(proof?.metrics.overall.asrAirlock).toEqual({ n: 0, d: 2 });
  expect(proof?.metrics.overall.detected).toEqual({ n: 2, d: 2 });
  expect(proof?.metrics.benign.fp).toEqual({ n: 1, d: 2 });
  expect(proof?.metrics.errored).toBe(1);
  expect(proof?.run).toEqual(run);
});
it("does not invent results for a stored run with no processed items", () => {
  const proof = buildOverviewProof(run, []);
  expect(proof?.metrics.overall.asrNaive).toEqual({ n: 0, d: 0 });
  expect(proof?.processed).toBe(0);
});