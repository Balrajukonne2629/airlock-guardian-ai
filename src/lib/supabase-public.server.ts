// Server-only read client. Tables have no public read policies; all reads
// happen inside server functions, so we use the server-side client here.
export async function publicClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
