import type { ScanVerdict } from "./airlock-rules";

export type AlertAirlockStatus = "quarantined" | "unverified" | "suspicious" | "clean";

/** Precedence: quarantined (any injection) > unverified > suspicious > clean. Clean only if every field was verified clean. */
export function alertAirlockStatus(verdicts: readonly ScanVerdict[]): AlertAirlockStatus {
  if (verdicts.includes("injection")) return "quarantined";
  if (verdicts.length === 0 || verdicts.includes("unverified")) return "unverified";
  if (verdicts.includes("suspicious")) return "suspicious";
  return verdicts.every((v) => v === "clean") ? "clean" : "unverified";
}
