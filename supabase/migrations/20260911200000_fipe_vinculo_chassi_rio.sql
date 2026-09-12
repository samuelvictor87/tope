ALTER TABLE public.frota_veiculos
  ADD COLUMN IF NOT EXISTS rio_modelo text,
  ADD COLUMN IF NOT EXISTS rio_consulta_erro text,
  ADD COLUMN IF NOT EXISTS rio_consulta_em timestamptz;

COMMENT ON COLUMN public.frota_veiculos.rio_modelo IS 'Modelo completo retornado pelo RIO Uptime (chassi). Não substitui backup_modelo_texto.';
COMMENT ON COLUMN public.frota_veiculos.rio_consulta_erro IS 'rio_nao_encontrado | rio_auth | rio_http_* | rio_modelo_vazio';
COMMENT ON COLUMN public.frota_veiculos.rio_consulta_em IS 'Timestamp da última consulta RIO por chassi';

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
    'ambiguos', count(*) FILTER (
      WHERE fipe_codigo IS NULL
        AND fipe_vinculo_status = 'falha'
        AND fipe_vinculo_erro = 'modelo_ambiguo'
    ),
    'faltam', count(*) FILTER (
      WHERE fipe_codigo IS NULL
        AND fipe_vinculo_status IN ('pendente', 'falha')
    ),
    'faltam_chassi', count(*) FILTER (
      WHERE fipe_codigo IS NULL
        AND nullif(trim(chassi), '') IS NOT NULL
        AND (
          fipe_vinculo_status = 'pendente'
          OR (
            fipe_vinculo_status = 'falha'
            AND fipe_vinculo_erro = 'modelo_ambiguo'
            AND rio_modelo IS NULL
          )
        )
    )
  )
  FROM public.frota_veiculos;
$$;

COMMENT ON FUNCTION public.fipe_vinculo_resumo IS
  'Contagem FIPE: automaticos, pendentes, falhas, ambiguos, faltam e faltam_chassi (fila RIO+FIPE).';

CREATE OR REPLACE FUNCTION public.run_fipe_vinculo_chassi(
  p_dry_run boolean DEFAULT true,
  p_limit integer DEFAULT 12
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_request_id bigint;
  v_project_url text := 'https://ogtwxynlynrvffjdkpir.supabase.co';
  v_resumo jsonb;
  v_limit integer := GREATEST(COALESCE(p_limit, 12), 1);
BEGIN
  v_resumo := public.fipe_vinculo_resumo();

  SELECT net.http_post(
    url := v_project_url || '/functions/v1/fipe-vinculo-chassi',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Fipe-Batch-Key', 'tope-fipe-batch-internal'
    ),
    body := jsonb_build_object(
      'dry_run', p_dry_run,
      'limit', v_limit
    ),
    timeout_milliseconds := 150000
  ) INTO v_request_id;

  RETURN v_resumo || jsonb_build_object(
    'request_id', v_request_id,
    'dry_run', p_dry_run,
    'limit', v_limit,
    'proximo_passo', format(
      'Aguarde 60-90s e rode: SELECT public.fipe_vinculo_resultado(%s);',
      v_request_id
    )
  );
END;
$$;

COMMENT ON FUNCTION public.run_fipe_vinculo_chassi IS
  'Dispara vínculo FIPE via chassi RIO. Lotes pequenos (default 12) para o SQL editor. Retorna faltam_chassi + request_id.';

REVOKE ALL ON FUNCTION public.run_fipe_vinculo_chassi(boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_fipe_vinculo_chassi(boolean, integer) TO postgres, service_role;
