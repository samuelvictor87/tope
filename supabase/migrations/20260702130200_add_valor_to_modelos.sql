-- Migração: Adicionar campo valor na tabela modelos
-- Caminho: supabase/migrations/20260702130200_add_valor_to_modelos.sql
-- Contexto: Campo de valor monetário do modelo de implemento.

ALTER TABLE public.modelos ADD COLUMN IF NOT EXISTS valor numeric(15,2) NULL;
