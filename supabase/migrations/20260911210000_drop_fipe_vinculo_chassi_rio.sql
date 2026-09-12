-- Remove fluxo RIO Uptime (chassi) do vínculo FIPE
DROP FUNCTION IF EXISTS public.run_fipe_vinculo_chassi(boolean, integer);

ALTER TABLE public.frota_veiculos
  DROP COLUMN IF EXISTS rio_modelo,
  DROP COLUMN IF EXISTS rio_consulta_erro,
  DROP COLUMN IF EXISTS rio_consulta_em;

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
    )
  )
  FROM public.frota_veiculos;
$$;

COMMENT ON FUNCTION public.fipe_vinculo_resumo IS
  'Contagem FIPE: automaticos, pendentes, falhas, ambiguos e faltam (sem fipe_codigo).';
