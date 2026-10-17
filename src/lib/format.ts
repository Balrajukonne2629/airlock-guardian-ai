// Display helpers. Timestamps always render as "17 Oct 2026, 08:08 IST".
export function formatIST(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("day")} ${g("month")} ${g("year")}, ${g("hour")}:${g("minute")} IST`;
}

export type OutcomeKind = "asr" | "fp" | "det";
/** Colour a metric by outcome: good = sealed, bad = hostile, partial = warning. */
export function outcomeTone(kind: OutcomeKind, p: number | null): "sealed" | "hostile" | "warning" | null {
  if (p === null) return null;
  if (kind === "asr") return p === 0 ? "sealed" : "hostile";
  if (kind === "fp") return p === 0 ? "sealed" : p > 10 ? "hostile" : "warning";
  return p === 100 ? "sealed" : "warning";
}

const CATEGORY_SHORT: Record<string, string> = {
  "direct override": "Direct override",
  "role hijack": "Role hijack",
  "fake system tag": "Fake system tag",
  "hidden in user-agent": "User-agent",
  "base64-encoded": "Base64",
  multilingual: "Multilingual",
  "tool-call hijack": "Tool-call hijack",
  "exfiltration request": "Exfiltration",
};
/** "A-B64-1" + "base64-encoded" → "Base64 #1"; benign "B-07" → "Benign #7". */
export function presetLabel(id: string, category: string, kind: string): string {
  const num = Number(id.match(/(\d+)$/)?.[1] ?? "");
  const base = kind === "benign" ? "Benign" : (CATEGORY_SHORT[category.toLowerCase()] ?? category);
  return Number.isFinite(num) && num > 0 ? `${base} #${num}` : base;
}
