import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const requireOperator = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ context, next }) => {
    const { data: user, error: userError } = await context.supabase.auth.getUser();
    if (userError || user.user?.id !== context.userId) throw new Error("Sign in again to continue.");
    const { data: allowed, error } = await context.supabase.rpc("is_logairlock_operator");
    if (error || !allowed) throw new Error("Your account needs operator approval before performing this action.");
    return next();
  });