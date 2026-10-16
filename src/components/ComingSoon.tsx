export function ComingSoon({ eyebrow, title, phase }: { eyebrow: string; title: string; phase: string }) {
  return (
    <div className="mx-auto max-w-7xl">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-airlock">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-6 border border-l-2 border-l-warning bg-card p-6">
        <p className="font-mono text-xs text-warning">// {phase}</p>
        <p className="mt-2 text-sm text-muted-foreground">This module is sealed until its build phase is approved.</p>
      </div>
    </div>
  );
}
