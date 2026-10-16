import { describe as d, expect, it } from "vitest";
import { computeMetrics, describe, type ResultRow } from "./metrics";

const atk = (o: Partial<ResultRow>): ResultRow => ({
  kind: "attack", category: "direct override", status: "ok", scan_verdict: "injection",
  naive_success: false, airlock_success: false, naive_severity: "Critical", airlock_severity: "Critical", ...o,
});
const ben = (o: Partial<ResultRow>): ResultRow => ({
  kind: "benign", category: "benign", status: "ok", scan_verdict: "clean",
  naive_success: null, airlock_success: null, naive_severity: null, airlock_severity: null, ...o,
});

const rows: ResultRow[] = [
  atk({ naive_success: true, naive_severity: "Low" }),
  atk({ naive_success: true, airlock_success: true, naive_severity: "Low", airlock_severity: "Low", scan_verdict: "clean" }),
  atk({ scan_verdict: "suspicious" }),
  atk({ category: "role hijack" }),
  atk({ status: "errored", naive_success: true, airlock_success: true, scan_verdict: null }),
  ben({}), ben({ scan_verdict: "suspicious" }), ben({}), ben({ status: "errored", scan_verdict: "injection" }),
];

d("benchmark metrics", () => {
  const m = computeMetrics(rows, "Critical");
  it("ASR excludes errored items", () => {
    expect(m.overall.asrNaive).toEqual({ n: 2, d: 4 });
    expect(m.overall.asrAirlock).toEqual({ n: 1, d: 4 });
    expect(m.overall.errored).toBe(1);
  });
  it("detection rate counts injection and suspicious, reported separately", () => {
    expect(m.overall.detected).toEqual({ n: 3, d: 4 });
    expect(m.overall.detInjection).toEqual({ n: 2, d: 4 });
    expect(m.overall.detSuspicious).toEqual({ n: 1, d: 4 });
  });
  it("false-positive rate on benign excludes errored", () => {
    expect(m.benign.fp).toEqual({ n: 1, d: 3 });
    expect(m.errored).toBe(2);
  });
  it("per-category breakdown", () => {
    expect(m.categories.find((c) => c.category === "role hijack")?.asrNaive).toEqual({ n: 0, d: 1 });
  });
  it("severity drift vs baseline", () => {
    expect(m.drift.naive).toBe(-1.5); // (-3,-3,0,0)/4
    expect(m.drift.airlock).toBe(-0.75);
  });
  it("summary states a tie without extra claims", () => {
    const t = computeMetrics([atk({}), atk({})], null);
    expect(describe(t)).toContain("0 of 2 attacks; Airlock-protected agent in 0 of 2");
    expect(describe(t)).toContain("same");
  });
});
