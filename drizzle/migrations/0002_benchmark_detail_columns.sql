alter table public.benchmark_results
  add column status text not null default 'ok',
  add column naive_confidence numeric,
  add column airlock_confidence numeric,
  add column matched_rules jsonb,
  add column layer2_reason text;
alter table public.benchmark_runs
  add column baseline_severity text,
  add column baseline_error text;