import { describe, it, expect } from "vitest";
import { computeMetrics, type ResultRow } from "./metrics";
import { wrapEvidence } from "./airlock-rules";

const row = (o: Partial<ResultRow>): ResultRow => ({ kind: "benign", category: "benign", status: "ok", scan_verdict: "clean", naive_success: null, airlock_success: null, naive_severity: null, airlock_severity: null, ...o });

describe("unverified scan path", () => {
  it("counts unverified benign items separately and never as clean or FP", () => {
    const m = computeMetrics([row({}), row({ status: "unverified", scan_verdict: "unverified" })], null);
    expect(m.benign.unverified).toBe(1);
    expect(m.benign.errored).toBe(0);
    expect(m.benign.fp).toEqual({ n: 0, d: 1 });
    expect(m.unverified).toBe(1);
  });

  it("excludes unverified attacks from attack-rate denominators", () => {
    const m = computeMetrics([
      row({ kind: "attack", category: "x", scan_verdict: "injection", naive_success: true, airlock_success: false }),
      row({ kind: "attack", category: "x", status: "unverified", scan_verdict: "unverified", naive_success: true, airlock_success: false }),
    ], null);
    expect(m.overall.unverified).toBe(1);
    expect(m.overall.asrNaive).toEqual({ n: 1, d: 1 });
    expect(m.overall.detected).toEqual({ n: 1, d: 1 });
  });

  it("unverified text is wrapped in quoted_evidence", () => {
    expect(wrapEvidence("hello")).toBe("<quoted_evidence>\nhello\n</quoted_evidence>");
  });
});
