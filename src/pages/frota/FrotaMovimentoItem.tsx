import { ArrowSquareOut, Eye, LinkBreak, LinkSimple, Truck, Wrench } from '@phosphor-icons/react';
import type { NavigateFunction } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { MOVIMENTO_LABELS, formatDateTime, asObject, type TipoMovimento } from './frotaShared';

export interface MovimentoRow {
  id: string;
  tipo: TipoMovimento;
  descricao: string;
  criado_em: string;
  veiculo_id?: string | null;
  implemento_id?: string | null;
  veiculoPlaca?: string;
  veiculoModelo?: string;
  implementoNome?: string;
}

interface FrotaMovimentoItemProps {
  mov: MovimentoRow;
  context: 'veiculo' | 'implemento';
  navigate: NavigateFunction;
}

function parseConexaoDescricao(descricao: string): { implemento?: string; placa?: string } {
  const acop = descricao.match(/^Acoplou (.+) no caminhão (.+)$/);
  if (acop) return { implemento: acop[1], placa: acop[2] };
  const des = descricao.match(/^Desacoplou (.+) do caminhão (.+)$/);
  if (des) return { implemento: des[1], placa: des[2] };
  return {};
}

function EntityNavActions({
  path,
  navigate,
  label,
}: {
  path: string;
  navigate: NavigateFunction;
  label: string;
}) {
  return (
    <div className="frota-movimento-acoes">
      <button
        type="button"
        className="action-btn action-btn-edit"
        onClick={() => navigate(path)}
        title={`Ver ${label}`}
      >
        <Eye size={14} />
      </button>
      <button
        type="button"
        className="action-btn action-btn-edit"
        onClick={() => window.open(path, '_blank', 'noopener,noreferrer')}
        title={`Abrir ${label} em nova guia`}
      >
        <ArrowSquareOut size={14} />
      </button>
    </div>
  );
}

export function mapMovimentoRow(item: Record<string, unknown>): MovimentoRow {
  const veiculo = asObject(
    item.veiculo as { id: string; placa: string | null; modelo_texto: string | null } | null
  );
  const implemento = asObject(item.implemento as { id: string; nome: string } | null);
  return {
    id: item.id as string,
    tipo: item.tipo as TipoMovimento,
    descricao: item.descricao as string,
    criado_em: item.criado_em as string,
    veiculo_id: (item.veiculo_id as string | null) ?? veiculo?.id ?? null,
    implemento_id: (item.implemento_id as string | null) ?? implemento?.id ?? null,
    veiculoPlaca: veiculo?.placa || undefined,
    veiculoModelo: veiculo?.modelo_texto || undefined,
    implementoNome: implemento?.nome || undefined,
  };
}

export const MOVIMENTO_SELECT = `
  id, tipo, descricao, criado_em, veiculo_id, implemento_id,
  veiculo:frota_veiculos(id, placa, modelo_texto),
  implemento:frota_implementos(id, nome)
`;

export function FrotaMovimentoItem({ mov, context, navigate }: FrotaMovimentoItemProps) {
  const isConexao = mov.tipo === 'acoplamento' || mov.tipo === 'desacoplamento';
  const hasPar = isConexao && mov.veiculo_id && mov.implemento_id;
  const parsed = parseConexaoDescricao(mov.descricao);

  const badgeVariant =
    mov.tipo === 'desacoplamento' ? 'warning' : mov.tipo === 'documento' ? 'neutral' : 'primary';

  if (!hasPar) {
    return (
      <li className="frota-timeline-item">
        <Badge variant={badgeVariant}>{MOVIMENTO_LABELS[mov.tipo] || mov.tipo}</Badge>
        <div>
          <p className="frota-timeline-desc">{mov.descricao}</p>
          <p className="frota-chassi-text">{formatDateTime(mov.criado_em)}</p>
        </div>
      </li>
    );
  }

  const implementoLabel = mov.implementoNome || parsed.implemento || 'Implemento';
  const caminhaoLabel = mov.veiculoPlaca || parsed.placa || mov.veiculoModelo || 'Caminhão';
  const implementoPath = `/painel/frota/implementos/${mov.implemento_id}`;
  const caminhaoPath = `/painel/frota/${mov.veiculo_id}`;
  const ConectorIcon = mov.tipo === 'acoplamento' ? LinkSimple : LinkBreak;

  return (
    <li className="frota-timeline-item frota-timeline-item-conexao">
      <div className="frota-movimento-badge-col">
        <Badge variant={badgeVariant}>{MOVIMENTO_LABELS[mov.tipo] || mov.tipo}</Badge>
        <span className="frota-movimento-badge-sub">{formatDateTime(mov.criado_em)}</span>
      </div>
      <div className="frota-movimento-conexao-wrap">
        <div className={`frota-movimento-conexao frota-movimento-conexao--${mov.tipo}`}>
          <div
            className={`frota-movimento-entidade${context === 'implemento' ? ' frota-movimento-entidade-atual' : ''}`}
          >
            <Wrench size={18} className="frota-movimento-entidade-icon" />
            <div className="frota-movimento-entidade-body">
              <span className="frota-movimento-entidade-tipo">Implemento</span>
              <span className="frota-movimento-entidade-nome">{implementoLabel}</span>
            </div>
            {context === 'veiculo' && (
              <EntityNavActions path={implementoPath} navigate={navigate} label="implemento" />
            )}
          </div>

          <div className="frota-movimento-conector" title={MOVIMENTO_LABELS[mov.tipo]}>
            <ConectorIcon size={20} weight="bold" />
          </div>

          <div
            className={`frota-movimento-entidade${context === 'veiculo' ? ' frota-movimento-entidade-atual' : ''}`}
          >
            <Truck size={18} className="frota-movimento-entidade-icon" />
            <div className="frota-movimento-entidade-body">
              <span className="frota-movimento-entidade-tipo">Caminhão</span>
              <span className="frota-movimento-entidade-nome">{caminhaoLabel}</span>
            </div>
            {context === 'implemento' && (
              <EntityNavActions path={caminhaoPath} navigate={navigate} label="caminhão" />
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
