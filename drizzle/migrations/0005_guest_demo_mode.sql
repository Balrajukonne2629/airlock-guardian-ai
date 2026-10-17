ALTER TABLE public.airlock_events ADD COLUMN IF NOT EXISTS guest boolean NOT NULL DEFAULT false;
ALTER TABLE public.airlock_events ADD COLUMN IF NOT EXISTS visitor_hash text;

CREATE TABLE public.guest_settings (id boolean PRIMARY KEY DEFAULT true CHECK (id), ai_enabled boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid);
GRANT SELECT ON public.guest_settings TO authenticated;
GRANT ALL ON public.guest_settings TO service_role;
ALTER TABLE public.guest_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators read guest settings" ON public.guest_settings FOR SELECT TO authenticated USING (public.is_logairlock_operator());
INSERT INTO public.guest_settings(id, ai_enabled) VALUES (true, true) ON CONFLICT DO NOTHING;

CREATE TABLE public.guest_usage (visitor_key text NOT NULL, window_start timestamptz NOT NULL, runs integer NOT NULL DEFAULT 0, PRIMARY KEY (visitor_key, window_start));
GRANT ALL ON public.guest_usage TO service_role;
ALTER TABLE public.guest_usage ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.guest_budget (day date PRIMARY KEY, calls integer NOT NULL DEFAULT 0);
GRANT ALL ON public.guest_budget TO service_role;
ALTER TABLE public.guest_budget ENABLE ROW LEVEL SECURITY;

-- Atomic guest admission. Called only by the server with service_role.
CREATE OR REPLACE FUNCTION public.admit_guest_run(p_ip_key text, p_token_key text, p_calls integer, p_max_runs integer, p_daily_calls integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE w timestamptz := date_trunc('hour', now()); d date := (now() AT TIME ZONE 'Asia/Kolkata')::date; ipr int; tkr int; used int; en boolean;
BEGIN
 SELECT ai_enabled INTO en FROM public.guest_settings WHERE id;
 PERFORM pg_advisory_xact_lock(hashtextextended('guest-budget',0));
 SELECT COALESCE((SELECT runs FROM public.guest_usage WHERE visitor_key=p_ip_key AND window_start=w),0) INTO ipr;
 SELECT COALESCE((SELECT runs FROM public.guest_usage WHERE visitor_key=p_token_key AND window_start=w),0) INTO tkr;
 SELECT COALESCE((SELECT calls FROM public.guest_budget WHERE day=d),0) INTO used;
 IF NOT COALESCE(en,false) THEN RETURN jsonb_build_object('admit',false,'reason','disabled','runs_used',GREATEST(ipr,tkr)); END IF;
 IF GREATEST(ipr,tkr) >= p_max_runs THEN RETURN jsonb_build_object('admit',false,'reason','hourly','runs_used',GREATEST(ipr,tkr)); END IF;
 IF used + p_calls > p_daily_calls THEN RETURN jsonb_build_object('admit',false,'reason','budget','runs_used',GREATEST(ipr,tkr)); END IF;
 INSERT INTO public.guest_usage VALUES (p_ip_key,w,1) ON CONFLICT (visitor_key,window_start) DO UPDATE SET runs=public.guest_usage.runs+1;
 IF p_token_key <> p_ip_key THEN INSERT INTO public.guest_usage VALUES (p_token_key,w,1) ON CONFLICT (visitor_key,window_start) DO UPDATE SET runs=public.guest_usage.runs+1; END IF;
 INSERT INTO public.guest_budget VALUES (d,p_calls) ON CONFLICT (day) DO UPDATE SET calls=public.guest_budget.calls+p_calls;
 RETURN jsonb_build_object('admit',true,'reason',null,'runs_used',GREATEST(ipr,tkr)+1);
END; $$;

CREATE OR REPLACE FUNCTION public.guest_status(p_ip_key text, p_token_key text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
 SELECT jsonb_build_object(
  'runs_used', GREATEST(COALESCE((SELECT runs FROM public.guest_usage WHERE visitor_key=p_ip_key AND window_start=date_trunc('hour',now())),0), COALESCE((SELECT runs FROM public.guest_usage WHERE visitor_key=p_token_key AND window_start=date_trunc('hour',now())),0)),
  'budget_used', COALESCE((SELECT calls FROM public.guest_budget WHERE day=(now() AT TIME ZONE 'Asia/Kolkata')::date),0),
  'ai_enabled', COALESCE((SELECT ai_enabled FROM public.guest_settings WHERE id),false));
$$;

REVOKE ALL ON FUNCTION public.admit_guest_run(text,text,integer,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guest_status(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admit_guest_run(text,text,integer,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.guest_status(text,text) TO service_role;

-- Kill switch: operators only, audited.
CREATE OR REPLACE FUNCTION public.set_guest_ai_enabled(p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF NOT public.is_logairlock_operator() THEN RAISE EXCEPTION 'Operator approval required'; END IF;
 UPDATE public.guest_settings SET ai_enabled=p_enabled, updated_at=now(), updated_by=auth.uid() WHERE id;
 INSERT INTO public.operation_audit(actor_id,action,target,details) VALUES(auth.uid(),'guest.ai_toggled','guest_settings',jsonb_build_object('ai_enabled',p_enabled));
END; $$;
REVOKE ALL ON FUNCTION public.set_guest_ai_enabled(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_guest_ai_enabled(boolean) TO authenticated;