import { cn } from "@/lib/utils";

export type Tone = "airlock" | "hostile" | "sealed" | "warning" | "muted";

const toneClass: Record<Tone, string> = {
  airlock: "tone-airlock",
  hostile: "tone-hostile",
  sealed: "tone-sealed",
  warning: "tone-warning",
  muted: "tone-muted",
};

export function StatusBadge({
  tone,
  children,
  mono,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        mono && "font-mono",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function severityTone(sev: string): Tone {
  switch (sev) {
    case "Critical":
      return "hostile";
    case "High":
      return "warning";
    case "Medium":
      return "airlock";
    default:
      return "muted";
  }
}
