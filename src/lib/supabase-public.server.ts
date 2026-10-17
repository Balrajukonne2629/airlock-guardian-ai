import { createServerOnlyFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { DemoPublications } from "./demo-types";

const publicClient = createServerOnlyFn(() => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Public demo is temporarily unavailable.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
});

// The publishable client cannot read any of the seven operational tables.
export async function readDemo<K extends keyof DemoPublications>(key: K): Promise<DemoPublications[K]> {
  const { data, error } = await publicClient().from("demo_publications").select("payload").eq("key", key).single();
  if (error || !Array.isArray(data?.payload)) throw new Error("Public demo could not be loaded.");
  return data.payload as unknown as DemoPublications[K];
}
