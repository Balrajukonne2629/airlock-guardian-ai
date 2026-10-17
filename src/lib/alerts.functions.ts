import { createServerFn } from "@tanstack/react-start";

export const listAlerts = createServerFn({ method: "GET" }).handler(async () => {
  const { readDemo } = await import("./supabase-public.server");
  return readDemo("alerts");
});
