<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- LogAirlock server logic lives in `src/lib/*.functions.ts` (createServerFn), not edge functions; public reads use a publishable client restricted to explicit synthetic demo publications — why: server transport is not an authorization boundary and operational tables must remain private.
- Benchmark numbers are only ever read from stored `benchmark_runs`/`benchmark_results` — why: honesty rule, never hardcode results.
- Overview uses a separate read-only proof function querying the latest run per suite and the existing metric calculator — why: avoid changing benchmark execution or losing a suite behind run-history limits.
- Shared shell and CSS own navigation and interface typography; reserve monospace for technical evidence — why: keep pages consistent without modifying processing logic.
- Presentation content and scaling live in `src/components/presentation`; the presentation route reuses read-only overview proof — why: keep the deck consistent and benchmark claims tied to stored results.
- Every mutation and AI entry point uses `requireOperator`; role assignment is out-of-band and never automatic on signup — why: authentication alone must not grant operational permissions.
- Usage admission and audit-linked approval/value changes are atomic database functions; benchmark mutations require the run owner — why: stateless workers cannot safely enforce shared counters or ownership in browser controls.
- Public demo publications contain only fixed seeded alert IDs and explicit synthetic benchmark runs; never publish imported operational records — why: adding real data must not widen anonymous access.
