import { supabase } from '../lib/supabase';
import type { OptionType } from '../components/ui/Select';

export type FipeTipoVeiculo = 'caminhao' | 'carro';

export interface FipeOption {
  Label: string;
  Value: string;
}

export interface FipeValor {
  Valor?: string;
  Marca?: string;
  Modelo?: string;
  AnoModelo?: number | string;
  Combustivel?: string;
  CodigoFipe?: string;
  MesReferencia?: string;
  Autenticacao?: string;
}

const COMBUSTIVEL_LABEL: Record<string, string> = {
  '1': 'Gasolina',
  '2': 'Álcool',
  '3': 'Diesel',
  '4': 'Flex',
  '5': 'GNV',
};

export function fipeCodigoTipo(tipo: FipeTipoVeiculo): string {
  return tipo === 'carro' ? '1' : '3';
}

export function parseAnoFipe(ano: string): { anoModelo: number | null; codigoTipoCombustivel: string } {
  const [yearRaw, fuel = ''] = String(ano).split('-');
  const year = Number(yearRaw);
  if (year === 32000) return { anoModelo: null, codigoTipoCombustivel: fuel };
  return { anoModelo: Number.isFinite(year) ? year : null, codigoTipoCombustivel: fuel };
}

export function labelAnoFipe(opt: FipeOption): string {
  const { anoModelo, codigoTipoCombustivel } = parseAnoFipe(opt.Value);
  const combustivel = COMBUSTIVEL_LABEL[codigoTipoCombustivel] || '';
  if (opt.Label === '32000' || anoModelo == null) {
    return combustivel ? `0 km · ${combustivel}` : '0 km';
  }
  return combustivel ? `${anoModelo} · ${combustivel}` : String(anoModelo);
}

export function fipeOptionsToSelect(rows: FipeOption[], kind: 'ano' | 'padrao' = 'padrao'): OptionType[] {
  return rows.map(row => ({
    value: String(row.Value),
    label: kind === 'ano' ? labelAnoFipe(row) : String(row.Label),
  }));
}

export function parseValorFipe(valor?: string | null): number | null {
  if (!valor) return null;
  const digits = valor.replace(/[^\d,-]/g, '').replace(/\./g, '').replace(',', '.');
  const num = Number(digits);
  return Number.isFinite(num) ? num : null;
}

async function invokeFipe<T>(body: Record<string, string>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('fipe-proxy', { body });
  if (error) throw new Error(error.message || 'Erro ao consultar a FIPE.');
  if (data?.error) throw new Error(String(data.error));
  return data?.data as T;
}

export async function listarMarcasFipe(tipo: FipeTipoVeiculo): Promise<FipeOption[]> {
  return invokeFipe<FipeOption[]>({ action: 'marcas', codigoTipoVeiculo: fipeCodigoTipo(tipo) });
}

export async function listarAnosFipe(tipo: FipeTipoVeiculo, codigoMarca: string): Promise<FipeOption[]> {
  return invokeFipe<FipeOption[]>({
    action: 'anos',
    codigoTipoVeiculo: fipeCodigoTipo(tipo),
    codigoMarca,
  });
}

export async function listarModelosFipe(
  tipo: FipeTipoVeiculo,
  codigoMarca: string,
  ano: string
): Promise<FipeOption[]> {
  return invokeFipe<FipeOption[]>({
    action: 'modelos',
    codigoTipoVeiculo: fipeCodigoTipo(tipo),
    codigoMarca,
    ano,
  });
}

export async function consultarValorFipe(
  tipo: FipeTipoVeiculo,
  codigoMarca: string,
  codigoModelo: string,
  ano: string
): Promise<FipeValor> {
  return invokeFipe<FipeValor>({
    action: 'valor',
    codigoTipoVeiculo: fipeCodigoTipo(tipo),
    codigoMarca,
    codigoModelo,
    ano,
  });
}
