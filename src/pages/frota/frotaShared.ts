import { supabase } from '../../lib/supabase';
import type { BadgeVariant } from '../../components/ui/Badge';
import type { OptionType } from '../../components/ui/Select';

export type StatusOperacional =
  | 'em_locacao'
  | 'contrato_indefinido'
  | 'disponivel'
  | 'revenda'
  | 'vendido'
  | 'roubado'
  | 'baixado';

export type StatusAtivo = 'disponivel' | 'vendido' | 'roubado' | 'baixado';

export type TipoMovimento =
  | 'cadastro'
  | 'acoplamento'
  | 'desacoplamento'
  | 'documento'
  | 'observacao'
  | 'contrato'
  | 'entrega'
  | 'devolucao'
  | 'venda';

export const STATUS_ATIVO_LABELS: Record<StatusAtivo, string> = {
  disponivel: 'Disponível',
  vendido: 'Vendido',
  roubado: 'Roubado',
  baixado: 'Baixado',
};

export const STATUS_ATIVO_BADGE: Record<StatusAtivo, BadgeVariant> = {
  disponivel: 'primary',
  vendido: 'neutral',
  roubado: 'error',
  baixado: 'error',
};

export const STATUS_ATIVO_OPTIONS: OptionType[] = (Object.keys(STATUS_ATIVO_LABELS) as StatusAtivo[]).map(
  value => ({ value, label: STATUS_ATIVO_LABELS[value] })
);

export const LOCADORA_OPTIONS: OptionType[] = [
  { value: 'TOPE', label: 'TOPE' },
  { value: 'VIPE', label: 'VIPE' },
];

export type FipeVinculoStatus = 'pendente' | 'automatico' | 'falha';

export const FIPE_VINCULO_LABELS: Record<FipeVinculoStatus, string> = {
  pendente: 'Pendente',
  automatico: 'FIPE',
  falha: 'Revisar',
};

export const FIPE_VINCULO_BADGE: Record<FipeVinculoStatus, BadgeVariant> = {
  pendente: 'warning',
  automatico: 'success',
  falha: 'error',
};

export function fipeStatusBadge(fipeCodigo: string | null | undefined, vinculoStatus: string | null | undefined): {
  label: string;
  variant: BadgeVariant;
} | null {
  if (fipeCodigo) return { label: 'FIPE', variant: 'success' };
  if (vinculoStatus === 'pendente') return { label: 'Pendente', variant: 'warning' };
  if (vinculoStatus === 'falha') return { label: 'Revisar', variant: 'error' };
  return null;
}

export const TIPO_DOCUMENTO_OPTIONS: OptionType[] = [
  { value: 'check_in_list', label: 'Check-in list' },
  { value: 'ipva', label: 'IPVA' },
  { value: 'ordem_remessa', label: 'Ordem de remessa' },
  { value: 'multas_notificacoes', label: 'Multas notificações' },
  { value: 'multas_boletos', label: 'Multas boletos' },
  { value: 'smartec', label: 'Smartec' },
  { value: 'despachante', label: 'Despachante' },
  { value: 'outros', label: 'Outros' },
];

export const TIPO_DOCUMENTO_LABELS: Record<string, string> = Object.fromEntries(
  TIPO_DOCUMENTO_OPTIONS.map(opt => [opt.value, opt.label])
);

export function extrairExtensao(nome: string): string {
  const match = nome.match(/\.[^./\\]+$/);
  return match ? match[0] : '';
}

export function extrairNomeBase(nome: string): string {
  const ext = extrairExtensao(nome);
  return ext ? nome.slice(0, -ext.length) : nome;
}

export function montarNomeArquivo(nomeBase: string, ext: string): string {
  const base = nomeBase.trim();
  if (!base) return '';
  return ext ? `${base}${ext}` : base;
}

export const MOVIMENTO_LABELS: Record<TipoMovimento, string> = {
  cadastro: 'Cadastro',
  acoplamento: 'Acoplamento',
  desacoplamento: 'Desacoplamento',
  documento: 'Documento',
  observacao: 'Observação',
  contrato: 'Contrato',
  entrega: 'Entrega',
  devolucao: 'Devolução',
  venda: 'Venda',
};

export function displayAssetStatus(status: StatusOperacional | string | null | undefined): StatusAtivo {
  if (status === 'vendido' || status === 'roubado' || status === 'baixado') return status;
  return 'disponivel';
}

