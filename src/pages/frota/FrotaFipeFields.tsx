import { Select } from '../../components/ui/Select';
import { InputNumber } from '../../components/ui/InputNumber';
import type { OptionType } from '../../components/ui/Select';
import { TIPO_VEICULO_OPTIONS } from './frotaShared';

interface FrotaFipeFieldsProps {
  tipo: OptionType | null;
  marca: OptionType | null;
  ano: OptionType | null;
  modelo: OptionType | null;
  valor: number | null;
  marcaOpcoes: OptionType[];
  anoOpcoes: OptionType[];
  modeloOpcoes: OptionType[];
  loadingMarcas: boolean;
  loadingAnos: boolean;
  loadingModelos: boolean;
  loadingValor: boolean;
  onTipoChange: (opt: OptionType | null) => void;
  onMarcaChange: (opt: OptionType | null) => void;
  onAnoChange: (opt: OptionType | null) => void;
  onModeloChange: (opt: OptionType | null) => void;
}

export function FrotaFipeFields({
  tipo,
  marca,
  ano,
  modelo,
  valor,
  marcaOpcoes,
  anoOpcoes,
  modeloOpcoes,
  loadingMarcas,
  loadingAnos,
  loadingModelos,
  loadingValor,
  onTipoChange,
  onMarcaChange,
  onAnoChange,
  onModeloChange,
}: FrotaFipeFieldsProps) {
  return (
    <>
      <div className="frota-input-row">
        <Select
          label="Tipo"
          options={TIPO_VEICULO_OPTIONS}
          value={tipo}
          onChange={opt => onTipoChange((opt as OptionType) || null)}
          placeholder="Selecione o tipo..."
        />
        <Select
          label="Marca"
          options={marcaOpcoes}
          value={marca}
          onChange={opt => onMarcaChange((opt as OptionType) || null)}
          isDisabled={!tipo || loadingMarcas}
          isLoading={loadingMarcas}
          placeholder={tipo ? (loadingMarcas ? 'Carregando marcas...' : 'Selecione a marca...') : 'Selecione o tipo primeiro'}
        />
      </div>
      <div className="frota-input-row">
        <Select
          label="Ano"
          options={anoOpcoes}
          value={ano}
          onChange={opt => onAnoChange((opt as OptionType) || null)}
          isDisabled={!marca || loadingAnos}
          isLoading={loadingAnos}
          placeholder={marca ? (loadingAnos ? 'Carregando anos...' : 'Selecione o ano...') : 'Selecione a marca primeiro'}
        />
        <Select
          label="Modelo"
          options={modeloOpcoes}
          value={modelo}
          onChange={opt => onModeloChange((opt as OptionType) || null)}
          isDisabled={!ano || loadingModelos}
          isLoading={loadingModelos}
          placeholder={ano ? (loadingModelos ? 'Carregando modelos...' : 'Selecione o modelo...') : 'Selecione o ano primeiro'}
        />
      </div>
      <div className="frota-input-row">
        <InputNumber
          label={loadingValor ? 'Valor FIPE (consultando...)' : 'Valor FIPE'}
          currency
          value={valor ?? 0}
          readOnly
        />
      </div>
    </>
  );
}

export function fipeSaveFields(params: {
  tipo: string;
  marca: OptionType | null;
  ano: OptionType | null;
  modelo: OptionType | null;
  valor: number | null;
  anoModeloNumero: number | null;
  codigoFipe: string;
  combustivel: string;
  mesReferencia: string;
}) {
  return {
    tipo_veiculo: params.tipo,
    marca: params.marca?.label || null,
    modelo_texto: params.modelo?.label || null,
    ano_modelo: params.anoModeloNumero,
    valor_fipe: params.valor,
    fipe_codigo: params.codigoFipe || null,
    fipe_codigo_marca: params.marca?.value || null,
    fipe_codigo_modelo: params.modelo?.value || null,
    fipe_codigo_ano: params.ano?.value || null,
    fipe_combustivel: params.combustivel || null,
    fipe_mes_referencia: params.mesReferencia || null,
  };
}

export function backupIfEmpty(existing: {
  backup_marca?: string | null;
  backup_modelo_texto?: string | null;
  backup_ano_modelo?: number | null;
  backup_caminhao_id?: string | null;
  marca?: string | null;
  modelo_texto?: string | null;
  ano_modelo?: number | null;
  caminhao_id?: string | null;
}) {
  const already = !!(existing.backup_marca || existing.backup_modelo_texto || existing.backup_caminhao_id);
  if (already) return {};
  return {
    backup_marca: existing.marca || null,
    backup_modelo_texto: existing.modelo_texto || null,
    backup_ano_modelo: existing.ano_modelo ?? null,
    backup_caminhao_id: existing.caminhao_id || null,
  };
}
