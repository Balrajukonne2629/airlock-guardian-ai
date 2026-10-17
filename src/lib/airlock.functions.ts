import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOperator } from "./operation-auth";
import type { Verdict, RuleHit } from "./airlock-rules";
import { judgeCanary, inferCanary, type Canary } from "./canary";

export interface ScanResult {
  verdict: Verdict | "unverified";
  matchedRules: RuleHit[];
  layer2: { verdict: Verdict | "unavailable"; reason: string };
  reason: string;
  cleaned: string;
  sanitized: string;
  model: string;
}

export const airlockScan = createServerFn({ method: "POST" })
  .middleware([requireOperator])
  .inputValidator((d) =>
    z.object({ text: z.string().min(1).max(8000), alertId: z.string().max(40).optional(), field: z.string().max(80).optional(), source: z.enum(["lab"]).optional() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<ScanResult> => {
    const { reserveUsage } = await import("./operation.server");
    await reserveUsage(context.supabase, 1, "lab.scan");
    const { scanText } = await import("./airlock.server");
    return scanText(data.text, { alertId: data.alertId ?? null, field: data.field ?? null, source: data.source ?? "lab" });
  });

export const listPresets = createServerFn({ method: "GET" }).handler(async () => {
  const { readDemo } = await import("./supabase-public.server");
  return readDemo("presets");
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
  .middleware([requireOperator])
  .inputValidator((d) =>
    z
      .object({
        text: z.string().min(1).max(8000),
        canary: z.object({ type: z.enum(["severity", "string"]), value: z.string().max(100) }).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { reserveUsage } = await import("./operation.server");
    await reserveUsage(context.supabase, 4, "lab.triage");
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
