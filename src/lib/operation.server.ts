import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function reserveUsage(client: SupabaseClient<Database>, calls: number, action: string) {
  const { error } = await client.rpc("reserve_ai_usage", { p_calls: calls, p_action: action });
  if (error) throw new Error(error.message.includes("safeguard") ? error.message : "AI operation could not be admitted. Try again later.");
}

// Only called after operator authorization, publishing the allowlisted synthetic projections.
export async function refreshDemo() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("refresh_demo_publications");
  if (error) throw new Error("Changes were saved, but the public demo could not refresh.");
}