import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireOperator } from "./operation-auth";
import { validateBundle } from "./operation-policy";
import { judgeCanary, type Canary } from "./canary";
import type { TriageOutput, FieldScan } from "./triage.server";

export interface StoredSide {
  ok: boolean;
  error?: string;
  output?: TriageOutput;
}

export const getIncident = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const { readDemo } = await import("./supabase-public.server");
    return (await readDemo("incidents")).find((item) => item.alert.id === data.id) ?? null;
  });

export const runTriage = createServerFn({ method: "POST" })
  .middleware([requireOperator])
  .inputValidator((d) => z.object({ id: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { triageNaive, triageAirlock, AI_MODEL } = await import("./triage.server");
    const { data: alert, error } = await context.supabase.from("alerts").select("*, asset:assets(*)").eq("id", data.id).single();
    if (error || !alert) throw new Error("Alert not found");
    const { reserveUsage, refreshDemo } = await import("./operation.server");
    await reserveUsage(context.supabase, validateBundle(alert.raw_fields as Record<string, unknown>), "incident.triage");
    const asset = alert.asset as unknown as { name: string; asset_type: string; criticality: string };
    const bundle = {
      id: alert.id,
      alert_type: alert.alert_type,
      source_ip: alert.source_ip,
      occurred_at: alert.occurred_at,
      asset: { name: asset.name, asset_type: asset.asset_type, criticality: asset.criticality },
      fields: Object.fromEntries(Object.entries(alert.raw_fields as Record<string, unknown>).map(([k, v]) => [k, String(v)])),
    };

    const [n, a] = await Promise.allSettled([triageNaive(bundle), triageAirlock(bundle)]);
    const err = (r: PromiseRejectedResult) => (r.reason instanceof Error ? r.reason.message : "Triage failed");
    const naive: StoredSide = n.status === "fulfilled" ? { ok: true, output: n.value } : { ok: false, error: err(n) };
    const airlock: StoredSide = a.status === "fulfilled" ? { ok: true, output: a.value.output } : { ok: false, error: err(a) };
    const scans = a.status === "fulfilled" ? a.value.scans : null;

    const canary: Canary | null = alert.canary_type && alert.canary_value ? { type: alert.canary_type as Canary["type"], value: alert.canary_value } : null;
    const naiveCompromised = naive.ok && naive.output ? judgeCanary(canary, { severity: naive.output.severity, output: naive.output }) : null;

    // keep previously stored successful side if this attempt failed
    const { data: prev } = await supabaseAdmin.from("incidents").select("naive_output, airlock_output, scan_summary, naive_compromised").eq("alert_id", alert.id).maybeSingle();
    const prevN = prev?.naive_output as unknown as StoredSide | null;
    const prevA = prev?.airlock_output as unknown as StoredSide | null;
    const finalN = naive.ok || !prevN?.ok ? naive : prevN;
    const finalA = airlock.ok || !prevA?.ok ? airlock : prevA;

    const { error: saveError } = await supabaseAdmin.from("incidents").upsert(
      {
        alert_id: alert.id,
        naive_output: finalN as never,
        airlock_output: finalA as never,
        naive_compromised: naive.ok ? naiveCompromised : (prev?.naive_compromised ?? null),
        scan_summary: (scans ?? prev?.scan_summary ?? null) as never,
        model: AI_MODEL,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "alert_id" },
    );
    if (saveError) throw new Error("Triage could not be saved.");
    if (scans) {
      const { alertAirlockStatus } = await import("./alert-status");
      const status = alertAirlockStatus(scans.map((s) => s.verdict));
      await supabaseAdmin.from("alerts").update({ airlock_status: status }).eq("id", alert.id);
    }
    await refreshDemo();
    return { naiveOk: naive.ok, airlockOk: airlock.ok, errors: [naive.error, airlock.error].filter(Boolean) };
  });

export const approveIncident = createServerFn({ method: "POST" })
  .middleware([requireOperator])
  .inputValidator((d) => z.object({ id: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: approvedAt, error } = await context.supabase.rpc("approve_incident_audited", { p_id: data.id });
    if (error) throw new Error("Approval requires a successful Airlock triage and operator permission.");
    const { refreshDemo } = await import("./operation.server");
    await refreshDemo();
    return { approved_at: approvedAt };
  })

export const updateAssetValue = createServerFn({ method: "POST" })
  .middleware([requireOperator])
  .inputValidator((d) => z.object({ assetId: z.string().max(20), value: z.number().min(0).max(1e12) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("update_asset_value_audited", { p_id: data.assetId, p_value: data.value });
    if (error) throw new Error("Asset value could not be saved.");
    const { refreshDemo } = await import("./operation.server");
    await refreshDemo();
    return { ok: true };
  })
