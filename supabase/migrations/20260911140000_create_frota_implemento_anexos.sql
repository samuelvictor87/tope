CREATE TABLE IF NOT EXISTS public.frota_implemento_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implemento_id uuid NOT NULL REFERENCES public.frota_implementos(id) ON DELETE CASCADE,
  criado_por uuid REFERENCES auth.users(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  arquivo_nome text NOT NULL,
  arquivo_url text NOT NULL,
  arquivo_path text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  tipo_documento text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_frota_implemento_anexos_implemento_id
  ON public.frota_implemento_anexos (implemento_id);
