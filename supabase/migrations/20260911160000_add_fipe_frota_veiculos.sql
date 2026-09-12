ALTER TABLE public.frota_veiculos
  ADD COLUMN IF NOT EXISTS tipo_veiculo text,
  ADD COLUMN IF NOT EXISTS valor_fipe numeric,
  ADD COLUMN IF NOT EXISTS fipe_codigo text,
  ADD COLUMN IF NOT EXISTS fipe_codigo_marca text,
  ADD COLUMN IF NOT EXISTS fipe_codigo_modelo text,
  ADD COLUMN IF NOT EXISTS fipe_codigo_ano text,
  ADD COLUMN IF NOT EXISTS fipe_combustivel text,
  ADD COLUMN IF NOT EXISTS fipe_mes_referencia text,
  ADD COLUMN IF NOT EXISTS backup_marca text,
  ADD COLUMN IF NOT EXISTS backup_modelo_texto text,
  ADD COLUMN IF NOT EXISTS backup_ano_modelo integer,
  ADD COLUMN IF NOT EXISTS backup_caminhao_id uuid;

COMMENT ON COLUMN public.frota_veiculos.backup_marca IS 'Snapshot do campo marca antes do vínculo FIPE';
COMMENT ON COLUMN public.frota_veiculos.backup_modelo_texto IS 'Snapshot do modelo_texto antes do vínculo FIPE';
COMMENT ON COLUMN public.frota_veiculos.backup_ano_modelo IS 'Snapshot do ano_modelo antes do vínculo FIPE';
COMMENT ON COLUMN public.frota_veiculos.backup_caminhao_id IS 'Snapshot do caminhao_id (catálogo) antes do vínculo FIPE';
COMMENT ON COLUMN public.frota_veiculos.fipe_codigo IS 'Código FIPE do modelo (CodigoFipe) para atualizar valor depois';
COMMENT ON COLUMN public.frota_veiculos.fipe_codigo_ano IS 'Código composto ano-combustível, ex. 2020-3';