export function isoToBr(iso?: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

export function brToIso(br?: string): string | null {
  if (!br) return null;
  const match = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayBr(): string {
  return isoToBr(todayIso());
}

export function formatMoney(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR');
}

export function parseIntOrNull(val: string): number | null {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : null;
}

export function parseMoney(val: number | string): number | null {
  if (typeof val === 'number' && Number.isFinite(val) && val > 0) return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export const maskCNPJ = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 14);
  let masked = digits;
  if (digits.length > 2) masked = `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length > 5) masked = `${masked.slice(0, 6)}.${digits.slice(5)}`;
  if (digits.length > 8) masked = `${masked.slice(0, 10)}/${digits.slice(8)}`;
  if (digits.length > 12) masked = `${masked.slice(0, 15)}-${digits.slice(12)}`;
  return masked;
};

export const maskCEP = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return digits;
};

export async function registrarMovimento(params: {
  veiculoId?: string | null;
  implementoId?: string | null;
  tipo: TipoMovimento;
  descricao: string;
  dados?: Record<string, unknown> | null;
  criadoPor?: string | null;
}): Promise<string | null> {
  const { error } = await supabase.from('frota_movimentacoes').insert({
    veiculo_id: params.veiculoId || null,
    implemento_id: params.implementoId || null,
    tipo: params.tipo,
    descricao: params.descricao,
    dados: params.dados ?? null,
    criado_por: params.criadoPor || null,
  });
  return error ? error.message : null;
}

export async function acoplarImplemento(params: {
  veiculoId: string;
  implementoId: string;
  dataInicio: string;
  placa: string;
  implementoNome: string;
  criadoPor?: string | null;
}): Promise<string | null> {
  const { error } = await supabase.from('frota_acoplamentos').insert({
    veiculo_id: params.veiculoId,
    implemento_id: params.implementoId,
    data_inicio: params.dataInicio,
    data_fim: null,
  });
  if (error) {
    if (error.code === '23505') return 'Este implemento já está acoplado a um caminhão.';
    return error.message;
  }
  return registrarMovimento({
    veiculoId: params.veiculoId,
    implementoId: params.implementoId,
    tipo: 'acoplamento',
    descricao: `Acoplou ${params.implementoNome} no caminhão ${params.placa || 'sem placa'}`,
    criadoPor: params.criadoPor,
  });
}

export async function desacoplarImplemento(params: {
  acoplamentoId: string;
  veiculoId: string;
  implementoId: string;
  placa: string;
  implementoNome: string;
  dataFim?: string;
  criadoPor?: string | null;
}): Promise<string | null> {
  const dataFim = params.dataFim || todayIso();
  const { error } = await supabase
    .from('frota_acoplamentos')
    .update({ data_fim: dataFim })
    .eq('id', params.acoplamentoId)
    .is('data_fim', null);
  if (error) return error.message;
  return registrarMovimento({
    veiculoId: params.veiculoId,
    implementoId: params.implementoId,
    tipo: 'desacoplamento',
    descricao: `Desacoplou ${params.implementoNome} do caminhão ${params.placa || 'sem placa'}`,
    criadoPor: params.criadoPor,
  });
}

export interface Implementadora {
  id: string;
  nome: string;
  cnpj: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export function asObject<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] || null : val;
}

export type CatalogoTipo = 'caminhao' | 'carro';

export interface CatalogoModelo {
  id: string;
  tipo: CatalogoTipo;
  marca: string;
  familia: string | null;
  modelo: string;
}

export const TIPO_VEICULO_OPTIONS: OptionType[] = [
  { value: 'caminhao', label: 'Caminhão' },
  { value: 'carro', label: 'Carro' },
];

export const MARCA_CATALOGO_OPTIONS: OptionType[] = [
  { value: 'VOLKSWAGEN', label: 'Volkswagen' },
  { value: 'AUDI', label: 'Audi' },
  { value: 'BMW', label: 'BMW' },
];

export const FAMILY_CATALOGO_OPTIONS: OptionType[] = [
  { value: 'Delivery', label: 'Delivery' },
  { value: 'Constellation', label: 'Constellation' },
  { value: 'Meteor', label: 'Meteor' },
  { value: 'e-Delivery', label: 'e-Delivery' },
  { value: 'Vocacionais', label: 'Vocacionais' },
];

export function snapshotModeloTexto(marca: string, modelo: string): string {
  const m = (marca || '').trim();
  const mod = (modelo || '').trim();
  if (!mod) return '';
  if (m.toUpperCase() === 'VOLKSWAGEN') return `VW/ ${mod}`;
  return m ? `${m} / ${mod}` : mod;
}

export function labelMarcaCatalogo(marca?: string | null): string {
  const value = (marca || '').trim();
  if (!value) return '';
  return MARCA_CATALOGO_OPTIONS.find(m => m.value === value)?.label || value;
}

export function labelCatalogoModelo(item: {
  tipo?: string | null;
  marca?: string | null;
  familia?: string | null;
  modelo?: string | null;
}): string {
  const modelo = item.modelo?.trim() || '';
  const familia = item.familia?.trim() || '';
  const marcaLabel = labelMarcaCatalogo(item.marca);
  const nome = familia && modelo ? `${familia} ${modelo}` : modelo;
  if (marcaLabel && nome) return `${marcaLabel} ${nome}`;
  return nome || marcaLabel || '—';
}

export function mapCatalogoModelo(item: Record<string, unknown>): CatalogoModelo {
  return {
    id: String(item.id),
    tipo: item.tipo === 'carro' ? 'carro' : 'caminhao',
    marca: (item.marca as string) || 'VOLKSWAGEN',
    familia: (item.familia as string) || null,
    modelo: (item.modelo as string) || '',
  };
}

export async function loadCatalogoModelos(): Promise<CatalogoModelo[]> {
  const { data, error } = await supabase
    .from('caminhoes')
    .select('id, tipo, marca, familia, modelo')
    .eq('is_active', true)
    .order('marca')
    .order('modelo');
  if (error) {
    console.error('Erro ao carregar catálogo de modelos:', error);
    return [];
  }
  return (data || []).map(mapCatalogoModelo);
}

export function mapImplementadora(item: Record<string, unknown>): Implementadora {
  return {
    id: String(item.id),
    nome: (item.nome as string) || '',
    cnpj: (item.cnpj as string) || '',
    cep: (item.cep as string) || '',
    endereco: (item.endereco as string) || '',
    numero: (item.numero as string) || '',
    complemento: (item.complemento as string) || '',
    bairro: (item.bairro as string) || '',
    cidade: (item.cidade as string) || '',
    estado: (item.estado as string) || '',
  };
}
