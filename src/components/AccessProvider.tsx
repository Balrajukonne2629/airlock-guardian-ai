import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccess } from "@/lib/access.functions";
import { canOperate } from "@/lib/operation-policy";

const AccessContext = createContext({ signedIn: false, allowed: false, loading: true });
export const useAccess = () => useContext(AccessContext);

export function AccessProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();
  const getAccess = useServerFn(getMyAccess);
  const access = useQuery({ queryKey: ["my-access"], queryFn: () => getAccess(), enabled: ready && signedIn, retry: false });
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => { if (active) { setSignedIn(!!data.session); setReady(true); } });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].includes(event)) return;
      setSignedIn(!!session); setReady(true);
      if (event === "SIGNED_OUT") {
        qc.removeQueries({ queryKey: ["my-access"] });
        qc.removeQueries({ queryKey: ["incident-audit"] });
      } else { void qc.invalidateQueries(); }
      void router.invalidate();
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [qc, router]);
  return <AccessContext.Provider value={{ signedIn, allowed: signedIn && canOperate(access.data?.roles ?? []), loading: !ready || (signedIn && access.isPending) }}>{children}</AccessContext.Provider>;
}