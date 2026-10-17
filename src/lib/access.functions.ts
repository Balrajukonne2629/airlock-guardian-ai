import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOperator } from "./operation-auth";
import { z } from "zod";

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    if (error) throw new Error("Account permissions could not be loaded.");
    return { roles: (data ?? []).map((r) => r.role) };
  });

export const getIncidentAudit = createServerFn({ method: "GET" })
  .middleware([requireOperator])
  .inputValidator((d) => z.object({ id: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("operation_audit").select("id,actor_id,action,target,details,created_at").eq("target", data.id).order("created_at", { ascending: false }).limit(20);
    if (error) throw new Error("Approval records could not be loaded.");
    return rows ?? [];
  });