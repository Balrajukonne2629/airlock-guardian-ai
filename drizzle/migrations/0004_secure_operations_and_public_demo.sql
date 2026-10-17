CREATE TABLE public.user_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('admin','operator')), UNIQUE(user_id,role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own assigned roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE FUNCTION public.is_logairlock_operator() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','operator'));
$$;
REVOKE ALL ON FUNCTION public.is_logairlock_operator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_logairlock_operator() TO authenticated, service_role;
CREATE TABLE public.operation_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL, action text NOT NULL,
 target text NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.operation_audit TO authenticated;
GRANT ALL ON public.operation_audit TO service_role;
ALTER TABLE public.operation_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operators read audit" ON public.operation_audit FOR SELECT TO authenticated USING (public.is_logairlock_operator());
CREATE TABLE public.ai_usage_windows (
 user_id uuid NOT NULL, window_kind text NOT NULL CHECK(window_kind IN ('minute','day')), window_start timestamptz NOT NULL,
 reserved_calls integer NOT NULL DEFAULT 0, PRIMARY KEY(user_id,window_kind,window_start)
);
GRANT SELECT ON public.ai_usage_windows TO authenticated;
GRANT ALL ON public.ai_usage_windows TO service_role;
ALTER TABLE public.ai_usage_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own usage" ON public.ai_usage_windows FOR SELECT TO authenticated USING(user_id = auth.uid());
ALTER TABLE public.benchmark_runs ADD COLUMN owner_id uuid;
ALTER TABLE public.benchmark_runs ADD COLUMN public_demo boolean NOT NULL DEFAULT false;
UPDATE public.benchmark_runs SET public_demo = true WHERE owner_id IS NULL;
GRANT SELECT ON public.alerts,public.assets,public.incidents,public.airlock_events,public.benchmark_payloads,public.benchmark_runs,public.benchmark_results TO authenticated;
CREATE POLICY "Operator alerts read" ON public.alerts FOR SELECT TO authenticated USING(public.is_logairlock_operator());
CREATE POLICY "Operator assets read" ON public.assets FOR SELECT TO authenticated USING(public.is_logairlock_operator());
CREATE POLICY "Operator incidents read" ON public.incidents FOR SELECT TO authenticated USING(public.is_logairlock_operator());
CREATE POLICY "Operator events read" ON public.airlock_events FOR SELECT TO authenticated USING(public.is_logairlock_operator());
CREATE POLICY "Operator payloads read" ON public.benchmark_payloads FOR SELECT TO authenticated USING(public.is_logairlock_operator());
CREATE POLICY "Operator runs read" ON public.benchmark_runs FOR SELECT TO authenticated USING(public.is_logairlock_operator());
CREATE POLICY "Operator results read" ON public.benchmark_results FOR SELECT TO authenticated USING(public.is_logairlock_operator());
CREATE TABLE public.demo_publications (
 key text PRIMARY KEY CHECK(key IN ('alerts','incidents','presets','runs')), payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.demo_publications TO anon, authenticated;
GRANT ALL ON public.demo_publications TO service_role;
ALTER TABLE public.demo_publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read explicit demo publications" ON public.demo_publications FOR SELECT TO anon, authenticated USING(key IN ('alerts','incidents','presets','runs'));
CREATE FUNCTION public.refresh_demo_publications() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 INSERT INTO public.demo_publications(key,payload) VALUES
 ('alerts',COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.occurred_at DESC) FROM (SELECT a.id,a.occurred_at,a.source_ip,a.alert_type,a.severity,a.status,a.poisoned,a.airlock_status,jsonb_build_object('id',s.id,'name',s.name,'asset_value',s.asset_value) AS asset FROM public.alerts a JOIN public.assets s ON s.id=a.asset_id WHERE a.id IN ('ALT-1001','ALT-1002','ALT-1003','ALT-1004','ALT-1005','ALT-1006','ALT-1007','ALT-1008','ALT-1009','ALT-1010')) x),'[]'::jsonb)),
 ('incidents',COALESCE((SELECT jsonb_agg(jsonb_build_object('alert',to_jsonb(a)||jsonb_build_object('asset',to_jsonb(s)),'incident',CASE WHEN i.id IS NULL THEN NULL ELSE to_jsonb(i)||jsonb_build_object('naive_output',CASE WHEN i.naive_output->>'ok'='false' THEN '{"ok":false,"error":"Triage unavailable"}'::jsonb ELSE i.naive_output END,'airlock_output',CASE WHEN i.airlock_output->>'ok'='false' THEN '{"ok":false,"error":"Triage unavailable"}'::jsonb ELSE i.airlock_output END) END)) FROM public.alerts a JOIN public.assets s ON s.id=a.asset_id LEFT JOIN public.incidents i ON i.alert_id=a.id WHERE a.id IN ('ALT-1001','ALT-1002','ALT-1003','ALT-1004','ALT-1005','ALT-1006','ALT-1007','ALT-1008','ALT-1009','ALT-1010')),'[]'::jsonb)),
 ('presets',COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM public.benchmark_payloads p WHERE p.id IN ('A-UA-1','A-FS-2','A-B64-1','A-ML-2','A-TC-1','A-EX-1','B-06','B-07')),'[]'::jsonb)),
 ('runs',COALESCE((SELECT jsonb_agg(jsonb_build_object('run',to_jsonb(r)-'owner_id'-'baseline_error','results',COALESCE((SELECT jsonb_agg(to_jsonb(z)-'error'-'layer2_reason') FROM public.benchmark_results z WHERE z.run_id=r.id),'[]'::jsonb)) ORDER BY r.started_at DESC) FROM public.benchmark_runs r WHERE r.public_demo),'[]'::jsonb))
 ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,updated_at=now();
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_demo_publications() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_demo_publications() TO service_role;
DO $$ BEGIN PERFORM public.refresh_demo_publications(); END $$;
CREATE FUNCTION public.reserve_ai_usage(p_calls integer,p_action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid := auth.uid(); w timestamptz; k text; used integer; cap integer;
BEGIN
 IF u IS NULL OR NOT public.is_logairlock_operator() THEN RAISE EXCEPTION 'Operator approval required'; END IF;
 IF p_calls < 1 OR p_calls > 120 THEN RAISE EXCEPTION 'Invalid reservation'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 FOREACH k IN ARRAY ARRAY['minute','day'] LOOP
 w := date_trunc(k,now()); cap := CASE k WHEN 'minute' THEN 120 ELSE 1200 END;
 INSERT INTO public.ai_usage_windows(user_id,window_kind,window_start) VALUES(u,k,w) ON CONFLICT DO NOTHING;
 SELECT reserved_calls INTO used FROM public.ai_usage_windows WHERE user_id=u AND window_kind=k AND window_start=w FOR UPDATE;
 IF used+p_calls > cap THEN RAISE EXCEPTION 'AI usage safeguard reached; wait for the next % window',k; END IF;
 UPDATE public.ai_usage_windows SET reserved_calls=reserved_calls+p_calls WHERE user_id=u AND window_kind=k AND window_start=w;
 END LOOP;
 INSERT INTO public.operation_audit(actor_id,action,target,details) VALUES(u,'ai.admitted',p_action,jsonb_build_object('reserved_calls',p_calls));
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_ai_usage(integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(integer,text) TO authenticated;
CREATE FUNCTION public.create_owned_benchmark(p_suite text,p_model text,p_size integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE u uuid:=auth.uid(); rid uuid;
BEGIN
 IF u IS NULL OR NOT public.is_logairlock_operator() THEN RAISE EXCEPTION 'Operator approval required'; END IF;
 IF p_suite NOT IN ('quick','full','heldout') OR p_size < 1 OR p_size > 80 OR p_model NOT IN ('google/gemini-3-flash-preview','google/gemini-3.1-flash-lite','google/gemini-3.8-flash') THEN RAISE EXCEPTION 'Invalid benchmark'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text,0));
 IF EXISTS(SELECT 1 FROM public.benchmark_runs WHERE owner_id=u AND status='running') THEN RAISE EXCEPTION 'Finish or stop your active benchmark first'; END IF;
 INSERT INTO public.benchmark_runs(suite_type,model,sample_size,owner_id,public_demo) VALUES(p_suite,p_model,p_size,u,true) RETURNING id INTO rid;
 INSERT INTO public.operation_audit(actor_id,action,target) VALUES(u,'benchmark.started',rid::text);
 RETURN rid;
END;
$$;
REVOKE ALL ON FUNCTION public.create_owned_benchmark(text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_owned_benchmark(text,text,integer) TO authenticated;
CREATE FUNCTION public.approve_incident_audited(p_id text) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE t timestamptz:=now(); i public.incidents;
BEGIN
 IF NOT public.is_logairlock_operator() THEN RAISE EXCEPTION 'Operator approval required'; END IF;
 SELECT * INTO i FROM public.incidents WHERE alert_id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Incident not found'; END IF;
 IF i.airlock_output->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Successful Airlock triage required'; END IF;
 IF i.status='Approved' THEN RETURN i.approved_at; END IF;
 UPDATE public.incidents SET status='Approved',approved_at=t WHERE alert_id=p_id;
 UPDATE public.alerts SET status='Approved' WHERE id=p_id;
 INSERT INTO public.operation_audit(actor_id,action,target,details) VALUES(auth.uid(),'incident.approved',p_id,jsonb_build_object('previous_status',i.status,'scope','recommendation only; no execution'));
 RETURN t;
END;
$$;
REVOKE ALL ON FUNCTION public.approve_incident_audited(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_incident_audited(text) TO authenticated;
CREATE FUNCTION public.update_asset_value_audited(p_id text,p_value numeric) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_value numeric;
BEGIN
 IF NOT public.is_logairlock_operator() THEN RAISE EXCEPTION 'Operator approval required'; END IF;
 IF p_value IS NULL OR p_value<0 OR p_value>1000000000000 OR p_value::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid asset value'; END IF;
 SELECT asset_value INTO old_value FROM public.assets WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Asset not found'; END IF;
 UPDATE public.assets SET asset_value=p_value WHERE id=p_id;
 INSERT INTO public.operation_audit(actor_id,action,target,details) VALUES(auth.uid(),'asset.value_changed',p_id,jsonb_build_object('before',old_value,'after',p_value));
END;
$$;
REVOKE ALL ON FUNCTION public.update_asset_value_audited(text,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_asset_value_audited(text,numeric) TO authenticated;