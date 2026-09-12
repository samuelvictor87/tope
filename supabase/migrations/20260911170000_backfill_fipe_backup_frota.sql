-- Colunas de rastreio do vínculo FIPE em massa
ALTER TABLE public.frota_veiculos
  ADD COLUMN IF NOT EXISTS fipe_vinculo_status text,
  ADD COLUMN IF NOT EXISTS fipe_vinculo_erro text,
  ADD COLUMN IF NOT EXISTS fipe_vinculo_em timestamptz;

COMMENT ON COLUMN public.frota_veiculos.fipe_vinculo_status IS 'pendente | automatico | falha — controle do vínculo FIPE em massa';
COMMENT ON COLUMN public.frota_veiculos.fipe_vinculo_erro IS 'Motivo curto quando fipe_vinculo_status = falha';
COMMENT ON COLUMN public.frota_veiculos.fipe_vinculo_em IS 'Timestamp da última tentativa de vínculo FIPE';

-- Backfill backup_* a partir do catálogo caminhoes (quando houver caminhao_id)
UPDATE public.frota_veiculos v
SET
  backup_marca = COALESCE(v.backup_marca, v.marca, c.marca),
  backup_modelo_texto = COALESCE(
    v.backup_modelo_texto,
    v.modelo_texto,
    NULLIF(TRIM(CONCAT_WS(' ', c.familia, c.modelo)), '')
  ),
  backup_ano_modelo = COALESCE(v.backup_ano_modelo, v.ano_modelo, v.ano_fabricacao),
  backup_caminhao_id = COALESCE(v.backup_caminhao_id, v.caminhao_id)
FROM public.caminhoes c
WHERE c.id = v.caminhao_id
  AND v.fipe_codigo IS NULL
  AND v.backup_marca IS NULL
  AND v.backup_modelo_texto IS NULL
  AND v.backup_caminhao_id IS NULL;

-- Backfill backup_* a partir dos campos vivos (planilha / texto livre)
UPDATE public.frota_veiculos v
SET
  backup_marca = COALESCE(v.backup_marca, v.marca),
  backup_modelo_texto = COALESCE(v.backup_modelo_texto, v.modelo_texto),
  backup_ano_modelo = COALESCE(v.backup_ano_modelo, v.ano_modelo, v.ano_fabricacao),
  backup_caminhao_id = COALESCE(v.backup_caminhao_id, v.caminhao_id)
WHERE v.fipe_codigo IS NULL
  AND v.backup_marca IS NULL
  AND v.backup_modelo_texto IS NULL
  AND v.backup_caminhao_id IS NULL
  AND (
    v.marca IS NOT NULL
    OR v.modelo_texto IS NOT NULL
    OR v.caminhao_id IS NOT NULL
    OR v.ano_modelo IS NOT NULL
    OR v.ano_fabricacao IS NOT NULL
  );

-- Marcar pendentes para o script de vínculo em massa
UPDATE public.frota_veiculos
SET fipe_vinculo_status = 'pendente'
WHERE fipe_codigo IS NULL
  AND fipe_vinculo_status IS NULL
  AND (backup_modelo_texto IS NOT NULL OR backup_caminhao_id IS NOT NULL);
