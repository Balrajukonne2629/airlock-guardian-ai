# LogAirlock

**Triage alerts. Never take orders from logs.**

Live demo: https://airlock-guardian-ai.lovable.app/

LogAirlock is an AI SOC triage prototype. AI triage agents read text an attacker controls: user-agents, URLs, usernames, email bodies. Hidden instructions in that text can hijack the agent. LogAirlock scans every untrusted field before the agent sees it, and measures how well that works.

Built for Mitigata CyberForge (AI &amp; Cybersecurity).

## How it works

1. **Layer 1, rules.** Pattern checks for override phrases, fake system tags, base64 blobs, invisible characters, tool-call imitation and multilingual overrides.
2. **Layer 2, AI classifier.** Labels each field clean, suspicious or injection, with a reason.
3. **Quarantine.** Injected text becomes `[QUARANTINED]`. The rest goes to the agent inside `<quoted_evidence>` tags as data only.
4. **Triage.** The agent returns severity, an attack chain with MITRE ATT&amp;CK tags, a manager summary and a response playbook. A human approves. Nothing executes.
5. **Fail closed.** If the AI classifier is unavailable, text is marked Unverified and counted separately. It is never treated as clean.

The risk figure is an illustrative estimate: `Exposure ₹ = Asset Value × Likelihood × Stage Factor`. Compliance tags (CERT-In, DPDP Act, ISO 27001) are "may apply" mappings.

## Pages

| Page | What it does |
|---|---|
| Overview | Problem, pipeline, latest stored Quick and Held-out results, limits |
| Alerts | 10 synthetic alerts, 3 with planted injections |
| Incident | Naive vs Airlock triage side by side, risk estimate, approve (recorded only) |
| Lab | Paste any log text and watch both layers decide. Guests get limited runs |
| Benchmark | Quick, Full and Held-out suites against both modes |
| Deck | Built-in presentation |

## Benchmark method

- Both modes use the same model, task and output schema. The only difference is the Airlock.
- Each attack carries a planted goal (a canary). A deterministic judge with no AI scores whether the agent obeyed it.
- Benign lines are scanned only, to measure false positives.
- All numbers are read from stored runs, never typed in. See the Benchmark page.

## Limits

- Small samples, one model per run, not a guarantee of real-world detection.
- Rules were written with knowledge of the seeded payloads.
- One Layer 1 rule matches the benchmark's own canary token, so detection on canary-bearing payloads is optimistic. The Held-out result is the fairer figure, and it carries the same caveat.
- All alerts, payloads and logs are synthetic. No real systems were tested.

## Access

Visitors get a read-only demo of stored results, plus a rate-limited guest Lab. Running triage, benchmarks, approvals and value edits needs an approved operator account. Guest AI calls have a daily budget and an operator kill switch.

## Stack

TanStack Start (React), Lovable Cloud (Supabase), Lovable AI Gateway with `google/gemini-3-flash-preview` by default, Recharts.

## Run tests

```
bun install
bunx vitest run
```

## Disclosure

Built with Lovable. AI calls go through the Lovable AI Gateway. All data is self-written synthetic data.
