// pages/cotacoes/CalculoItemModal.tsx — TOPE
import { useState, useEffect } from 'react';
import { Calculator, X, Calendar, FileXls } from '@phosphor-icons/react';
import ExcelJS from 'exceljs';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { useToast } from '../../components/ui/Toast';
import { LoadingState } from '../../components/ui/LoadingState';
import { buscarDepreciacaoCaminhao, buscarDepreciacaoImplemento } from '../../services/configuracoes.service';
import { supabase } from '../../lib/supabase';
import type { ItemLocal } from './NovaCotacaoPage';
import type { TipoUsoDepreciacao } from '../../types/configuracoes.types';

// ─── Máscara de Moeda BRL ───────────────────────────────────────────────────
function formatCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const number = parseInt(digits, 10) / 100;
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function parseCurrency(formatted: string): number {
  const digits = formatted.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}
function numToMask(value: number): string {
  if (!value) return '';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface TaxasCotacao {
  comissao_venda_percentual?: number | null;
  imposto_venda_ir_percentual?: number | null;
  imposto_venda_adicional_ir_percentual?: number | null;
  imposto_venda_csll_percentual?: number | null;
  depreciacao_contabil_percentual?: number | null;
  documentacao_valor?: number | null;
  ipva_desconto_vista_percentual?: number | null;
  ipva_depreciacao_percentual?: number | null;
  reajuste_aluguel_anual_percentual?: number | null;
}

interface CalculoItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ItemLocal | null;
  prazosCotaque: number[];
  taxasCotacao: TaxasCotacao;
  onSave: (updatedFields: Partial<ItemLocal>) => void;
}

