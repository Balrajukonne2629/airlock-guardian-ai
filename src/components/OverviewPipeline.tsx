import { ArrowDown, ArrowRight, FileWarning, Filter, ShieldCheck, Bot, LockKeyhole, UserCheck } from "lucide-react";

const stages = [
  { label: "Untrusted log", detail: "Attacker-controlled text", icon: FileWarning },
  { label: "Airlock Layer 1", detail: "Rules", icon: Filter },
  { label: "Airlock Layer 2", detail: "AI classifier", icon: ShieldCheck },
  { label: "Quarantine +", detail: "<quoted_evidence>", icon: LockKeyhole },
  { label: "Triage agent", detail: "Evidence → assessment", icon: Bot },
  { label: "Analyst approves", detail: "Human decision", icon: UserCheck },
];

export function OverviewPipeline() {
  return (
    <div aria-label="Airlock containment pipeline" className="mt-5">
      <div className="relative grid gap-8 lg:grid-cols-6 lg:gap-4">
        {stages.map(({ label, detail, icon: Icon }, index) => (
          <div key={label} className="relative flex min-w-0 items-center gap-3 border-t pt-4 lg:block">
            <Icon aria-hidden className={index > 0 && index < 4 ? "h-5 w-5 shrink-0 text-airlock" : "h-5 w-5 shrink-0 text-muted-foreground"} />
            <div className="min-w-0 lg:mt-3">
              <p className="text-sm font-semibold">{label}</p>
              <p className="mt-1 break-words font-mono text-[11px] text-muted-foreground">{detail}</p>
            </div>
            {index < stages.length - 1 && <>
              <ArrowRight aria-hidden className="absolute -right-3 top-4 hidden h-4 w-4 text-sealed lg:block" />
              <ArrowDown aria-hidden className="absolute -bottom-6 left-0 h-4 w-4 text-sealed lg:hidden" />
            </>}
          </div>
        ))}
      </div>
      <svg role="img" aria-label="Hostile instructions are sealed at the Airlock boundary; clean evidence passes through" viewBox="0 0 900 76" className="mt-5 hidden w-full lg:block" fill="none">
        <path d="M8 18H206V45H366" stroke="var(--hostile)" strokeWidth="2" />
        <path d="M367 34V56M374 34V56" stroke="var(--sealed)" strokeWidth="3" />
        <text x="16" y="12" fill="var(--hostile)" fontSize="11" fontFamily="JetBrains Mono">hostile</text>
        <text x="387" y="49" fill="var(--sealed)" fontSize="11" fontFamily="JetBrains Mono">[QUARANTINED]</text>
        <path d="M8 68H885M877 62L885 68L877 74" stroke="var(--sealed)" strokeWidth="2" />
        <text x="670" y="60" fill="var(--sealed)" fontSize="11" fontFamily="JetBrains Mono">clean → quoted evidence</text>
      </svg>
      <div className="mt-8 flex flex-wrap items-center gap-2 border-l-2 border-l-sealed pl-3 font-mono text-xs lg:hidden">
        <span className="text-hostile">hostile</span><ArrowRight aria-hidden className="h-4 w-4 text-hostile" /><span className="text-sealed">[QUARANTINED]</span>
        <span className="w-full text-sealed">clean → quoted evidence → agent</span>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
        <span className="font-semibold text-hostile">Naive path</span>
        <span>Raw logs go straight to the agent</span>
        <svg aria-hidden viewBox="0 0 120 12" className="h-3 w-24 text-hostile" fill="none"><path d="M0 6H117M111 1L117 6L111 11" stroke="currentColor" strokeDasharray="4 3" /></svg>
      </div>
    </div>
  );
}