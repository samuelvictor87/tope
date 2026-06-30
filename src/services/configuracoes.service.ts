// services/configuracoes.service.ts — TOPE
import { supabase } from '../lib/supabase';
import type {
  ConfiguracaoLocacao,
  ConfiguracaoLocacaoPayload,
  TaxaFinanciamento,
  TaxaFinanciamentoPayload,
  DepreciacaoCaminhao,
  DepreciacaoCaminhaoPayload,
  DepreciacaoImplemento,
  DepreciacaoImplementoPayload,
  Caminhao,
  Categoria,
} from '../types/configuracoes.types';

// ─── Configurações gerais ───────────────────────────────────

export async function buscarConfiguracoesLocacao(): Promise<ConfiguracaoLocacao | null> {
  const { data, error } = await supabase
    .from('cal_configuracoes_locacao')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('Erro ao buscar configurações de locação:', error);
    return null;
  }
  return data as ConfiguracaoLocacao;
}

export async function atualizarConfiguracoesLocacao(
  id: string,
  dados: ConfiguracaoLocacaoPayload
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('cal_configuracoes_locacao')
    .update(dados)
    .eq('id', id);

  if (error) {
    console.error('Erro ao atualizar configurações de locação:', error);
    return { error: error.message };
  }
  return { error: null };
}

// ─── Taxas de financiamento ─────────────────────────────────

export async function listarTaxasFinanciamento(): Promise<TaxaFinanciamento[]> {
  const { data, error } = await supabase
    .from('cal_taxas_financiamento')
    .select('*')
    .order('prazo', { ascending: true });

  if (error) {
    console.error('Erro ao listar taxas de financiamento:', error);
    return [];
  }
  return data as TaxaFinanciamento[];
}

export async function criarTaxaFinanciamento(
  dados: TaxaFinanciamentoPayload
): Promise<{ data: TaxaFinanciamento | null; error: string | null }> {
  const { data, error } = await supabase
    .from('cal_taxas_financiamento')
    .insert(dados)
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar taxa de financiamento:', error);
    if (error.code === '23505') {
      return { data: null, error: 'Já existe um prazo com esse valor.' };
    }
    return { data: null, error: error.message };
  }
  return { data: data as TaxaFinanciamento, error: null };
}

export async function atualizarTaxaFinanciamento(
  id: string,
  dados: Partial<TaxaFinanciamentoPayload>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('cal_taxas_financiamento')
    .update(dados)
    .eq('id', id);

  if (error) {
    console.error('Erro ao atualizar taxa de financiamento:', error);
    if (error.code === '23505') {
      return { error: 'Já existe um prazo com esse valor.' };
    }
    return { error: error.message };
  }
  return { error: null };
}

export async function excluirTaxaFinanciamento(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('cal_taxas_financiamento')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao excluir taxa de financiamento:', error);
    return { error: error.message };
  }
  return { error: null };
}

// ─── Depreciação de caminhões ───────────────────────────────

export async function listarDepreciacoesCaminhoes(): Promise<DepreciacaoCaminhao[]> {
  const { data, error } = await supabase
    .from('cal_depreciacao_caminhoes')
    .select('*, caminhoes(familia, modelo)')
    .order('prazo', { ascending: true });

  if (error) {
    console.error('Erro ao listar depreciações de caminhões:', error);
    return [];
  }
  return data as DepreciacaoCaminhao[];
}

export async function criarDepreciacaoCaminhao(
  dados: DepreciacaoCaminhaoPayload
): Promise<{ data: DepreciacaoCaminhao | null; error: string | null }> {
  const { data, error } = await supabase
    .from('cal_depreciacao_caminhoes')
    .insert(dados)
    .select('*, caminhoes(familia, modelo)')
    .single();

  if (error) {
    console.error('Erro ao criar depreciação de caminhão:', error);
    if (error.code === '23505') {
      return { data: null, error: 'Já existe uma regra para essa combinação de caminhão, prazo e tipo de uso.' };
    }
    return { data: null, error: error.message };
  }
  return { data: data as DepreciacaoCaminhao, error: null };
}

