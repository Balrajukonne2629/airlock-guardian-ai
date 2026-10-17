import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAccess } from "@/components/AccessProvider";
import { USAGE_LIMITS } from "@/lib/operation-policy";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Account access — LogAirlock" },
    { name: "description", content: "Sign in to LogAirlock. Operational actions require separately approved permissions." },
    { property: "og:title", content: "Account access — LogAirlock" },
    { property: "og:description", content: "Verified account access for LogAirlock security operations." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: AccountPage,
});

function AccountPage() {
  const access = useAccess();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signIn(provider: "google" | "lovable") {
    setBusy(true); setError("");
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: `${window.location.origin}/auth` });
      if (result.error) setError("Sign-in could not be completed. Please try again.");
    } catch { setError("Sign-in could not be completed. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-xl space-y-6 py-8">
    <div><p className="text-xs text-muted-foreground">Workspace / Account</p><h1 className="mt-2 text-3xl font-semibold">Account access</h1></div>
    {access.loading ? <Loader2 className="h-5 w-5 animate-spin" /> : access.signedIn ? <>
      <div className="flex items-center gap-2 border-y py-4"><ShieldCheck className="h-5 w-5 text-airlock" /><span>{access.allowed ? "Approved operator" : "Signed in · read-only access"}</span></div>
      {!access.allowed && <p className="text-sm text-muted-foreground">An administrator must approve your operational access. Signing in does not grant permission to run AI, edit assets, or approve incidents.</p>}
      <Button variant="outline" onClick={() => { void supabase.auth.signOut(); }}>Sign out</Button>
    </> : <div className="space-y-3 border-y py-6">
      <Button variant="outline" className="w-full" disabled={busy} onClick={() => { void signIn("google"); }}>Continue with Google</Button>
      <Button className="lovable-auth-button w-full" disabled={busy} onClick={() => { void signIn("lovable"); }}>Continue with Lovable</Button>
      <p className="text-sm text-muted-foreground">New accounts have read-only access until approved.</p>
    </div>}
    {error && <p role="alert" className="text-sm text-hostile">{error}</p>}
    <div className="space-y-2 text-sm text-muted-foreground"><h2 className="font-semibold text-foreground">AI usage safeguards</h2>
      <p>Up to {USAGE_LIMITS.minute} reserved AI calls per UTC minute and {USAGE_LIMITS.day} per UTC day, per approved account. One active benchmark at a time.</p>
      <p>Reservations count even when a call fails. This custom safeguard is not a spending guarantee.</p>
    </div>
  </div>;
}