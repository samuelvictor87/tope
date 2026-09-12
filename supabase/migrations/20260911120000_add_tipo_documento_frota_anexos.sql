ALTER TABLE public.frota_veiculo_anexos
  ADD COLUMN IF NOT EXISTS tipo_documento text NOT NULL DEFAULT 'outros';

ALTER TABLE public.frota_veiculo_anexos
  ALTER COLUMN tipo_documento DROP DEFAULT;
