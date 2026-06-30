// types/configuracoes.types.ts — TOPE

export type TipoUsoDepreciacao = 'Leve/Moderado' | 'Severo';
export const TIPOS_USO_DEPRECIACAO: TipoUsoDepreciacao[] = ['Leve/Moderado', 'Severo'];

export type PrazoContrato = '12' | '24' | '36' | '48' | '60' | '72' | '84';
export const PRAZOS_CONTRATO: PrazoContrato[] = ['12', '24', '36', '48', '60', '72', '84'];

export interface ConfiguracaoLocacao {
  id: string;
  comissao_venda_percentual: number;
  imposto_venda_percentual: number;
  documentacao_valor: number;
  ipva_desconto_vista_percentual: number;
  ipva_depreciacao_percentual: number;
  criado_em: string;
  atualizado_em: string;
}

export interface TaxaFinanciamento {
  id: string;
  prazo: PrazoContrato;
  juros_mensal_percentual: number;
  criado_em: string;
  atualizado_em?: string;
}

export interface DepreciacaoCaminhao {
  id: string;
  caminhao_id: string;
  prazo: PrazoContrato;
  tipo_uso: TipoUsoDepreciacao;
  depreciacao_anual_percentual: number;
  criado_em: string;
  atualizado_em?: string;
  caminhoes?: {
    familia: string;
    modelo: string;
  };
}

export interface DepreciacaoImplemento {
  id: string;
  categoria_id: string;
  prazo: PrazoContrato;
  tipo_uso: TipoUsoDepreciacao;
  depreciacao_anual_percentual: number;
  criado_em: string;
  atualizado_em?: string;
  implemento_categorias?: {
    nome: string;
  };
}

export interface Caminhao {
  id: string;
  familia: string;
  modelo: string;
  transmissao: string[];
}

export interface Categoria {
  id: string;
  nome: string;
}

// Payloads para criação/edição
export interface ConfiguracaoLocacaoPayload {
  comissao_venda_percentual?: number;
  imposto_venda_percentual?: number;
  documentacao_valor?: number;
  ipva_desconto_vista_percentual?: number;
  ipva_depreciacao_percentual?: number;
}

export interface TaxaFinanciamentoPayload {
  prazo: PrazoContrato;
  juros_mensal_percentual: number;
}

export interface DepreciacaoCaminhaoPayload {
  caminhao_id: string;
  prazo: PrazoContrato;
  tipo_uso: TipoUsoDepreciacao;
  depreciacao_anual_percentual: number;
}

export interface DepreciacaoImplementoPayload {
  categoria_id: string;
  prazo: PrazoContrato;
  tipo_uso: TipoUsoDepreciacao;
  depreciacao_anual_percentual: number;
}
