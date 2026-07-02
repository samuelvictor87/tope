// pages/cotacoes/ItemCaminhaoModal.tsx — TOPE
// Modal de seleção de Caminhão: 2 etapas — (1) escolhe PBT → (2) filtra e seleciona entre-eixos
import { useState, useEffect } from 'react';
import { Truck, X } from '@phosphor-icons/react';
import { createPortal } from 'react-dom';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import type { ImplementoEscolha } from './ItemImplementoModal';
import type { TipoUsoDepreciacao } from '../../types/configuracoes.types';
import '../../styles/components/modal.css';

// ─── Tipos exportados ─────────────────────────────────────────────────────────
export interface CaminhaoSelecionado {
  caminhao_id: string;
  caminhao_entre_eixo: string;
  caminhao_modelo: string;
  caminhao_familia: string;
}

interface LinhaTabela {
  entre_eixo_id: string;
  caminhao_id: string;
  dimensao: string;
  capacidade: number;
  modelo: string;
  familia: string;
  pbt_tecnico: number;
  pbt_homologado: number;
  peso_ordem_marcha: number;
  preco: number;
}

interface ItemCaminhaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (caminhao: CaminhaoSelecionado, tipoUso: TipoUsoDepreciacao, valor: number) => void;
  implementos: ImplementoEscolha[];
  caminhaoInicial: CaminhaoSelecionado | null;
  tipoUsoInicial: TipoUsoDepreciacao | null;
  valorInicial: number | null;
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function ItemCaminhaoModal({
  isOpen,
  onClose,
  onSave,
  implementos,
  caminhaoInicial,
  tipoUsoInicial,
  valorInicial,
}: ItemCaminhaoModalProps) {
  const toast = useToast();

  // Etapa 1: escolha de PBT; Etapa 2: tabela de resultados
  const [etapa, setEtapa] = useState<1 | 2>(1);
  const [tipoPbt, setTipoPbt] = useState<'Homologada' | 'Técnica'>('Homologada');

  const [loading, setLoading] = useState(false);
  const [todasLinhas, setTodasLinhas] = useState<LinhaTabela[]>([]);
  const [filtrosEntreEixo, setFiltrosEntreEixo] = useState<string[]>([]);
  const [todosEntreEixos, setTodosEntreEixos] = useState<string[]>([]);
  const [linhaSelecionada, setLinhaSelecionada] = useState<LinhaTabela | null>(null);

  // Novos campos do item
  const [caminhaoTipoUso, setCaminhaoTipoUso] = useState<TipoUsoDepreciacao>('Leve/Moderado');
  const [caminhaoValor, setCaminhaoValor] = useState<string | number>('');

  // ── Peso total dos implementos ─────────────────────────────────────────────
  const pesoTotalImplementos = implementos.reduce(
    (total, impl) => total + impl.atributos.reduce((sum, attr) => sum + (attr.peso || 0), 0),
    0
  );

  const descricaoImplementos = implementos
    .map(impl => {
      const opcoes = impl.atributos.map(a => a.opcao_nome).filter(Boolean).join(', ');
      return `${impl.categoria_nome}${opcoes ? ` - ${opcoes}` : ''}`;
    })
    .join(' | ');

  // ── Reset ao abrir ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setEtapa(1);
    setTipoPbt('Homologada');
    setFiltrosEntreEixo([]);
    setTodasLinhas([]);
    setTodosEntreEixos([]);

    setCaminhaoTipoUso(tipoUsoInicial || 'Leve/Moderado');
    setCaminhaoValor(valorInicial !== null && valorInicial !== undefined ? valorInicial : '');

    if (caminhaoInicial) {
      setLinhaSelecionada({
        entre_eixo_id: '',
        caminhao_id: caminhaoInicial.caminhao_id,
        dimensao: caminhaoInicial.caminhao_entre_eixo,
        capacidade: 0,
        modelo: caminhaoInicial.caminhao_modelo,
        familia: caminhaoInicial.caminhao_familia,
        pbt_tecnico: 0,
        pbt_homologado: 0,
        peso_ordem_marcha: 0,
        preco: valorInicial || 0,
      });
    } else {
      setLinhaSelecionada(null);
    }
  }, [isOpen]);

  // Se o usuário seleciona uma nova linha e o valor está vazio, puxamos o preço sugerido do banco
  useEffect(() => {
    if (linhaSelecionada && linhaSelecionada.preco && (caminhaoValor === '' || caminhaoValor === 0)) {
      setCaminhaoValor(linhaSelecionada.preco);
    }
  }, [linhaSelecionada]);

  // ── "Encontrar entre-eixos" — busca e avança para etapa 2 ─────────────────
  const handleEncontrar = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('caminhoes_entre_eixos')
        .select('id, caminhao_id, dimensao, peso_ordem_marcha, pbt_tecnico, pbt_homologado, preco, caminhao:caminhoes(id, modelo, familia)')
        .eq('is_active', true)
        .order('dimensao');

      if (error) {
        toast.error('Erro ao buscar caminhões', error.message);
        return;
      }

      const rows = (data || []) as any[];

      const dimensoesUnicas = [
        ...new Set(rows.map((r: any) => r.dimensao)),
      ].sort((a: string, b: string) => Number(a) - Number(b)) as string[];
      setTodosEntreEixos(dimensoesUnicas);

      const linhas: LinhaTabela[] = rows.map((r: any) => ({
        entre_eixo_id: r.id,
        caminhao_id: r.caminhao_id,
        dimensao: r.dimensao,
        capacidade:
          tipoPbt === 'Homologada'
            ? r.pbt_homologado - r.peso_ordem_marcha
            : r.pbt_tecnico - r.peso_ordem_marcha,
        modelo: r.caminhao?.modelo || '',
        familia: r.caminhao?.familia || '',
        pbt_tecnico: r.pbt_tecnico,
        pbt_homologado: r.pbt_homologado,
        peso_ordem_marcha: r.peso_ordem_marcha,
        preco: r.preco ? Number(r.preco) : 0,
      }));
      setTodasLinhas(linhas);
      setEtapa(2);
    } finally {
      setLoading(false);
    }
  };

  // ── Filtros de entre-eixos ─────────────────────────────────────────────────
  const toggleFiltroEntreEixo = (dimensao: string) => {
    setFiltrosEntreEixo(prev =>
      prev.includes(dimensao) ? prev.filter(d => d !== dimensao) : [...prev, dimensao]
    );
  };

  const linhasComCapacidade: LinhaTabela[] = todasLinhas.map(l => ({
    ...l,
    capacidade:
      tipoPbt === 'Homologada'
        ? l.pbt_homologado - l.peso_ordem_marcha
        : l.pbt_tecnico - l.peso_ordem_marcha,
  }));

  const linhasFiltradas =
    filtrosEntreEixo.length > 0
      ? linhasComCapacidade.filter(l => filtrosEntreEixo.includes(l.dimensao))
      : linhasComCapacidade;

  // ── Confirmar ──────────────────────────────────────────────────────────────
  const handleConfirmar = () => {
    if (!linhaSelecionada) {
      toast.warning('Nenhum caminhão selecionado', 'Selecione um caminhão na tabela para continuar.');
      return;
    }
    const val = parseFloat(caminhaoValor.toString()) || 0;
    onSave({
      caminhao_id: linhaSelecionada.caminhao_id,
      caminhao_entre_eixo: linhaSelecionada.dimensao,
      caminhao_modelo: linhaSelecionada.modelo,
      caminhao_familia: linhaSelecionada.familia,
    }, caminhaoTipoUso, val);
    onClose();
  };

  // ── Voltar para etapa 1 ────────────────────────────────────────────────────
  const handleVoltar = () => {
    setEtapa(1);
    setTodasLinhas([]);
    setFiltrosEntreEixo([]);
  };

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // ─── Layout do modal ───────────────────────────────────────────────────────
  return createPortal(
    <div className="modal-overlay" onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <div className="modal modal-md" style={{ maxWidth: etapa === 2 ? '620px' : '480px' }}>

        {/* Cabeçalho */}
        <div className="modal-header" style={{ border: 'none', paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
              backgroundColor: 'rgba(249,115,22,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Truck size={24} color="var(--color-primary)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--color-grey-900)' }}>
                Definir caminhão
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--color-grey-600)', lineHeight: 1.4 }}>
                Atenção: você está prestes a definir{' '}
                <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>um caminhão</span>{' '}
                para uma{' '}
                <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>lista de implementos</span>
                {descricaoImplementos ? (
                  <><span style={{ color: 'var(--color-grey-600)', fontWeight: 400 }}>: </span>
                    <em style={{ fontStyle: 'normal', color: 'var(--color-primary)', fontWeight: 600 }}>{descricaoImplementos}</em></>
                ) : '.'}
              </p>
              {pesoTotalImplementos > 0 && (
                <span style={{
                  display: 'inline-block', marginTop: '8px',
                  backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0',
                  borderRadius: '6px', padding: '3px 10px',
                  fontSize: '12px', color: 'var(--color-grey-700)', fontWeight: 500,
                }}>
                  Peso total dos implementos: {pesoTotalImplementos.toLocaleString('pt-BR')} (Kg)
                </span>
              )}
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Fechar modal">
            <X size={20} />
          </button>
        </div>

        {/* Corpo */}
        <div className="modal-body" style={{ paddingTop: '20px' }}>

          {/* ── Etapa 1: escolha de PBT ── */}
          {etapa === 1 && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-grey-700)', marginBottom: '6px' }}>
                Capacidade
              </label>
              <select
                value={tipoPbt}
                onChange={e => setTipoPbt(e.target.value as 'Homologada' | 'Técnica')}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)',
                  border: '1px solid #e2e8f0', fontSize: '14px', color: 'var(--color-grey-800)',
                  backgroundColor: '#fff', outline: 'none', cursor: 'pointer',
                  appearance: 'auto',
                }}
              >
                <option value="Homologada">Homologada</option>
                <option value="Técnica">Técnica</option>
              </select>
            </div>
          )}

          {/* ── Etapa 2: filtros e tabela ── */}
          {etapa === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Filtros de entre-eixos */}
              {todosEntreEixos.length > 0 && (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: '6px',
                  padding: '8px 12px', backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)',
                }}>
                  {todosEntreEixos.map(dim => (
                    <button
                      key={dim}
                      type="button"
                      onClick={() => toggleFiltroEntreEixo(dim)}
                      style={{
                        padding: '4px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                        cursor: 'pointer', border: '1px solid',
                        borderColor: filtrosEntreEixo.includes(dim) ? 'var(--color-primary)' : '#e2e8f0',
                        backgroundColor: filtrosEntreEixo.includes(dim) ? 'rgba(249,115,22,0.1)' : '#fff',
                        color: filtrosEntreEixo.includes(dim) ? 'var(--color-primary)' : 'var(--color-grey-700)',
                        transition: 'all 0.15s',
                      }}
                    >
                      × {dim}
                    </button>
                  ))}
                </div>
              )}

              {/* Tabela */}
              <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc', zIndex: 1 }}>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>Entre-eixos</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>Capacidade (Kg)</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>Modelo</th>
                      <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>Família</th>
                      <th style={{ width: '56px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasFiltradas.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-grey-500)', fontSize: '14px' }}>
                          Nenhum caminhão encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      linhasFiltradas.map(linha => {
                        const isSelected =
                          linhaSelecionada?.caminhao_id === linha.caminhao_id &&
                          linhaSelecionada?.dimensao === linha.dimensao;
                        const insuficiente = pesoTotalImplementos > 0 && linha.capacidade < pesoTotalImplementos;
                        return (
                          <tr
                            key={`${linha.caminhao_id}-${linha.dimensao}`}
                            onClick={() => setLinhaSelecionada(isSelected ? null : linha)}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              backgroundColor: isSelected ? 'rgba(249,115,22,0.06)' : 'transparent',
                              cursor: 'pointer',
                              transition: 'background-color 0.15s',
                            }}
                          >
                            <td style={{ padding: '11px 14px', fontSize: '14px', color: 'var(--color-grey-800)', fontWeight: 500 }}>
                              {linha.dimensao}
                            </td>
                            <td style={{ padding: '11px 14px', fontSize: '14px', fontWeight: 500, color: insuficiente ? '#dc2626' : 'var(--color-grey-800)' }}>
                              {linha.capacidade.toLocaleString('pt-BR')}
                              {insuficiente && <span style={{ fontSize: '10px', marginLeft: '4px', color: '#dc2626' }}>⚠</span>}
                            </td>
                            <td style={{ padding: '11px 14px', fontSize: '14px', color: 'var(--color-grey-800)' }}>
                              {linha.modelo}
                            </td>
                            <td style={{ padding: '11px 14px', fontSize: '14px', color: 'var(--color-grey-800)' }}>
                              {linha.familia}
                            </td>
                            <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                              <label
                                style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px', cursor: 'pointer' }}
                                onClick={e => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => setLinhaSelecionada(isSelected ? null : linha)}
                                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                                />
                                <span style={{
                                  position: 'absolute', inset: 0,
                                  backgroundColor: isSelected ? 'var(--color-primary)' : '#e2e8f0',
                                  borderRadius: '20px', transition: 'background-color 0.2s',
                                }} />
                                <span style={{
                                  position: 'absolute', top: '2px',
                                  left: isSelected ? '18px' : '2px',
                                  width: '16px', height: '16px',
                                  borderRadius: '50%', backgroundColor: '#fff',
                                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                }} />
                              </label>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Parâmetros adicionais para depreciação e cálculo */}
              {linhaSelecionada && (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-md)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginTop: '4px'
                }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-grey-700)', display: 'block', marginBottom: '6px' }}>
                      Tipo de uso do caminhão (Depreciação)
                    </label>
                    <select
                      value={caminhaoTipoUso}
                      onChange={e => setCaminhaoTipoUso(e.target.value as TipoUsoDepreciacao)}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                        border: '1px solid #e2e8f0', fontSize: '13px', color: 'var(--color-grey-800)',
                        backgroundColor: '#fff', outline: 'none', cursor: 'pointer'
                      }}
                    >
                      <option value="Leve/Moderado">Leve/Moderado</option>
                      <option value="Severo">Severo</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-grey-700)', display: 'block', marginBottom: '6px' }}>
                      Valor do caminhão (R$)
                    </label>
                    <input
                      type="number"
                      value={caminhaoValor}
                      onChange={e => setCaminhaoValor(e.target.value)}
                      placeholder="Valor sugerido: R$ 0,00"
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                        border: '1px solid #e2e8f0', fontSize: '13px', color: 'var(--color-grey-800)',
                        backgroundColor: '#fff', outline: 'none'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: '12px' }}>
            {etapa === 2 ? (
              <>
                <button
                  type="button"
                  onClick={handleVoltar}
                  style={{
                    padding: '10px 20px', borderRadius: 'var(--radius-md)',
                    border: '1px solid #e2e8f0', backgroundColor: '#fff',
                    color: 'var(--color-grey-700)', fontWeight: 500, fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Voltar
                </button>
                <Button variant="primary" size="md" onClick={handleConfirmar}>
                  Selecionar caminhão
                </Button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '10px 20px', borderRadius: 'var(--radius-md)',
                    border: '1px solid #e2e8f0', backgroundColor: '#fff',
                    color: 'var(--color-grey-700)', fontWeight: 500, fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <Button variant="primary" size="md" onClick={handleEncontrar} loading={loading}>
                  Encontrar entre-eixos
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
