import { createServerFn } from "@tanstack/react-start";

export const listAlerts = createServerFn({ method: "GET" }).handler(async () => {
  const { publicClient } = await import("./supabase-public.server");
  const sb = await publicClient();
  const { data, error } = await sb
    .from("alerts")
    .select("id, occurred_at, source_ip, alert_type, severity, status, poisoned, airlock_status, asset:assets(id, name, asset_value)")
    .order("occurred_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});
