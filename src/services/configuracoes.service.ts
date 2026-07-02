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
  TipoUsoDepreciacao,
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

const obterCacheBuster = () => {
  const ts = new Date().getTime().toString().slice(-12).padStart(12, '0');
  return `00000000-0000-4000-a000-${ts}`;
};

export async function listarDepreciacoesCaminhoes(): Promise<DepreciacaoCaminhao[]> {
  const { data, error } = await supabase
    .from('cal_depreciacao_caminhoes')
    .select('*, caminhoes(familia, modelo)')
    .neq('id', obterCacheBuster())
    .order('tipo_uso', { ascending: true });

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
      return { data: null, error: 'Já existe uma regra para essa combinação de caminhão e tipo de uso.' };
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
      return { error: 'Já existe uma regra para essa combinação de caminhão e tipo de uso.' };
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

export interface FiltrosDepreciacao {
  busca?: string;
  tipoUso?: string;
  ordenacao?: {
    coluna: string;
    direcao: 'asc' | 'desc';
  };
}

export async function listarDepreciacoesCaminhoesPaginado(
  page: number,
  limit: number,
  filtros?: FiltrosDepreciacao
): Promise<{ data: DepreciacaoCaminhao[]; count: number; error: string | null }> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // `familia` em `caminhoes` é enum — ilike não funciona em enums no PostgREST.
  // Estratégia: se houver busca, buscar os IDs de caminhoes que batem e filtrar com .in()
  let caminhaoIdsFiltrados: string[] | null = null;
  if (filtros?.busca) {
    const term = filtros.busca.toLowerCase();
    const { data: cams } = await supabase
      .from('caminhoes')
      .select('id, familia, modelo')
      .limit(500);

    caminhaoIdsFiltrados = (cams || [])
      .filter((c: any) =>
        c.familia?.toLowerCase().includes(term) ||
        c.modelo?.toLowerCase().includes(term)
      )
      .map((c: any) => c.id);
  }

  let query = supabase
    .from('cal_depreciacao_caminhoes')
    .select('*, caminhoes(familia, modelo)', { count: 'exact' })
    .neq('id', obterCacheBuster());

  // Filtro por IDs de caminhão (busca textual)
  if (caminhaoIdsFiltrados !== null) {
    if (caminhaoIdsFiltrados.length === 0) {
      // Nenhum caminhão bate com a busca — retorna vazio
      return { data: [], count: 0, error: null };
    }
    query = query.in('caminhao_id', caminhaoIdsFiltrados);
  }

  // Filtro por tipo de uso
  if (filtros?.tipoUso) {
    query = query.eq('tipo_uso', filtros.tipoUso);
  }

  // Ordenação
  if (filtros?.ordenacao?.coluna) {
    const { coluna, direcao } = filtros.ordenacao;
    const ascending = direcao === 'asc';
    if (coluna === 'familia' || coluna === 'modelo') {
      query = query.order(coluna, { referencedTable: 'caminhoes', ascending });
    } else {
      query = query.order(coluna, { ascending });
    }
  } else {
    query = query.order('tipo_uso', { ascending: true });
  }

  const { data, error, count } = await query.range(from, to);

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
    .order('tipo_uso', { ascending: true });

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
      return { data: null, error: 'Já existe uma regra para essa combinação de categoria e tipo de uso.' };
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
      return { error: 'Já existe uma regra para essa combinação de categoria e tipo de uso.' };
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

export interface FiltrosDepreciacaoImplemento {
  busca?: string;
  tipoUso?: string;
  ordenacao?: {
    coluna: string;
    direcao: 'asc' | 'desc';
  };
}

export async function listarDepreciacoesImplementosPaginado(
  page: number,
  limit: number,
  filtros?: FiltrosDepreciacaoImplemento
): Promise<{ data: DepreciacaoImplemento[]; count: number; error: string | null }> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const selectQuery = filtros?.busca 
    ? '*, implemento_categorias!inner(nome)' 
    : '*, implemento_categorias(nome)';

  let query = supabase
    .from('cal_depreciacao_implementos')
    .select(selectQuery, { count: 'exact' })
    .neq('id', obterCacheBuster());

  // Filtro por tipo de uso
  if (filtros?.tipoUso) {
    query = query.eq('tipo_uso', filtros.tipoUso);
  }

  // Filtro por busca textual (nome da categoria do implemento)
  if (filtros?.busca) {
    query = query.ilike('implemento_categorias.nome', `%${filtros.busca}%`);
  }

  // Ordenação
  if (filtros?.ordenacao?.coluna) {
    const { coluna, direcao } = filtros.ordenacao;
    const ascending = direcao === 'asc';

    if (coluna === 'categoria') {
      query = query.order('nome', { referencedTable: 'implemento_categorias', ascending });
    } else {
      query = query.order(coluna, { ascending });
    }
  } else {
    query = query.order('tipo_uso', { ascending: true });
  }

  const { data, error, count } = await query.range(from, to);

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

export async function buscarDepreciacaoCaminhao(
  caminhaoId: string,
  tipoUso: TipoUsoDepreciacao
): Promise<DepreciacaoCaminhao | null> {
  const { data, error } = await supabase
    .from('cal_depreciacao_caminhoes')
    .select('*, caminhoes(id, modelo, familia)')
    .eq('caminhao_id', caminhaoId)
    .eq('tipo_uso', tipoUso)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar depreciação do caminhão:', error);
    return null;
  }
  return data as DepreciacaoCaminhao;
}

export async function buscarDepreciacaoImplemento(
  categoriaId: string,
  tipoUso: TipoUsoDepreciacao
): Promise<DepreciacaoImplemento | null> {
  const { data, error } = await supabase
    .from('cal_depreciacao_implementos')
    .select('*, implemento_categorias(nome)')
    .eq('categoria_id', categoriaId)
    .eq('tipo_uso', tipoUso)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar depreciação do implemento:', error);
    return null;
  }
  return data as DepreciacaoImplemento;
}
