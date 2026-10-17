import { createServerFn } from "@tanstack/react-start";
import { buildOverviewProof } from "./overview-proof";

export const getOverviewProof = createServerFn({ method: "GET" }).handler(async () => {
  const { readDemo } = await import("./supabase-public.server");
  const runs = await readDemo("runs");
  const latest = (suite: "quick" | "heldout") => {
    const stored = runs.find((r) => r.run.suite_type === suite);
    return stored ? buildOverviewProof(stored.run, stored.results) : null;
  };
  const [quick, heldout] = [latest("quick"), latest("heldout")];
  return { quick, heldout };
});