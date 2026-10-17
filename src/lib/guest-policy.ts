import { z } from "zod";
import { scanLayer1, combineVerdict, quarantine, wrapEvidence, type RuleHit, type ScanVerdict } from "./airlock-rules";

/** Single place to configure the guest demo. */
export const GUEST_LIMITS = {
  maxInput: 500,
  runsPerHour: 8,
  dailyAiCalls: 150,
  /** AI calls per guest run: 1 Lab scan + 1 naive triage + 2 Airlock field scans + 1 Airlock triage. */
  callsPerRun: 5,
} as const;

export const PAUSED_MESSAGE = "AI check paused (demo budget). Layer 1 result only.";

export const guestInputSchema = z.object({
  text: z.string().min(1).max(GUEST_LIMITS.maxInput),
  token: z.string().regex(/^[A-Za-z0-9-]{16,64}$/),
});

export type GuestDenyReason = "disabled" | "hourly" | "budget";

export function decideGuestAdmission(s: { aiEnabled: boolean; runsUsed: number; budgetUsed: number }): { admit: true } | { admit: false; reason: GuestDenyReason } {
  if (!s.aiEnabled) return { admit: false, reason: "disabled" };
  if (s.runsUsed >= GUEST_LIMITS.runsPerHour) return { admit: false, reason: "hourly" };
  if (s.budgetUsed + GUEST_LIMITS.callsPerRun > GUEST_LIMITS.dailyAiCalls) return { admit: false, reason: "budget" };
  return { admit: true };
}

/** Layer-1-only result, following the fail-closed rule: Unverified unless a strong rule matched. Never clean. */
export function layer1Only(text: string): { verdict: ScanVerdict; matchedRules: RuleHit[]; cleaned: string; sanitized: string } {
  const hits = scanLayer1(text);
  const verdict = combineVerdict(hits, "unavailable");
  const cleaned = verdict === "injection"
    ? (hits.some((h) => h.start >= 0) ? quarantine(text, hits) : "[QUARANTINED]")
    : quarantine(text, hits.filter((h) => h.rule === "unicode.zero_width"));
  return { verdict, matchedRules: hits, cleaned, sanitized: wrapEvidence(cleaned) };
}
