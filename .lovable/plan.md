# LogAirlock: hackathon-readiness improvements

## Goal
Strengthen security, demonstrate Airlock’s incremental value, and present credible evidence. Keep the current analyst-focused design and preserve historical results. No promise of perfect protection or qualification.

## Delivery sequence
Implement in the order below. Each phase ends with tests and a real-user walkthrough, followed by a review checkpoint before the next phase. Do not describe planned controls or unrun tests as completed.

### Phase 1 — Secure access and paid AI operations
- Keep a read-only public synthetic demonstration; private operational records must not become public when real data is introduced.
- Add Google and Sign in with Lovable. New accounts have no operational permissions by default.
- Require verified identity and explicit permissions for scanning, triage, benchmarks, incident approval, and asset-value edits. Check permissions on the server, not just on buttons.
- Assign the initial owner through a trusted provisioning step; never make the first visitor an administrator or derive privileges from editable account details. If no matching owner can be established safely, request account selection rather than guessing.
- Add the approved custom stored usage safeguard: atomic per-account admission checks, one active benchmark per account, bounded input sizes and run sizes, and clear wait/blocked states. This is a custom control, not a built-in platform limiter or a monetary spending guarantee. Document initial limits and test them.
- Add actor/time/action audit records for approvals and changes; sensitive mutations and their audit records must succeed together.
- Restrict every related function, including benchmark batches and finalisation. Prevent one account from taking over another account’s run.

**Acceptance:** signed-out and unapproved accounts cannot mutate records or spend AI credits; an approved account can complete the permitted flow; public demo remains readable without exposing private records; usage and permission tests pass.

### Phase 2 — Fail-safe evidence handling
- Classifier outages and invalid responses become **unverified**, never clean. Stop protected triage on unverified evidence and require an explicit recovery attempt.
- Quarantine the whole flagged field, preserving original evidence separately with restricted access. Retain safe sibling fields.
- Treat suspicious evidence conservatively and prevent it from enabling automatic actions.
- Validate all returned triage fields against a shared schema. Show safe errors without internal provider details.
- Preserve the selected model; use the supported Lovable AI SDK for changed gateway calls and capture available usage information.

**Acceptance:** outage, invalid output, multiple instructions, encoded attacks, and safe sibling fields have concrete tests. Demonstrate a blocked/unverified case as well as a successful scan.

### Phase 3 — Fair and trustworthy benchmarks
- Add three conditions: **Naive**, **Hardened prompt only**, and **Airlock**. The latter two share task, security instructions, framing, schema, and model settings; scan/quarantine is the intended difference.
- Preserve historical two-condition results and label missing new measurements as **not recorded**. Store experiment version and relevant configuration so old and new runs cannot be mistaken for equivalent evidence.
- Improve canary judging: severity goals must represent a downgrade from the corresponding clean baseline; quoting or refusing a token is not automatically attack success. Record ambiguous judgements separately rather than forcing certainty.
- Add several alert scenarios and attacker-controlled field locations, including multi-field attacks and benign lookalikes. New self-authored cases remain labelled developer-authored, not independent.
- Triage benign cases too. Measure baseline severity preservation, output validity, and retained evidence; distinguish automated checks from human-rated usefulness.
- Record per-condition elapsed time and available token usage. Show cost only when a verifiable rate/charge is available, otherwise **not recorded**.
- Snapshot each run’s cases/configuration; use durable deduplication and batch claims. Prevent duplicate processing from inflating results, disallow changes after completion, and finalise only when every expected case is accounted for.
- Display failed, ambiguous, missing, and excluded cases alongside denominators; incomplete runs must not become headline proof.

**Acceptance:** comparison, canary, duplicate-batch, ownership, run-completion, legacy compatibility, and usefulness checks pass; one new-format run completes through the interface and reads back correctly.

### Phase 4 — One safe end-to-end response demonstration
- Add a structured recommendation and server-validated allowed-action policy.
- Flow: receive/import a synthetic alert → scan → triage → propose an allowed action → authorised analyst approval → record a sandbox action receipt.
- Reject unverified evidence, invalid targets, unsupported actions, stale approvals, and repeated execution.
- Clearly label the action as sandbox/simulated. Rename the existing approval control so it cannot imply real host isolation or SIEM execution.
- Do not contact or modify production systems. A real external integration can be added later with explicit credentials and authorisation.

**Acceptance:** demonstrate one permitted action and one rejected action, verify the receipt and audit trail through the UI, and test duplicate execution and approval permissions.

### Phase 5 — Execute and report evidence
- Run the existing Full and Held-out suites plus the new fair comparison after the controls pass. AI calls consume project credits; stop on credit/provider denial and preserve partial runs rather than retrying blindly.
- Report every stored outcome, sample size, model, experiment version, timestamp, error count, and uncertainty. Never replace an unfavourable run with invented success.
- Provide a validation/import path for externally authored cases with provenance and frozen evaluation configuration. Do not call the existing repository-visible held-out set independent validation.
- Prepare a feedback checklist for a practising SOC analyst covering evidence preservation, recommendations, and workflow usefulness.

**Acceptance:** completed measurements read back through Benchmark, Overview, and the app deck; any blocked suite remains visibly incomplete with its reason.

### Phase 6 — Submission and demo readiness
- Sharpen positioning around protecting AI-assisted SOC decisions, not generic AI filtering. Explain the user, failure prevented, differentiation, and measured value.
- Update the app deck and connected Google Slides copy with current stored evidence, new controls, working-versus-planned distinctions, and honest limitations.
- Prepare a reproducible demo sequence and backup recording covering normal evidence, injection, outage handling, and approved sandbox action.
- Run regression tests and end-to-end checks on public and authorised flows; inspect desktop and narrow-screen layouts and automatic build diagnostics.

**Acceptance:** presentation claims match implemented capabilities and stored evidence; demo and controls work without relying on prepared success-only examples.

## Technical approach
- Retain TanStack server functions in `src/lib`; shared server-only authorisation and audit helpers protect all entry points.
- Use generated authenticated clients with scoped policies for ordinary operational reads/writes; privileged access requires verified permissions first.
- Expose only separate, explicitly public synthetic projections through a narrowly scoped publishable read path. Do not restore broad public policies on the seven original tables.
- Add roles, audit/usage admission, run ownership/versioning, condition results, and sandbox receipts through additive migrations with grants and RLS. Keep existing rows and legacy columns.
- Use database transactions/functions for atomic usage admission, audit-linked mutations, batch claims, and execution deduplication; no in-memory worker counters.
- Add focused tests beside existing tests for each permission, safety, and measurement rule. Keep architectural decisions in `AGENTS.md` and the phase checklist in `roadmap.md` current.

## External dependencies and limits
- Independent attack authorship and practising analyst feedback require real external participants; neither can be fabricated by another AI agent.
- Organisers must confirm pre-existing-code and AI-assisted-development rules. Their public information does not settle these points.
- Owner provisioning may require your account selection. AI credit availability may block full evaluation.
- A sandbox receipt is not a real security-platform response. No certification, measured financial savings, production readiness, or guaranteed qualification is claimed.