-- Migração: Remover tabela opcoes_atributos (Opções de Atributos de Implementos)
-- Caminho: supabase/migrations/20260702123000_drop_opcoes_atributos.sql
-- Contexto: A funcionalidade de "Opções" foi removida do módulo de Implementos.
--           Os itens de cotação agora armazenam apenas Categoria + Atributos, sem opcao_id.

-- Remove coluna opcoes_selecionadas de cotacao_itens (opcional — pode manter para compatibilidade)
-- ALTER TABLE public.cotacao_itens DROP COLUMN IF EXISTS opcoes_selecionadas;

-- Remove a tabela opcoes_atributos e todas as dependências
DROP TABLE IF EXISTS public.opcoes_atributos CASCADE;
