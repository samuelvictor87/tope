-- Migração: Renomear tabela atributos → modelos
-- Caminho: supabase/migrations/20260702124600_rename_atributos_to_modelos.sql
-- Contexto: O conceito de "Atributo" foi renomeado para "Modelo" em todo o sistema.

ALTER TABLE public.atributos RENAME TO modelos;
