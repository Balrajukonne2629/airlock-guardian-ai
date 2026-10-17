DROP POLICY IF EXISTS "public read alerts" ON public.alerts;
DROP POLICY IF EXISTS "public read assets" ON public.assets;
DROP POLICY IF EXISTS "public read incidents" ON public.incidents;
DROP POLICY IF EXISTS "public read benchmark_payloads" ON public.benchmark_payloads;
DROP POLICY IF EXISTS "public read airlock_events" ON public.airlock_events;
DROP POLICY IF EXISTS "public read benchmark_results" ON public.benchmark_results;
DROP POLICY IF EXISTS "public read benchmark_runs" ON public.benchmark_runs;
REVOKE ALL ON public.alerts, public.assets, public.incidents, public.benchmark_payloads, public.airlock_events, public.benchmark_results, public.benchmark_runs FROM anon, authenticated;
GRANT ALL ON public.alerts, public.assets, public.incidents, public.benchmark_payloads, public.airlock_events, public.benchmark_results, public.benchmark_runs TO service_role;