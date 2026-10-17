import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Verdict, RuleHit } from "./airlock-rules";
import { judgeCanary, inferCanary, type Canary } from "./canary";

export interface ScanResult {
  verdict: Verdict;
  matchedRules: RuleHit[];
  layer2: { verdict: Verdict | "unavailable"; reason: string };
  reason: string;
  cleaned: string;
  sanitized: string;
  model: string;
}

export const airlockScan = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ text: z.string().min(1).max(8000), alertId: z.string().optional(), field: z.string().optional(), source: z.string().optional() }).parse(d),
  )
  .handler(async ({ data }): Promise<ScanResult> => {
    const { scanText } = await import("./airlock.server");
    return scanText(data.text, { alertId: data.alertId ?? null, field: data.field ?? null, source: data.source ?? "lab" });
  });

export const listPresets = createServerFn({ method: "GET" }).handler(async () => {
  const { publicClient } = await import("./supabase-public.server");
  const { data, error } = await (await publicClient())
    .from("benchmark_payloads")
    .select("id, kind, category, payload, canary_goal, canary_type, canary_value")
    .in("id", ["A-UA-1", "A-FS-2", "A-B64-1", "A-ML-2", "A-TC-1", "A-EX-1", "B-06", "B-07"]);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export interface LabSide {
  ok: boolean;
  error?: string;
  severity?: string;
  confidence?: number;
  summary?: string;
  obeyed?: boolean;
}

/** Lab: same fixed high-severity context (web shell upload) for both modes; only the user-agent is untrusted input. */
export const labTriage = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        text: z.string().min(1).max(8000),
        canary: z.object({ type: z.enum(["severity", "string"]), value: z.string() }).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { triageNaive, triageAirlock, AI_MODEL } = await import("./triage.server");
    const canary: Canary | null = data.canary ?? inferCanary(data.text);
    const bundle = {
      id: "LAB-0001",
      alert_type: "Web shell upload",
      source_ip: "198.51.100.23",
      occurred_at: new Date().toISOString(),
      asset: { name: "web-portal-02", asset_type: "Web Server", criticality: "High" },
      fields: {
        event: "POST /uploads/img_2291.php 200; uploaded file contains eval(base64_decode($_POST['x']))",
        user_agent: data.text,
      },
    };
    const [n, a] = await Promise.allSettled([triageNaive(bundle), triageAirlock(bundle, "lab")]);
    const side = (o: { severity: string; confidence: number; summary: string } | null, err?: unknown, full?: unknown): LabSide =>
      o
        ? { ok: true, severity: o.severity, confidence: o.confidence, summary: o.summary, obeyed: judgeCanary(canary, { severity: o.severity, output: full }) }
        : { ok: false, error: err instanceof Error ? err.message : "Triage failed" };
    const scan = a.status === "fulfilled" ? a.value.scans.find((s) => s.field === "user_agent") ?? null : null;
    return {
      model: AI_MODEL,
      canary,
      naive: n.status === "fulfilled" ? side(n.value, undefined, n.value) : side(null, n.reason),
      airlock: a.status === "fulfilled" ? side(a.value.output, undefined, a.value.output) : side(null, a.reason),
      airlockVerdict: scan?.verdict ?? null,
    };
  });
