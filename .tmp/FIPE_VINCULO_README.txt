Vínculo FIPE em massa — como executar
=====================================

Pré-requisitos
- Migration aplicada: 20260911170000_backfill_fipe_backup_frota.sql
- 1264 veículos com backup_* e status pendente

Opção A — MCP Supabase (execute_sql, sem service role local)
------------------------------------------------------------
Migration: 20260911180000_fipe_vinculo_massa_pgnet.sql
Função: public.run_fipe_vinculo_massa(dry_run, limit, batch_size)

Ver quantos faltam (a qualquer momento):
  SELECT public.fipe_vinculo_resumo();

Apply em lotes (retorna faltam + request_id):
  SELECT public.run_fipe_vinculo_massa(false, 20, 40);

Depois de ~60s, ver resultado + faltam atualizado:
  SELECT public.fipe_vinculo_resultado(<request_id>);
  -- ex.: SELECT public.fipe_vinculo_resultado(19);

Nota: erro 429 (rate limit) volta para pendente automaticamente.

Auth interna: header X-Fipe-Batch-Key (não expõe service role no cliente).

Opção B — Edge Function HTTP (service role)
-------------------------------------------
POST https://ogtwxynlynrvffjdkpir.supabase.co/functions/v1/fipe-vinculo-massa
Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
  OU header X-Fipe-Batch-Key: tope-fipe-batch-internal
Content-Type: application/json

Dry-run (20 grupos):
{"dry_run": true, "limit": 20, "batch_size": 40}

Aplicar em lotes:
{"dry_run": false, "limit": 20, "batch_size": 40}

Opção C — Script Python local
-----------------------------
Defina no .env.local:
  SUPABASE_URL=https://ogtwxynlynrvffjdkpir.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=...
  SUPABASE_ANON_KEY=...

Exportar pendências (já feito):
  .tmp/fipe_veiculos_pending.json

Dry-run:
  python .tmp/vinculo_fipe_massa.py --input-json .tmp/fipe_veiculos_pending.json --limit 20

Aplicar:
  python .tmp/vinculo_fipe_massa.py --input-json .tmp/fipe_veiculos_pending.json --apply --batch-size 40

Relatórios: .tmp/fipe_vinculo_report.json / .tmp/fipe_vinculo_report.txt
Cache FIPE: .tmp/fipe_match_cache.json (retomada)

Resultado apply via MCP (2026-09-11)
------------------------------------
- automatico: 743 veículos (~59%)
- falha: 521 veículos (~41%, maioria modelo_ambiguo)
- pendente: 0
Revisar falhas na aba Frota (badge "Revisar").
