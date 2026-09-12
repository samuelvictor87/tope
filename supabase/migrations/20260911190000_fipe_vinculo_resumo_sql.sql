-- Rate limit 429 volta para pendente (retentável)
UPDATE public.frota_veiculos
SET
  fipe_vinculo_status = 'pendente',
  fipe_vinculo_erro = NULL,
  fipe_vinculo_em = NULL
WHERE fipe_vinculo_status = 'falha'
  AND fipe_vinculo_erro LIKE '%429%';

-- Resumo rápido do progresso
CREATE OR REPLACE FUNCTION public.fipe_vinculo_resumo()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'automaticos', count(*) FILTER (WHERE fipe_vinculo_status = 'automatico'),
    'pendentes', count(*) FILTER (WHERE fipe_vinculo_status = 'pendente' AND fipe_codigo IS NULL),
    'falhas', count(*) FILTER (WHERE fipe_vinculo_status = 'falha' AND fipe_codigo IS NULL),
    'faltam', count(*) FILTER (
      WHERE fipe_codigo IS NULL
        AND fipe_vinculo_status IN ('pendente', 'falha')
    )
  )
  FROM public.frota_veiculos;
$$;

COMMENT ON FUNCTION public.fipe_vinculo_resumo IS
  'Contagem de veículos FIPE: automaticos, pendentes, falhas e faltam (sem fipe_codigo).';

-- Resultado de uma execução pg_net + resumo atualizado
CREATE OR REPLACE FUNCTION public.fipe_vinculo_resultado(p_request_id bigint)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'request_id', r.id,
    'status_code', r.status_code,
    'error_msg', r.error_msg,
    'resposta', CASE WHEN r.content IS NOT NULL THEN r.content::jsonb END,
    'resumo_atual', public.fipe_vinculo_resumo()
  )
  FROM net._http_response r
  WHERE r.id = p_request_id;
$$;

COMMENT ON FUNCTION public.fipe_vinculo_resultado IS
  'Lê resposta HTTP do pg_net e inclui resumo atual de faltam/pendentes/falhas.';

-- run_fipe_vinculo_massa agora retorna jsonb com request_id + quantos faltam
DROP FUNCTION IF EXISTS public.run_fipe_vinculo_massa(boolean, integer, integer);

CREATE OR REPLACE FUNCTION public.run_fipe_vinculo_massa(
  p_dry_run boolean DEFAULT true,
  p_limit integer DEFAULT 0,
  p_batch_size integer DEFAULT 40
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_request_id bigint;
  v_project_url text := 'https://ogtwxynlynrvffjdkpir.supabase.co';
  v_resumo jsonb;
BEGIN
  v_resumo := public.fipe_vinculo_resumo();

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

  RETURN v_resumo || jsonb_build_object(
    'request_id', v_request_id,
    'dry_run', p_dry_run,
    'limit', p_limit,
    'batch_size', p_batch_size,
    'proximo_passo', format(
      'Aguarde ~60s e rode: SELECT public.fipe_vinculo_resultado(%s);',
      v_request_id
    )
  );
END;
$$;

COMMENT ON FUNCTION public.run_fipe_vinculo_massa IS
  'Dispara vínculo FIPE em massa. Retorna request_id + faltam/pendentes/falhas antes da execução.';

REVOKE ALL ON FUNCTION public.fipe_vinculo_resumo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fipe_vinculo_resumo() TO postgres, service_role, authenticated;

REVOKE ALL ON FUNCTION public.fipe_vinculo_resultado(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fipe_vinculo_resultado(bigint) TO postgres, service_role, authenticated;

REVOKE ALL ON FUNCTION public.run_fipe_vinculo_massa(boolean, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_fipe_vinculo_massa(boolean, integer, integer) TO postgres, service_role;
