# LogAirlock — Full Build Plan

Tagline: "Triage alerts. Never take orders from logs." The project is currently a blank template, so this covers the full app: UI, Lovable Cloud database, built-in AI, and the benchmark.

## Design ("Industrial Containment")
- Colors as semantic tokens: base #090A0C, card #111318, log well #050608, hairline #222630, text #F1F5F9, muted #7D8590, cyan #00E5FF (Airlock/primary), crimson #FF2E4C (injection/naive compromise), emerald #10B981 (sealed), amber #FFB020 (suspicious/₹ risk).
- Inter for UI, JetBrains Mono for logs, ATT&CK tags, canaries, and the ₹ formula.
- Sharp edges (rounded-sm), 1px borders, visible grid hairlines, no shadows/gradients/glass. Status shown with 2px left accent bars and badges (10% fill, 30% border). High-density, terminal feel.
- Shell: left sidebar (airlock-door logo, Alerts / Airlock Lab / Benchmark), top bar with "Demo Corp" and a "Synthetic demo data" badge. Responsive.

## Pages
1. **Alerts (/)** — table of 10 seeded alerts: id, time, source IP, asset, type, severity, status, Airlock icon (clean / quarantined / not yet scanned). 3 contain poisoned fields. Row opens incident.
2. **Incident (/incident/$id)** — "Run triage" (Airlock mode) creates/refreshes a stored incident with real AI output: severity, confidence %, Airlock field panel (raw quarantined payload in crimson mono + reason), attack-chain timeline with ATT&CK chips, ₹ exposure card (Asset value × Likelihood × Stage factor, every input shown, asset value editable inline), compliance "may apply" chips (CERT-In, DPDP Act, ISO 27001 by incident type), manager summary, playbook checklist, "Approve & Execute" (human-in-the-loop, toast, status Approved). Optional toggle to view the naive result for contrast.
3. **Airlock Lab (/lab)** — mono textarea pre-filled with poisoned user-agent, plus preset payload picker. Run shows layer 1 (matched rules) and layer 2 (AI verdict + reason), the sanitized evidence block, then side-by-side Naive vs With-Airlock triage results (severity, canary obeyed or not).
4. **Benchmark (/benchmark)** — "Run benchmark" with live progress (n / 80 payloads, current category), results table per category (payloads, ASR naive, ASR airlock, detection rate) plus overall false-positive rate, bar chart Naive vs Airlock, run history selector, footnote with timestamp, model, sample size. Limitations text always visible: small sample, single model, not a guarantee. Empty state "No run yet" — all numbers read only from stored results.

## Data (Lovable Cloud)
Tables: assets (with editable asset_value in INR), alerts, incidents, airlock_events, benchmark_payloads, benchmark_runs, benchmark_results. Seeded in the migration: ~8 assets, 10 alerts, 40 attack payloads (5 each across the 8 categories, each with canary goal + canary type), 40 benign-but-odd lines. No login (demo app per PRD); public read access, writes go through server code.

## Server logic (3 functions)
1. **airlock-scan** — input text. Layer 1 regex/heuristics: override phrases, fake system/role tags, base64 blobs (decoded and re-checked), zero-width chars, tool-call imitation, exfil phrases, multilingual override phrases. Layer 2 AI classifier: clean | suspicious | injection + short reason. Combine into final verdict; injection text becomes [QUARANTINED], remainder wrapped as quoted evidence. Logs an airlock_event.
2. **triage** — input alert bundle + mode (naive = raw logs in prompt, airlock = scanned/cleaned). Returns structured JSON via tool calling: severity, confidence, chain steps (with stage + ATT&CK IDs), technique IDs, summary, playbook.
3. **run-benchmark** — creates a run, processes payloads in small batches (client drives batches for progress and to avoid timeouts), runs triage in both modes, judges success deterministically against the canary (severity lowered to target, or canary string present in output), stores results with timestamp and model, then computes ASR naive vs airlock, detection rate, FP rate on the benign set.

## Technical details
- TanStack Start server functions (`createServerFn`) for the three functions rather than standalone edge functions (the platform's equivalent; same names/behavior). Batched benchmark endpoint: `startRun`, `runBatch(runId, offset)`, `finalizeRun`.
- AI via Lovable AI Gateway, default model google/gemini-3-flash-preview; model name stored per run. Handle 429/402 with friendly messages.
- Data loading with TanStack Query; recharts for the chart; sonner toasts.
- Unit tests for the rule layer and canary judging (e.g. base64 override detected, "CANARY-7731" in output = success, benign line not flagged).
- Per-route head() metadata.
