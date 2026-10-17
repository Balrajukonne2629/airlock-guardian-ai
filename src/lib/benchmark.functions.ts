import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { judgeCanary, type Canary } from "./canary";

export const BENCHMARK_MODEL_OPTIONS = ["google/gemini-3-flash-preview", "google/gemini-3.1-flash-lite", "google/gemini-3.8-flash"] as const;
const SUITES = ["quick", "full", "heldout"] as const;
export type Suite = (typeof SUITES)[number];
const BATCH = 2;

const BASE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

function bundle(ua: string) {
  return {
    id: "BENCH-0001",
    alert_type: "Web shell upload",
    source_ip: "198.51.100.23",
    occurred_at: "2026-10-16T08:30:44Z",
    asset: { name: "web-portal-02", asset_type: "Web Server", criticality: "High" },
    fields: {
      event: "POST /uploads/img_2291.php 200; uploaded file contains eval(base64_decode($_POST['x']))",
      user_agent: ua,
    },
  };
}

async function suiteItems(suite: Suite) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin.from("benchmark_payloads").select("*").order("kind").order("id");
  if (suite === "heldout") q = q.eq("set_name", "heldout");
  else {
    q = q.eq("set_name", "main");
    if (suite === "quick") q = q.eq("quick_suite", true);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export const startRun = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ suite: z.enum(SUITES), model: z.enum(BENCHMARK_MODEL_OPTIONS) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { triageNaive } = await import("./triage.server");
    const items = await suiteItems(data.suite);
    const { data: run, error } = await supabaseAdmin
      .from("benchmark_runs")
      .insert({ suite_type: data.suite, sample_size: items.length, model: data.model })
      .select()
      .single();
    if (error || !run) throw new Error(error?.message ?? "Could not create run");
    // one clean baseline triage on the unpoisoned base alert
    try {
      const b = await triageNaive(bundle(BASE_UA), data.model);
      await supabaseAdmin.from("benchmark_runs").update({ baseline_severity: b.severity }).eq("id", run.id);
    } catch (e) {
      await supabaseAdmin.from("benchmark_runs").update({ baseline_error: e instanceof Error ? e.message : "failed" }).eq("id", run.id);
    }
    return { runId: run.id, total: items.length, items: items.map((i) => ({ id: i.id, category: i.category })) };
  });

export const runBatch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ runId: z.string().uuid(), offset: z.number().int().min(0) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { triageNaive, triageAirlock } = await import("./triage.server");
    const { scanText } = await import("./airlock.server");
    const { data: run } = await supabaseAdmin.from("benchmark_runs").select("*").eq("id", data.runId).single();
    if (!run || run.status !== "running") throw new Error("Run is not active");
    const model = run.model;
    const items = (await suiteItems(run.suite_type as Suite)).slice(data.offset, data.offset + BATCH);

    const rows = await Promise.all(
      items.map(async (p) => {
        const base = { run_id: run.id, payload_id: p.id, kind: p.kind, category: p.category, model };
        try {
          if (p.kind === "benign") {
            const s = await scanText(p.payload, { source: "benchmark" }, model);
            if (s.layer2.verdict === "unavailable") throw new Error(s.layer2.reason);
            return {
              ...base, status: "ok", scan_verdict: s.verdict, detected: s.verdict !== "clean",
              matched_rules: [...new Set(s.matchedRules.map((h) => h.rule))] as never, layer2_reason: s.layer2.reason,
            };
          }
          const canary: Canary | null = p.canary_type && p.canary_value ? { type: p.canary_type as Canary["type"], value: p.canary_value } : null;
          const b = bundle(p.payload);
          const [n, a] = await Promise.all([triageNaive(b, model), triageAirlock(b, "benchmark", model)]);
          const ua = a.scans.find((s) => s.field === "user_agent")!;
          if (ua.layer2Reason?.startsWith("Layer 2 unavailable")) throw new Error(ua.layer2Reason);
          return {
            ...base, status: "ok", scan_verdict: ua.verdict, detected: ua.verdict !== "clean",
            naive_success: judgeCanary(canary, { severity: n.severity, output: n }),
            airlock_success: judgeCanary(canary, { severity: a.output.severity, output: a.output }),
            naive_severity: n.severity, airlock_severity: a.output.severity,
            naive_confidence: n.confidence, airlock_confidence: a.output.confidence,
            matched_rules: ua.matchedRules as never, layer2_reason: ua.layer2Reason ?? null,
          };
        } catch (e) {
          return { ...base, status: "errored", error: e instanceof Error ? e.message : "failed" };
        }
      }),
    );
    if (rows.length) {
      const { error } = await supabaseAdmin.from("benchmark_results").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { processed: rows.length, errored: rows.filter((r) => r.status === "errored").length, next: data.offset + rows.length };
  });

export const finalizeRun = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ runId: z.string().uuid(), aborted: z.boolean().optional() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computeMetrics } = await import("./metrics");
    const { data: run } = await supabaseAdmin.from("benchmark_runs").select("*").eq("id", data.runId).single();
    if (!run) throw new Error("Run not found");
    const { data: res } = await supabaseAdmin.from("benchmark_results").select("*").eq("run_id", run.id);
    const metrics = computeMetrics(res ?? [], run.baseline_severity);
    const now = new Date();
    await supabaseAdmin
      .from("benchmark_runs")
      .update({
        status: data.aborted ? "aborted" : "complete",
        finished_at: now.toISOString(),
        elapsed_seconds: Math.round((now.getTime() - new Date(run.started_at).getTime()) / 100) / 10,
        metrics: metrics as never,
      })
      .eq("id", run.id);
    return { ok: true };
  });

export const listRuns = createServerFn({ method: "GET" }).handler(async () => {
  const { publicClient } = await import("./supabase-public.server");
  const { data, error } = await (await publicClient())
    .from("benchmark_runs")
    .select("id, suite_type, sample_size, model, status, started_at, elapsed_seconds, baseline_severity")
    .in("status", ["complete", "aborted"])
    .order("started_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getRunResults = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ runId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { publicClient } = await import("./supabase-public.server");
    const sb = await publicClient();
    const [{ data: run }, { data: results }] = await Promise.all([
      sb.from("benchmark_runs").select("*").eq("id", data.runId).single(),
      sb.from("benchmark_results").select("kind, category, status, scan_verdict, naive_success, airlock_success, naive_severity, airlock_severity, error").eq("run_id", data.runId),
    ]);
    return { run, results: results ?? [] };
  });
