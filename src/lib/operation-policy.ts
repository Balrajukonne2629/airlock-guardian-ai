export const USAGE_LIMITS = { minute: 120, day: 1200, maxReservation: 120, maxInput: 8000, maxFields: 16, maxBundle: 32000, maxSuite: 80 } as const;

export function canOperate(roles: readonly string[]): boolean {
  return roles.includes("admin") || roles.includes("operator");
}

export function assertOwnedRun(run: { owner_id: string | null; status: string } | null, userId: string): void {
  if (!run || run.owner_id !== userId) throw new Error("This benchmark belongs to another account.");
  if (run.status !== "running") throw new Error("This benchmark is no longer active.");
}

export function validateBundle(fields: Record<string, unknown>): number {
  const values = Object.values(fields).map(String);
  if (values.length > USAGE_LIMITS.maxFields || values.some((v) => v.length > USAGE_LIMITS.maxInput) || values.reduce((n, v) => n + v.length, 0) > USAGE_LIMITS.maxBundle) {
    throw new Error("Alert evidence exceeds the permitted size.");
  }
  return values.length + 2;
}

export function usageFits(used: number, requested: number, cap: number): boolean {
  return Number.isInteger(requested) && requested >= 1 && requested <= USAGE_LIMITS.maxReservation && used + requested <= cap;
}