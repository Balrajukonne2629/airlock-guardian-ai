import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireOperator } from "./operation-auth";
import { GUEST_LIMITS, PAUSED_MESSAGE, guestInputSchema, layer1Only, type GuestDenyReason } from "./guest-policy";
import { judgeCanary, inferCanary } from "./canary";
import type { ScanResult, LabSide } from "./airlock.functions";

/**
 * Guest demo for the Lab only. Visitors are identified by a hash of their IP plus a hash of a
 * browser token; both are counted and the stricter wins. This is APPROXIMATE: shared IPs, VPNs
 * and cleared storage can make it over- or under-count. The global daily AI budget is the hard cap.
 * Raw IPs are never stored.
 */
async function visitorKeys(token: string) {
  const salt = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "logairlock-guest";
  const ip = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const h = async (v: string) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}|${v}`));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
  };
  return { ipKey: `ip:${await h(ip)}`, tokenKey: `tk:${await h(token)}` };
}

export interface GuestRunResult {
  scan: ScanResult;
  triage: { model: string; canary: ReturnType<typeof inferCanary>; naive: LabSide; airlock: LabSide } | null;
  paused: { reason: GuestDenyReason; message: string } | null;
  runsLeft: number;
}

export const guestStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: guestInputSchema.shape.token }).parse(d))
  .handler(async ({ data }) => {
    const { ipKey, tokenKey } = await visitorKeys(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s, error } = await supabaseAdmin.rpc("guest_status", { p_ip_key: ipKey, p_token_key: tokenKey });
    if (error) throw new Error("Guest demo status unavailable.");
    const st = s as { runs_used: number; budget_used: number; ai_enabled: boolean };
    return {
      runsLeft: Math.max(0, GUEST_LIMITS.runsPerHour - st.runs_used),
      aiAvailable: st.ai_enabled && st.budget_used + GUEST_LIMITS.callsPerRun <= GUEST_LIMITS.dailyAiCalls,
    };
  });

export const guestLabRun = createServerFn({ method: "POST" })
  .inputValidator((d) => guestInputSchema.parse(d))
  .handler(async ({ data }): Promise<GuestRunResult> => {
    const { ipKey, tokenKey } = await visitorKeys(data.token);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: adm, error } = await supabaseAdmin.rpc("admit_guest_run", {
      p_ip_key: ipKey, p_token_key: tokenKey, p_calls: GUEST_LIMITS.callsPerRun,
      p_max_runs: GUEST_LIMITS.runsPerHour, p_daily_calls: GUEST_LIMITS.dailyAiCalls,
    });
    const a = (error ? { admit: false, reason: "budget", runs_used: GUEST_LIMITS.runsPerHour } : adm) as { admit: boolean; reason: GuestDenyReason | null; runs_used: number };
    const runsLeft = Math.max(0, GUEST_LIMITS.runsPerHour - a.runs_used);

    if (!a.admit) {
      // Layer 1 only; fail-closed verdict (Unverified unless a strong rule matched). Not logged as an AI scan.
      const l1 = layer1Only(data.text);
      return {
        scan: { ...l1, layer2: { verdict: "unavailable", reason: PAUSED_MESSAGE }, reason: PAUSED_MESSAGE, model: "none (paused)" },
        triage: null,
        paused: { reason: a.reason ?? "budget", message: PAUSED_MESSAGE },
        runsLeft,
      };
    }

    const { scanText } = await import("./airlock.server");
    const { triageNaive, triageAirlock, AI_MODEL } = await import("./triage.server");
    const canary = inferCanary(data.text);
    const bundle = {
      id: "LAB-0001", alert_type: "Web shell upload", source_ip: "198.51.100.23", occurred_at: new Date().toISOString(),
      asset: { name: "web-portal-02", asset_type: "Web Server", criticality: "High" },
      fields: { event: "POST /uploads/img_2291.php 200; uploaded file contains eval(base64_decode($_POST['x']))", user_agent: data.text },
    };
    const side = (o: { severity: string; confidence: number; summary: string } | null, err?: unknown): LabSide =>
      o ? { ok: true, severity: o.severity, confidence: o.confidence, summary: o.summary, obeyed: judgeCanary(canary, { severity: o.severity, output: o }) }
        : { ok: false, error: err instanceof Error ? "Triage failed" : "Triage failed" };
    const [scan, n, ar] = await Promise.all([
      scanText(data.text, { source: "guest", field: "user_agent", visitorHash: tokenKey }),
      triageNaive(bundle).then((o) => side(o), (e) => side(null, e)),
      triageAirlock(bundle, "guest", AI_MODEL, tokenKey).then((o) => side(o.output), (e) => side(null, e)),
    ]);
    return { scan, triage: { model: AI_MODEL, canary, naive: n, airlock: ar }, paused: null, runsLeft };
  });

/** Kill switch: operators only (server middleware + database check). */
export const getGuestAiEnabled = createServerFn({ method: "GET" })
  .middleware([requireOperator])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("guest_settings").select("ai_enabled").maybeSingle();
    return { enabled: data?.ai_enabled ?? false };
  });

export const setGuestAiEnabled = createServerFn({ method: "POST" })
  .middleware([requireOperator])
  .inputValidator((d) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_guest_ai_enabled", { p_enabled: data.enabled });
    if (error) throw new Error("Guest AI setting could not be changed.");
    return { enabled: data.enabled };
  });
