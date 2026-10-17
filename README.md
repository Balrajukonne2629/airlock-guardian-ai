# LogAirlock

AI-assisted SOC alert triage that treats attacker-controlled log text as evidence, never as instructions.

- Layer 1 pattern rules and a Layer 2 AI classifier scan every untrusted field; injections are replaced with `[QUARANTINED]` and the rest is wrapped as quoted evidence.
- Naive and Airlock triage run side by side on the same alert; a canary judge checks whether planted instructions were obeyed.
- Benchmark numbers are read only from stored runs. All data is synthetic.

Built with Lovable. AI via Lovable AI Gateway.

Tests: `bunx vitest run`
