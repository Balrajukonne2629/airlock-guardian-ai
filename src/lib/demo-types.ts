import type { Database } from "@/integrations/supabase/types";
import type { StoredSide } from "./incident.functions";
import type { FieldScan } from "./triage.server";

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type DemoAlert = Pick<Row<"alerts">, "id" | "occurred_at" | "source_ip" | "alert_type" | "severity" | "status" | "poisoned" | "airlock_status"> & { asset: Pick<Row<"assets">, "id" | "name" | "asset_value"> };
export type DemoIncident = { alert: Row<"alerts"> & { asset: Row<"assets"> }; incident: (Omit<Row<"incidents">, "naive_output" | "airlock_output" | "scan_summary"> & { naive_output: StoredSide | null; airlock_output: StoredSide | null; scan_summary: FieldScan[] | null }) | null };
export type DemoRun = { run: Omit<Row<"benchmark_runs">, "owner_id" | "baseline_error">; results: Omit<Row<"benchmark_results">, "error" | "layer2_reason">[] };
export interface DemoPublications { alerts: DemoAlert[]; incidents: DemoIncident[]; presets: Row<"benchmark_payloads">[]; runs: DemoRun[] }