export async function atualizarDepreciacaoCaminhao(
  id: string,
  dados: Partial<DepreciacaoCaminhaoPayload>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('cal_depreciacao_caminhoes')
    .update(dados)
    .eq('id', id);

  if (error) {
    console.error('Erro ao atualizar depreciação de caminhão:', error);
    if (error.code === '23505') {
      return { error: 'Já existe uma regra para essa combinação de caminhão, prazo e tipo de uso.' };
    }
    return { error: error.message };
  }
  return { error: null };
}

export async function excluirDepreciacaoCaminhao(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('cal_depreciacao_caminhoes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao excluir depreciação de caminhão:', error);
    return { error: error.message };
  }
  return { error: null };
}

export async function listarDepreciacoesCaminhoesPaginado(
  page: number,
  limit: number
): Promise<{ data: DepreciacaoCaminhao[]; count: number; error: string | null }> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from('cal_depreciacao_caminhoes')
    .select('*, caminhoes(familia, modelo)', { count: 'exact' })
    .order('prazo', { ascending: true })
    .range(from, to);

  if (error) {
    console.error('Erro ao listar depreciações de caminhões paginado:', error);
    return { data: [], count: 0, error: error.message };
  }
  return { data: (data || []) as DepreciacaoCaminhao[], count: count || 0, error: null };
}

// ─── Depreciação de implementos ─────────────────────────────

export async function listarDepreciacoesImplementos(): Promise<DepreciacaoImplemento[]> {
  const { data, error } = await supabase
    .from('cal_depreciacao_implementos')
    .select('*, implemento_categorias(nome)')
    .order('prazo', { ascending: true });

  if (error) {
    console.error('Erro ao listar depreciações de implementos:', error);
    return [];
  }
  return data as DepreciacaoImplemento[];
}

export async function criarDepreciacaoImplemento(
  dados: DepreciacaoImplementoPayload
): Promise<{ data: DepreciacaoImplemento | null; error: string | null }> {
  const { data, error } = await supabase
    .from('cal_depreciacao_implementos')
    .insert(dados)
    .select('*, implemento_categorias(nome)')
    .single();

  if (error) {
    console.error('Erro ao criar depreciação de implemento:', error);
    if (error.code === '23505') {
      return { data: null, error: 'Já existe uma regra para essa combinação de categoria, prazo e tipo de uso.' };
    }
    return { data: null, error: error.message };
  }
  return { data: data as DepreciacaoImplemento, error: null };
}

export async function atualizarDepreciacaoImplemento(
  id: string,
  dados: Partial<DepreciacaoImplementoPayload>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('cal_depreciacao_implementos')
    .update(dados)
    .eq('id', id);

  if (error) {
    console.error('Erro ao atualizar depreciação de implemento:', error);
    if (error.code === '23505') {
      return { error: 'Já existe uma regra para essa combinação de categoria, prazo e tipo de uso.' };
    }
    return { error: error.message };
  }
  return { error: null };
}

export async function excluirDepreciacaoImplemento(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('cal_depreciacao_implementos')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao excluir depreciação de implemento:', error);
    return { error: error.message };
  }
  return { error: null };
}

export async function listarDepreciacoesImplementosPaginado(
  page: number,
  limit: number
): Promise<{ data: DepreciacaoImplemento[]; count: number; error: string | null }> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from('cal_depreciacao_implementos')
    .select('*, implemento_categorias(nome)', { count: 'exact' })
    .order('prazo', { ascending: true })
    .range(from, to);

  if (error) {
    console.error('Erro ao listar depreciações de implementos paginado:', error);
    return { data: [], count: 0, error: error.message };
  }
  return { data: (data || []) as DepreciacaoImplemento[], count: count || 0, error: null };
}

// ─── Auxiliares (dados de referência) ───────────────────────

export async function listarCaminhoes(): Promise<Caminhao[]> {
  const { data, error } = await supabase
    .from('caminhoes')
    .select('id, familia, modelo, transmissao')
    .order('familia', { ascending: true });

  if (error) {
    console.error('Erro ao listar caminhões:', error);
    return [];
  }
  return data as Caminhao[];
}

export async function listarCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase
    .from('implemento_categorias')
    .select('id, nome')
    .order('nome', { ascending: true });

  if (error) {
    console.error('Erro ao listar categorias:', error);
    return [];
  }
  return data as Categoria[];
}
