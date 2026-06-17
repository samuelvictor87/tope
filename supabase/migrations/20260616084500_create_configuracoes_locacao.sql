-- Migração: Criar tabelas para configurações de locação
-- Caminho: supabase/migrations/20260616084500_create_configuracoes_locacao.sql

-- =========================================================================
-- 1. TABELA: configuracoes_locacao (Parâmetros Globais Singulares)
-- =========================================================================
create table if not exists public.configuracoes_locacao (
  id uuid not null default gen_random_uuid(),
  criado_em timestamp with time zone null default timezone('utc'::text, now()),
  atualizado_em timestamp with time zone null default timezone('utc'::text, now()),
  
  -- Aba: Taxas e Impostos
  comissao_venda_percentual numeric(5,2) not null default 5.80,
  imposto_venda_percentual numeric(5,2) not null default 34.00,
  
  -- Aba: Investimentos e Financiamento (Despesas Operacionais)
  documentacao_valor numeric(12,2) not null default 1000.00,
  ipva_desconto_vista_percentual numeric(5,2) not null default 3.00,
  ipva_depreciacao_percentual numeric(5,2) not null default 15.00,

  constraint configuracoes_locacao_pkey primary key (id)
);

-- Habilitar RLS
alter table public.configuracoes_locacao enable row level security;

-- Políticas de RLS
create policy "Permitir leitura de configuracoes para autenticados"
  on public.configuracoes_locacao
  for select
  to authenticated
  using (true);

create policy "Permitir escrita de configuracoes apenas para administradores"
  on public.configuracoes_locacao
  for all
  to authenticated
  using (
    exists (
      select 1 from public.usuarios 
      where usuarios.usuario_id = auth.uid() 
      and usuarios.perfil = 'administrador'
    )
  );

-- Inserir registro padrão inicial (apenas se a tabela estiver vazia)
insert into public.configuracoes_locacao (
  comissao_venda_percentual,
  imposto_venda_percentual,
  documentacao_valor,
  ipva_desconto_vista_percentual,
  ipva_depreciacao_percentual
)
select 5.80, 34.00, 1000.00, 3.00, 15.00
where not exists (select 1 from public.configuracoes_locacao);


-- =========================================================================
-- 2. TABELA: taxas_financiamento (Juros por Prazo)
-- =========================================================================
create table if not exists public.taxas_financiamento (
  id uuid not null default gen_random_uuid(),
  criado_em timestamp with time zone null default timezone('utc'::text, now()),
  prazo integer not null unique,
  juros_mensal_percentual numeric(5,2) not null default 1.01,
  
  constraint taxas_financiamento_pkey primary key (id)
);

-- Habilitar RLS
alter table public.taxas_financiamento enable row level security;

-- Políticas de RLS
create policy "Permitir leitura de taxas para autenticados"
  on public.taxas_financiamento
  for select
  to authenticated
  using (true);

create policy "Permitir escrita de taxas apenas para administradores"
  on public.taxas_financiamento
  for all
  to authenticated
  using (
    exists (
      select 1 from public.usuarios 
      where usuarios.usuario_id = auth.uid() 
      and usuarios.perfil = 'administrador'
    )
  );

-- Inserir prazos padrão com suas respectivas taxas
insert into public.taxas_financiamento (prazo, juros_mensal_percentual) values
  (12, 1.01),
  (24, 1.01),
  (36, 1.01),
  (48, 1.01),
  (60, 1.01),
  (72, 1.01),
  (84, 1.20)
on conflict (prazo) do nothing;


-- =========================================================================
-- 3. TABELA: depreciacao_caminhoes (Taxas Anuais de Depreciação por Caminhão)
-- =========================================================================
create table if not exists public.depreciacao_caminhoes (
  id uuid not null default gen_random_uuid(),
  criado_em timestamp with time zone null default timezone('utc'::text, now()),
  caminhao_id uuid not null references public.caminhoes(id) on delete cascade,
  prazo integer not null,
  tipo_uso text not null,
  depreciacao_anual_percentual numeric(5,2) not null,
  
  constraint depreciacao_caminhoes_pkey primary key (id),
  constraint depreciacao_caminhoes_unique unique (caminhao_id, prazo, tipo_uso),
  constraint depreciacao_caminhoes_tipo_uso_check check (tipo_uso in ('Severo', 'Leve/Moderado'))
);

-- Habilitar RLS
alter table public.depreciacao_caminhoes enable row level security;

-- Políticas de RLS
create policy "Permitir leitura de depreciacao caminhoes para autenticados"
  on public.depreciacao_caminhoes
  for select
  to authenticated
  using (true);

create policy "Permitir escrita de depreciacao caminhoes apenas para administradores"
  on public.depreciacao_caminhoes
  for all
  to authenticated
  using (
    exists (
      select 1 from public.usuarios 
      where usuarios.usuario_id = auth.uid() 
      and usuarios.perfil = 'administrador'
    )
  );


-- =========================================================================
-- 4. TABELA: depreciacao_implementos (Taxas Anuais de Depreciação por Categoria)
-- =========================================================================
create table if not exists public.depreciacao_implementos (
  id uuid not null default gen_random_uuid(),
  criado_em timestamp with time zone null default timezone('utc'::text, now()),
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  prazo integer not null,
  tipo_uso text not null,
  depreciacao_anual_percentual numeric(5,2) not null,
  
  constraint depreciacao_implementos_pkey primary key (id),
  constraint depreciacao_implementos_unique unique (categoria_id, prazo, tipo_uso),
  constraint depreciacao_implementos_tipo_uso_check check (tipo_uso in ('Severo', 'Leve/Moderado'))
);

-- Habilitar RLS
alter table public.depreciacao_implementos enable row level security;

-- Políticas de RLS
create policy "Permitir leitura de depreciacao implementos para autenticados"
  on public.depreciacao_implementos
  for select
  to authenticated
  using (true);

create policy "Permitir escrita de depreciacao implementos apenas para administradores"
  on public.depreciacao_implementos
  for all
  to authenticated
  using (
    exists (
      select 1 from public.usuarios 
      where usuarios.usuario_id = auth.uid() 
      and usuarios.perfil = 'administrador'
    )
  );