export function CalculoItemModal({
  isOpen,
  onClose,
  item,
  prazosCotaque,
  taxasCotacao,
  onSave,
}: CalculoItemModalProps) {
  const toast = useToast();

  // ── Abas Principais ──
  const [activeTab, setActiveTab] = useState<'dados' | 'cashflow' | 'financiamento'>('dados');

  // ── Filtro/Prazo selecionado para a simulação ──
  const [prazoSelecionado, setPrazoSelecionado] = useState<number>(60);

  // ── Parâmetros Locais (Editáveis) ──
  const [caminhaoValor, setCaminhaoValor] = useState<string>('');
  const [caminhaoTipoUso, setCaminhaoTipoUso] = useState<TipoUsoDepreciacao>('Leve/Moderado');
  const [implementoValor, setImplementoValor] = useState<string>('');
  const [implementoTipoUso, setImplementoTipoUso] = useState<TipoUsoDepreciacao>('Leve/Moderado');

  // Tipos de uso disponíveis de depreciação cadastrados no banco de dados
  const [caminhaoTiposDisponiveis, setCaminhaoTiposDisponiveis] = useState<TipoUsoDepreciacao[]>([]);
  const [implementoTiposDisponiveis, setImplementoTiposDisponiveis] = useState<TipoUsoDepreciacao[]>([]);

  // ── Dados de Depreciação carregados do Banco ──
  const [depCaminhao, setDepCaminhao] = useState<any>(null);
  const [depImplemento, setDepImplemento] = useState<any>(null);
  const [loadingDep, setLoadingDep] = useState(false);

  // ── Estado de salvamento ──
  const [salvando, setSalvando] = useState(false);

  // ── Estado de exportação Excel ──
  const [exportando, setExportando] = useState(false);

  // Sincronizar com os prazos da cotação
  useEffect(() => {
    if (prazosCotaque.length > 0) {
      // Tenta usar o maior prazo ou o primeiro prazo disponível
      const defaultPrazo = prazosCotaque.includes(60) ? 60 : prazosCotaque[0];
      setPrazoSelecionado(defaultPrazo);
    } else {
      setPrazoSelecionado(60);
    }
  }, [prazosCotaque, isOpen]);

  // Sincronizar parâmetros iniciais do item e buscar preços/taxas do banco
  useEffect(() => {
    if (isOpen && item) {
      // Inicializa valor do caminhão (tenta caminhao_valor, se não busca preço do entre-eixos do banco)
      if (item.caminhao_valor) {
        setCaminhaoValor(numToMask(item.caminhao_valor));
      } else if (item.caminhao) {
        supabase
          .from('caminhoes_entre_eixos')
          .select('preco')
          .eq('caminhao_id', item.caminhao.caminhao_id)
          .eq('dimensao', item.caminhao.caminhao_entre_eixo)
          .eq('is_active', true)
          .maybeSingle()
          .then(({ data }: { data: any }) => {
            if (data && data.preco) {
              setCaminhaoValor(numToMask(Number(data.preco)));
            } else {
              setCaminhaoValor('');
            }
          });
      } else {
        setCaminhaoValor('');
      }

      setImplementoValor(numToMask(item.implemento_valor || 0));

      // Buscar tipos de uso de depreciação disponíveis para o caminhão
      if (item.caminhao) {
        supabase
          .from('cal_depreciacao_caminhoes')
          .select('tipo_uso')
          .eq('caminhao_id', item.caminhao.caminhao_id)
          .then(({ data }: { data: any }) => {
            const list = (data || []).map((d: any) => d.tipo_uso) as TipoUsoDepreciacao[];
            const listUnicas = [...new Set(list)];
            setCaminhaoTiposDisponiveis(listUnicas);

            const tipoInicial = item.caminhao_tipo_uso || 'Leve/Moderado';
            if (listUnicas.length > 0) {
              if (!listUnicas.includes(tipoInicial)) {
                setCaminhaoTipoUso(listUnicas[0]);
              } else {
                setCaminhaoTipoUso(tipoInicial);
              }
            } else {
              setCaminhaoTipoUso('Leve/Moderado');
            }
          });
      } else {
        setCaminhaoTiposDisponiveis([]);
      }

      // Buscar tipos de uso de depreciação disponíveis para o implemento
      if (item.implementos && item.implementos.length > 0) {
        supabase
          .from('cal_depreciacao_implementos')
          .select('tipo_uso')
          .eq('categoria_id', item.implementos[0].categoria_id)
          .then(({ data }: { data: any }) => {
            const list = (data || []).map((d: any) => d.tipo_uso) as TipoUsoDepreciacao[];
            const listUnicas = [...new Set(list)];
            setImplementoTiposDisponiveis(listUnicas);

            const tipoInicial = item.implemento_tipo_uso || 'Leve/Moderado';
            if (listUnicas.length > 0) {
              if (!listUnicas.includes(tipoInicial)) {
                setImplementoTipoUso(listUnicas[0]);
              } else {
                setImplementoTipoUso(tipoInicial);
              }
            } else {
              setImplementoTipoUso('Leve/Moderado');
            }
          });
      } else {
        setImplementoTiposDisponiveis([]);
      }
    }
  }, [item, isOpen]);

  // Carregar as regras de depreciação vigentes do Banco de Dados
  useEffect(() => {
    async function loadDepreciacoes() {
      if (!isOpen || !item) return;
      setLoadingDep(true);
      try {
        // 1. Depreciação do Caminhão
        if (item.caminhao?.caminhao_id) {
          const resTruck = await buscarDepreciacaoCaminhao(item.caminhao.caminhao_id, caminhaoTipoUso);
          setDepCaminhao(resTruck);
        } else {
          setDepCaminhao(null);
        }

        // 2. Depreciação do Implemento (usa o primeiro se houver múltiplos)
        if (item.implementos && item.implementos.length > 0) {
          const resImpl = await buscarDepreciacaoImplemento(item.implementos[0].categoria_id, implementoTipoUso);
          setDepImplemento(resImpl);
        } else {
          setDepImplemento(null);
        }
      } catch (err) {
        console.error('Erro ao buscar regras de depreciação:', err);
      } finally {
        setLoadingDep(false);
      }
    }
    loadDepreciacoes();
  }, [isOpen, item, caminhaoTipoUso, implementoTipoUso]);

  if (!isOpen || !item) return null;

  // ── Cálculos da Planilha Ano a Ano ──
  const anosExibicao = Math.ceil(prazoSelecionado / 12); // ex: 60 meses = 5 anos

  const getTaxaCaminhao = (ano: number): number => {
    if (!depCaminhao) return 0;
    const key = `ano_${ano}`;
    const val = depCaminhao[key] !== null ? Number(depCaminhao[key]) : 0;
    return val / 100;
  };

  const getTaxaImplemento = (ano: number): number => {
    if (!depImplemento) return 0;
    const key = `ano_${ano}`;
    const val = depImplemento[key] !== null ? Number(depImplemento[key]) : 0;
    return val / 100;
  };

  // Montar a tabela de simulação
  const linhasSimulacao = [];
  let residualCaminhaoAcum = parseCurrency(caminhaoValor);
  let residualImplementoAcum = parseCurrency(implementoValor);

  for (let ano = 1; ano <= 10; ano++) {
    const taxaCaminhao = getTaxaCaminhao(ano);
    const desvCaminhao = residualCaminhaoAcum * taxaCaminhao;
    residualCaminhaoAcum = Math.max(0, residualCaminhaoAcum - desvCaminhao);

    const taxaImplemento = getTaxaImplemento(ano);
    const desvImplemento = residualImplementoAcum * taxaImplemento;
    residualImplementoAcum = Math.max(0, residualImplementoAcum - desvImplemento);

    linhasSimulacao.push({
      ano,
      taxaCaminhao: taxaCaminhao * 100,
      desvCaminhao,
      residualCaminhao: residualCaminhaoAcum,
      taxaImplemento: taxaImplemento * 100,
      desvImplemento,
      residualImplemento: residualImplementoAcum,
      totalResidual: residualCaminhaoAcum + residualImplementoAcum,
    });
  }

  // Filtrar apenas os anos vigentes baseados no prazo
  const linhasFiltradas = linhasSimulacao.slice(0, anosExibicao);

  // ── Cálculos do Resumo do Termo de Venda ──
  const anosContrato = prazoSelecionado / 12; // ex: 3
  const mesesContrato = prazoSelecionado; // ex: 36
  const valorCompraTotal = parseCurrency(caminhaoValor) + parseCurrency(implementoValor);

  // Linha final baseada no prazo do contrato
  const indexFinal = Math.min(linhasSimulacao.length - 1, Math.max(0, anosContrato - 1));
  const dadosFinais = linhasSimulacao[indexFinal] || { totalResidual: 0 };
  const valorVendaResidual = dadosFinais.totalResidual;

  // Cálculos do Resumo usando taxas da cotação
  const taxaComissaoRaw = (taxasCotacao?.comissao_venda_percentual) ?? 5.8;
  const taxaComissao = taxaComissaoRaw > 1 ? (taxaComissaoRaw / 100) : taxaComissaoRaw;
  const valorComissao = valorVendaResidual * taxaComissao;
  const valorLíquidoVenda = Math.max(0, valorVendaResidual - valorComissao);

  const desvalorizacaoPercentual = valorCompraTotal > 0 ? (1 - (valorLíquidoVenda / valorCompraTotal)) : 0;
  const representacaoCompraPercentual = valorCompraTotal > 0 ? (valorLíquidoVenda / valorCompraTotal) : 0;

  const taxaMediaAnual = anosContrato > 0 ? (desvalorizacaoPercentual / anosContrato) : 0;
  const taxaMediaMensal = mesesContrato > 0 ? (desvalorizacaoPercentual / mesesContrato) : 0;

  // ── Cálculos do Cash Flow (Apuração do Lucro e Tributação) ──
  const taxaDepContabil = taxasCotacao?.depreciacao_contabil_percentual ?? 0.25;
  const depContabilAcumulada = Math.min(valorCompraTotal, valorCompraTotal * taxaDepContabil * (mesesContrato / 12));
  const valorResidualContabil = Math.max(0, valorCompraTotal - depContabilAcumulada);

  const lucroVenda = valorLíquidoVenda - valorResidualContabil;
  const baseCalculoImposto = Math.max(0, lucroVenda);

  const taxaIr = taxasCotacao?.imposto_venda_ir_percentual ?? 0.15;
  const taxaAdicionalIr = taxasCotacao?.imposto_venda_adicional_ir_percentual ?? 0.10;
  const taxaCsll = taxasCotacao?.imposto_venda_csll_percentual ?? 0.09;

  const valorIr = baseCalculoImposto * taxaIr;
  const valorAdicionalIr = baseCalculoImposto * taxaAdicionalIr;
  const valorCsll = baseCalculoImposto * taxaCsll;
  const totalTributos = valorIr + valorAdicionalIr + valorCsll;

  const valorLiquidoFinalVenda = Math.max(0, valorLíquidoVenda - totalTributos);
  const variacaoPercentual = valorCompraTotal > 0 ? (valorLiquidoFinalVenda / valorCompraTotal - 1) * 100 : 0;

  // ── Exportar Excel ──

  const handleExportarExcel = async () => {
    try {
      setExportando(true);

      // 1. Buscar o template da planilha base
      const response = await fetch('/planilha-base.xlsx');
      if (!response.ok) throw new Error('Não foi possível carregar a planilha base.');
      const arrayBuffer = await response.arrayBuffer();

      // 2. Carregar com ExcelJS
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      // 3. Acessar a aba "Dados"
      const worksheet = workbook.getWorksheet('Dados');
      if (!worksheet) throw new Error('Aba "Dados" não encontrada na planilha.');

      // 4. Substituir a célula C36 com o valor líquido final de venda (após tributos)
      worksheet.getCell('C36').value = valorLiquidoFinalVenda;

      // 5. Gerar o buffer e disparar o download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const nomeItem = item?.descricao || 'item';
      const nomeArquivo = `Orcamento_${nomeItem.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Planilha exportada com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao exportar planilha.');
    } finally {
      setExportando(false);
    }
  };

  // ── Salvar Alterações ──
  const handleConfirmar = async () => {
    const updatedFields: Partial<ItemLocal> = {
      caminhao_valor: parseCurrency(caminhaoValor),
      caminhao_tipo_uso: caminhaoTipoUso,
      implemento_valor: parseCurrency(implementoValor),
      implemento_tipo_uso: implementoTipoUso,
      caminhao_depreciacao_id: depCaminhao?.id || null,
      implemento_depreciacao_id: depImplemento?.id || null,
    };

    // Atualiza estado local imediatamente
    onSave(updatedFields);

    // Persiste no banco se o item já existe na cotacao_itens
    if (item?.id) {
      setSalvando(true);
      try {
        const { error } = await supabase
          .from('cotacao_itens')
          .update({
            caminhao_valor: updatedFields.caminhao_valor ?? null,
            caminhao_tipo_uso: updatedFields.caminhao_tipo_uso ?? null,
            implemento_valor: updatedFields.implemento_valor ?? null,
            implemento_tipo_uso: updatedFields.implemento_tipo_uso ?? null,
            caminhao_depreciacao_id: updatedFields.caminhao_depreciacao_id ?? null,
            implemento_depreciacao_id: updatedFields.implemento_depreciacao_id ?? null,
          })
          .eq('id', item.id);

        if (error) {
          toast.error('Erro ao salvar no banco', error.message);
          return;
        }
        toast.success('Parâmetros salvos!', 'Depreciação do item atualizada com sucesso.');
      } catch (err: any) {
        toast.error('Erro inesperado', err.message);
        return;
      } finally {
        setSalvando(false);
      }
    } else {
      toast.success('Parâmetros aplicados!', 'Salve a cotação para persistir as alterações.');
    }

    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick} role="dialog" aria-modal="true">
      <div className="modal" style={{ maxWidth: '880px', width: '95%', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}>
        {/* Cabeçalho */}
        <div className="modal-header" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              backgroundColor: 'rgba(249,115,22,0.1)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Calculator size={22} color="var(--color-primary)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--color-grey-900)' }}>
                Cálculos do Item de Locação
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-grey-500)' }}>
                Item: <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{item.descricao}</span>
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Fechar modal">
            <X size={20} />
          </button>
        </div>

        {/* Abas Superiores */}
        <div style={{
          display: 'flex', borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc', padding: '0 24px', gap: '24px'
        }}>
          {[
            { id: 'dados', label: 'Dados' },
            { id: 'cashflow', label: 'Cash Flow' },
            { id: 'financiamento', label: 'Financiamento', disabled: true },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id as any)}
              style={{
                padding: '14px 4px', border: 'none', background: 'none',
                fontSize: '13px', fontWeight: 600, cursor: tab.disabled ? 'not-allowed' : 'pointer',
                color: tab.disabled ? 'var(--color-grey-400)' : activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-grey-600)',
                borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'all 0.15s'
              }}
            >
              {tab.label}
              {tab.disabled && (
                <span style={{
                  fontSize: '9px', fontWeight: 500, padding: '2px 6px',
                  borderRadius: '10px', backgroundColor: '#e2e8f0', color: 'var(--color-grey-500)'
                }}>
                  Em breve
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Corpo do Modal */}
        <div className="modal-body" style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
          {activeTab === 'dados' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Filtro de Prazos (Flag de Visualização) */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-md)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} color="var(--color-primary)" />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-grey-800)' }}>
                    Prazo de locação para a simulação:
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {prazosCotaque.map(pr => (
                    <button
                      key={pr}
                      type="button"
                      onClick={() => setPrazoSelecionado(pr)}
                      style={{
                        padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                        cursor: 'pointer', border: '1px solid',
                        borderColor: prazoSelecionado === pr ? 'var(--color-primary)' : '#e2e8f0',
                        backgroundColor: prazoSelecionado === pr ? 'rgba(249,115,22,0.08)' : '#fff',
                        color: prazoSelecionado === pr ? 'var(--color-primary)' : 'var(--color-grey-600)',
                        transition: 'all 0.15s'
                      }}
                    >
                      {pr} meses
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid de Inputs Financeiros */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Parâmetros do Caminhão */}
                <div style={{
                  padding: '16px', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)',
                  backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--color-grey-800)', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    🚚 Caminhão: {item.caminhao ? `${item.caminhao.caminhao_modelo} (${item.caminhao.caminhao_entre_eixo}m)` : 'Não selecionado'}
                  </h4>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-grey-500)', marginBottom: '6px' }}>
                      Valor de Aquisição (R$)
                    </label>
                    <input
                      type="text"
                      value={caminhaoValor}
                      onChange={(e) => setCaminhaoValor(formatCurrency(e.target.value))}
                      disabled={!item.caminhao}
                      placeholder="R$ 0,00"
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                        border: '1px solid #e2e8f0', fontSize: '13px', color: 'var(--color-grey-800)',
                        backgroundColor: !item.caminhao ? '#f8fafc' : '#fff', outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-grey-500)', marginBottom: '6px' }}>
                      Depreciação (Tipo de Uso)
                    </label>
                    <Select
                      options={caminhaoTiposDisponiveis.map(tipo => ({ value: tipo, label: tipo }))}
                      value={caminhaoTiposDisponiveis.map(tipo => ({ value: tipo, label: tipo })).find(o => o.value === caminhaoTipoUso) || null}
                      onChange={(val: any) => {
                        if (val) setCaminhaoTipoUso(val.value as TipoUsoDepreciacao);
                      }}
                      isDisabled={!item.caminhao || caminhaoTiposDisponiveis.length <= 1}
                      placeholder={caminhaoTiposDisponiveis.length === 0 ? "Sem depreciação cadastrada" : "Selecione..."}
                    />
                  </div>
                </div>

                {/* Parâmetros do Implemento */}
                <div style={{
                  padding: '16px', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)',
                  backgroundColor: '#fff', display: 'flex', flexDirection: 'column', gap: '12px'
                }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--color-grey-800)', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                    ⚙️ Implemento: {item.implementos && item.implementos.length > 0 ? item.implementos[0].categoria_nome : 'Não selecionado'}
                  </h4>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-grey-500)', marginBottom: '6px' }}>
                      Valor de Aquisição (R$)
                    </label>
                    <input
                      type="text"
                      value={implementoValor}
                      onChange={(e) => setImplementoValor(formatCurrency(e.target.value))}
                      disabled={!item.implementos || item.implementos.length === 0}
                      placeholder="R$ 0,00"
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                        border: '1px solid #e2e8f0', fontSize: '13px', color: 'var(--color-grey-800)',
                        backgroundColor: (!item.implementos || item.implementos.length === 0) ? '#f8fafc' : '#fff', outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-grey-500)', marginBottom: '6px' }}>
                      Depreciação (Tipo de Uso)
                    </label>
                    <Select
                      options={implementoTiposDisponiveis.map(tipo => ({ value: tipo, label: tipo }))}
                      value={implementoTiposDisponiveis.map(tipo => ({ value: tipo, label: tipo })).find(o => o.value === implementoTipoUso) || null}
                      onChange={(val: any) => {
                        if (val) setImplementoTipoUso(val.value as TipoUsoDepreciacao);
                      }}
                      isDisabled={(!item.implementos || item.implementos.length === 0) || implementoTiposDisponiveis.length <= 1}
                      placeholder={implementoTiposDisponiveis.length === 0 ? "Sem depreciação cadastrada" : "Selecione..."}
                    />
                  </div>
                </div>
              </div>

              {/* Seção da Planilha Financeira */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--color-grey-800)' }}>
                    Demonstrativo da Queda de Valor (Depreciação Ano a Ano)
                  </h4>
                </div>

                {loadingDep ? (
                  <LoadingState message="Buscando taxas vigentes no banco de dados..." />
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                          <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 600, color: 'var(--color-grey-600)', textAlign: 'center', width: '10%' }}>Ano</th>
                          <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 600, color: 'var(--color-grey-600)', textAlign: 'right' }}>Dep. Caminhão (%)</th>
                          <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 600, color: 'var(--color-grey-600)', textAlign: 'right' }}>Valor Residual Caminhão</th>
                          <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 600, color: 'var(--color-grey-600)', textAlign: 'right' }}>Dep. Implemento (%)</th>
                          <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 600, color: 'var(--color-grey-600)', textAlign: 'right' }}>Valor Residual Implemento</th>
                          <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)', textAlign: 'right', backgroundColor: 'rgba(249,115,22,0.04)' }}>Residual Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhasFiltradas.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-grey-400)', fontSize: '12px' }}>
                              Preencha o caminhão ou implemento para simular a queda de valor.
                            </td>
                          </tr>
                        ) : (
                          linhasFiltradas.map((linha) => (
                            <tr key={linha.ano} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}>
                              <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 600, color: 'var(--color-grey-800)', textAlign: 'center' }}>
                                Ano {linha.ano}
                              </td>
                              <td style={{ padding: '10px 14px', fontSize: '13px', textAlign: 'right', color: 'var(--color-grey-700)' }}>
                                {linha.taxaCaminhao.toFixed(1)}%
                              </td>
                              <td style={{ padding: '10px 14px', fontSize: '13px', textAlign: 'right', fontWeight: 500, color: 'var(--color-grey-800)' }}>
                                {linha.residualCaminhao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                              <td style={{ padding: '10px 14px', fontSize: '13px', textAlign: 'right', color: 'var(--color-grey-700)' }}>
                                {linha.taxaImplemento.toFixed(1)}%
                              </td>
                              <td style={{ padding: '10px 14px', fontSize: '13px', textAlign: 'right', fontWeight: 500, color: 'var(--color-grey-800)' }}>
                                {linha.residualImplemento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                              <td style={{ padding: '10px 14px', fontSize: '13px', textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)', backgroundColor: 'rgba(249,115,22,0.04)' }}>
                                {linha.totalResidual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Avisos de Regra de Depreciação não cadastrada */}
                {!loadingDep && item.caminhao && !depCaminhao && (
                  <div style={{
                    marginTop: '10px', padding: '10px 14px', borderRadius: '6px',
                    backgroundColor: '#fffbeb', border: '1px solid #fef3c7',
                    display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#b45309'
                  }}>
                    <span>⚠️ AVISO: Não há regras de depreciação cadastradas no banco para o caminhão <strong>{item.caminhao.caminhao_modelo}</strong> no tipo <strong>{caminhaoTipoUso}</strong>. As taxas exibidas serão 0.0%.</span>
                  </div>
                )}
                {!loadingDep && item.implementos && item.implementos.length > 0 && !depImplemento && (
                  <div style={{
                    marginTop: '10px', padding: '10px 14px', borderRadius: '6px',
                    backgroundColor: '#fffbeb', border: '1px solid #fef3c7',
                    display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#b45309'
                  }}>
                    <span>⚠️ AVISO: Não há regras de depreciação cadastradas no banco para a categoria de implemento <strong>{item.implementos[0].categoria_nome}</strong> no tipo <strong>{implementoTipoUso}</strong>. As taxas exibidas serão 0.0%.</span>
                  </div>
                )}

                {/* Painel do Resumo do Encerramento do Contrato */}
                {!loadingDep && (linhasFiltradas.length > 0) && (
                  <div style={{
                    marginTop: '20px',
                    padding: '16px 20px',
                    backgroundColor: 'rgba(249,115,22,0.02)',
                    border: '1px solid rgba(249,115,22,0.15)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--color-grey-800)', borderBottom: '1px solid rgba(249,115,22,0.1)', paddingBottom: '8px' }}>
                      📊 Resumo do Termo de Venda após {prazoSelecionado} meses ({anosContrato} anos)
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-grey-500)', fontWeight: 500 }}>
                          Valor de Venda (Residual Total)
                        </span>
                        <span style={{ fontSize: '15px', color: 'var(--color-grey-800)', fontWeight: 700 }}>
                          {valorVendaResidual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-grey-500)', fontWeight: 500 }}>
                          Comissão de Venda ({(taxaComissao * 100).toFixed(1)}%)
                        </span>
                        <span style={{ fontSize: '15px', color: '#dc2626', fontWeight: 700 }}>
                          - {valorComissao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-grey-500)', fontWeight: 500 }}>
                          Valor Líquido de Venda
                        </span>
                        <span style={{ fontSize: '15px', color: 'var(--color-primary)', fontWeight: 800 }}>
                          {valorLíquidoVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px dashed rgba(249,115,22,0.1)', paddingTop: '10px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-grey-500)', fontWeight: 500 }}>
                          Desvalorização ao Término do Contrato
                        </span>
                        <span style={{ fontSize: '14px', color: 'var(--color-grey-800)', fontWeight: 700 }}>
                          {(desvalorizacaoPercentual * 100).toFixed(2)}% <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-grey-500)' }}>(representa {(representacaoCompraPercentual * 100).toFixed(2)}% do valor de compra)</span>
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--color-grey-500)', fontWeight: 500 }}>
                          Taxa Média de Depreciação (Acumulada)
                        </span>
                        <span style={{ fontSize: '14px', color: 'var(--color-grey-800)', fontWeight: 700 }}>
                          {(taxaMediaAnual * 100).toFixed(2)}% ao ano{' '}<span style={{ fontSize: '12px', color: 'var(--color-grey-400)' }}>&#124;</span>{' '}{(taxaMediaMensal * 100).toFixed(2)}% ao mês
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'cashflow' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Seção 1: Depreciação Contábil do Ativo e Apuração de Lucro */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                
                {/* Bloco Depreciação Contábil */}
                <div style={{
                  padding: '20px', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)',
                  backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '14px'
                }}>
                  <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--color-grey-800)' }}>
                      🏗️ Depreciação Contábil do Ativo
                    </h4>
                    <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--color-grey-450)' }}>
                      Depreciação acumulada para fins fiscais/contábeis.
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { label: 'Valor de Compra Total', val: numToMask(valorCompraTotal) },
                      { label: `Taxa Deprec. Contábil (% a.a.)`, val: `${(taxaDepContabil * 100).toFixed(2)}%` },
                      { label: 'Período do Contrato', val: `${mesesContrato} meses (${anosContrato.toFixed(1)} anos)` },
                      { label: 'Depreciação Contábil Acumulada', val: numToMask(depContabilAcumulada), color: '#dc2626' },
                      { label: 'Valor Residual Contábil', val: numToMask(valorResidualContabil), color: 'var(--color-primary)', isBold: true },
                    ].map((row, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: idx < 4 ? '1px dashed #f1f5f9' : 'none', paddingBottom: '6px' }}>
                        <span style={{ color: 'var(--color-grey-600)' }}>{row.label}</span>
                        <span style={{ fontWeight: row.isBold ? 700 : 500, color: row.color || 'var(--color-grey-800)' }}>{row.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bloco Apuração do Lucro */}
                <div style={{
                  padding: '20px', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)',
                  backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '14px'
                }}>
                  <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--color-grey-800)' }}>
                      📈 Apuração do Lucro de Venda
                    </h4>
                    <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--color-grey-450)' }}>
                      Ganho de capital sobre a alienação do imobilizado.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { label: 'Valor de Venda (Residual Físico)', val: numToMask(valorVendaResidual) },
                      { label: `(-) Comissão de Venda (${(taxaComissao * 100).toFixed(1)}%)`, val: `- ${numToMask(valorComissao)}`, color: '#dc2626' },
                      { label: 'Valor de Venda Líquido de Comissão', val: numToMask(valorLíquidoVenda) },
                      { label: '(-) Valor Residual Contábil', val: `- ${numToMask(valorResidualContabil)}`, color: '#dc2626' },
                      { 
                        label: lucroVenda >= 0 ? 'Lucro na Venda' : 'Prejuízo na Venda', 
                        val: numToMask(lucroVenda), 
                        color: lucroVenda >= 0 ? '#16a34a' : '#dc2626',
                        isBold: true 
                      },
                      { label: 'Base de Cálculo para Tributação', val: numToMask(baseCalculoImposto), isBold: true, color: 'var(--color-grey-800)' },
                    ].map((row, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: idx < 5 ? '1px dashed #f1f5f9' : 'none', paddingBottom: '6px' }}>
                        <span style={{ color: 'var(--color-grey-600)' }}>{row.label}</span>
                        <span style={{ fontWeight: row.isBold ? 700 : 500, color: row.color || 'var(--color-grey-800)' }}>{row.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Seção 2: Tributação e Resumo Final */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

                {/* Bloco Tributação */}
                <div style={{
                  padding: '20px', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)',
                  backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '14px'
                }}>
                  <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--color-grey-800)' }}>
                      💸 Tributação Sobre o Lucro de Venda
                    </h4>
                    <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--color-grey-450)' }}>
                      Alíquotas incidentes sobre o lucro obtido.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {[
                      { label: `IR (${(taxaIr * 100).toFixed(1)}% s/ Lucro)`, val: numToMask(valorIr), color: valorIr > 0 ? '#dc2626' : undefined },
                      { label: `Adicional ao IR (${(taxaAdicionalIr * 100).toFixed(1)}% s/ Lucro)`, val: numToMask(valorAdicionalIr), color: valorAdicionalIr > 0 ? '#dc2626' : undefined },
                      { label: `CSLL (${(taxaCsll * 100).toFixed(1)}% s/ Lucro)`, val: numToMask(valorCsll), color: valorCsll > 0 ? '#dc2626' : undefined },
                      { label: 'Total Tributos', val: numToMask(totalTributos), color: totalTributos > 0 ? '#dc2626' : undefined, isBold: true },
                    ].map((row, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: idx < 3 ? '1px dashed #f1f5f9' : 'none', paddingBottom: '6px' }}>
                        <span style={{ color: 'var(--color-grey-600)' }}>{row.label}</span>
                        <span style={{ fontWeight: row.isBold ? 700 : 500, color: row.color || 'var(--color-grey-800)' }}>{row.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bloco Resultado Final */}
                <div style={{
                  padding: '20px', border: '1px solid rgba(249,115,22,0.15)', borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(249,115,22,0.02)', display: 'flex', flexDirection: 'column', gap: '14px',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ borderBottom: '1px solid rgba(249,115,22,0.1)', paddingBottom: '10px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--color-grey-800)' }}>
                        💰 Resultado Final da Alienação
                      </h4>
                      <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--color-grey-450)' }}>
                        Retorno líquido total de venda pós-impostos e custos.
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
                      {[
                        { label: 'Valor de Venda Bruto', val: numToMask(valorVendaResidual) },
                        { label: '(-) Comissão de Corretagem', val: `- ${numToMask(valorComissao)}`, color: '#dc2626' },
                        { label: '(-) Impostos e Tributos', val: `- ${numToMask(totalTributos)}`, color: '#dc2626' },
                      ].map((row, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderBottom: '1px dashed rgba(249,115,22,0.1)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--color-grey-600)' }}>{row.label}</span>
                          <span style={{ fontWeight: 500, color: row.color || 'var(--color-grey-800)' }}>{row.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{
                    marginTop: '10px', padding: '12px', borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)' }}>VALOR LÍQUIDO FINAL DE VENDA</span>
                      <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--color-primary)' }}>
                        {numToMask(valorLiquidoFinalVenda)}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '10px', color: 'var(--color-grey-500)', fontWeight: 500 }}>Variação vs. Compra</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: variacaoPercentual >= 0 ? '#16a34a' : '#dc2626' }}>
                        {variacaoPercentual >= 0 ? '+' : ''}{variacaoPercentual.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Rodapé do Modal */}
        <div className="modal-footer" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            {/* Botão Exportar Excel — lado esquerdo */}
            <button
              type="button"
              onClick={handleExportarExcel}
              disabled={exportando}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 16px', borderRadius: 'var(--radius-md)',
                border: '1px solid #16a34a', backgroundColor: '#f0fdf4',
                color: '#16a34a', fontWeight: 600, fontSize: '13px',
                cursor: exportando ? 'wait' : 'pointer',
                opacity: exportando ? 0.7 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              <FileXls size={18} weight="bold" />
              {exportando ? 'Exportando...' : 'Exportar Excel'}
            </button>

            {/* Botões Cancelar e Salvar — lado direito */}
            <div style={{ display: 'flex', gap: '12px' }}>
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
              <Button variant="primary" size="md" onClick={handleConfirmar} loading={salvando}>
                {salvando ? 'Salvando...' : 'Salvar Parâmetros'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
