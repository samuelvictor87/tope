-- Invoca fipe-vinculo-massa via pg_net (para MCP execute_sql / service role)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.run_fipe_vinculo_massa(
  p_dry_run boolean DEFAULT true,
  p_limit integer DEFAULT 0,
  p_batch_size integer DEFAULT 40
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_request_id bigint;
  v_project_url text := 'https://ogtwxynlynrvffjdkpir.supabase.co';
BEGIN
  SELECT net.http_post(
    url := v_project_url || '/functions/v1/fipe-vinculo-massa',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Fipe-Batch-Key', 'tope-fipe-batch-internal'
    ),
    body := jsonb_build_object(
      'dry_run', p_dry_run,
      'limit', p_limit,
      'batch_size', p_batch_size
    ),
    timeout_milliseconds := 150000
  ) INTO v_request_id;
  RETURN v_request_id;
END;
$$;

COMMENT ON FUNCTION public.run_fipe_vinculo_massa IS
  'Dispara vínculo FIPE em massa (Edge Function). Use com MCP execute_sql. limit=0 processa todos os grupos pendentes na chamada.';

REVOKE ALL ON FUNCTION public.run_fipe_vinculo_massa(boolean, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_fipe_vinculo_massa(boolean, integer, integer) TO postgres, service_role;
