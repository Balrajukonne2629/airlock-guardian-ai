import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
    const { publicClient } = await import("./supabase-public.server");
    const sb = publicClient();
    const { data: alert, error } = await sb
      .from("alerts")
      .select("*, asset:assets(*)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!alert) return null;
    const { data: incident } = await sb.from("incidents").select("*").eq("alert_id", data.id).maybeSingle();
    return {
      alert,
      incident: incident
        ? {
            ...incident,
            naive_output: incident.naive_output as unknown as StoredSide | null,
            airlock_output: incident.airlock_output as unknown as StoredSide | null,
            scan_summary: incident.scan_summary as unknown as FieldScan[] | null,
          }
        : null,
    };
  });

export const runTriage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { triageNaive, triageAirlock, AI_MODEL } = await import("./triage.server");
    const { data: alert, error } = await supabaseAdmin.from("alerts").select("*, asset:assets(*)").eq("id", data.id).single();
    if (error || !alert) throw new Error("Alert not found");
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
    const naiveCompromised = naive.ok ? judgeCanary(canary, { severity: naive.output!.severity, output: naive.output }) : null;

    // keep previously stored successful side if this attempt failed
    const { data: prev } = await supabaseAdmin.from("incidents").select("naive_output, airlock_output, scan_summary, naive_compromised").eq("alert_id", alert.id).maybeSingle();
    const prevN = prev?.naive_output as unknown as StoredSide | null;
    const prevA = prev?.airlock_output as unknown as StoredSide | null;
    const finalN = naive.ok || !prevN?.ok ? naive : prevN;
    const finalA = airlock.ok || !prevA?.ok ? airlock : prevA;

    await supabaseAdmin.from("incidents").upsert(
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
    if (scans) {
      const status = scans.some((s) => s.verdict === "injection") ? "quarantined" : scans.some((s) => s.verdict === "suspicious") ? "suspicious" : "clean";
      await supabaseAdmin.from("alerts").update({ airlock_status: status }).eq("id", alert.id);
    }
    return { naiveOk: naive.ok, airlockOk: airlock.ok, errors: [naive.error, airlock.error].filter(Boolean) };
  });

export const approveIncident = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("incidents").update({ status: "Approved", approved_at: now }).eq("alert_id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("alerts").update({ status: "Approved" }).eq("id", data.id);
    return { approved_at: now };
  });

export const updateAssetValue = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ assetId: z.string().max(20), value: z.number().min(0).max(1e12) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("assets").update({ asset_value: data.value }).eq("id", data.assetId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
