// pages/configuracoes/ConfiguracoesPage.tsx — Módulo de Parametrização do Cálculo de Locação TOPE
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil } from '@phosphor-icons/react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { Pagination } from '../../components/ui/Pagination';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/components/configuracoes-locacao.css';
import '../../styles/components/table.css';

// Interfaces
interface ConfiguracoesLocacao {
  id?: string;
  comissao_venda_percentual: string;
  imposto_venda_percentual: string;
  documentacao_valor: string;
  ipva_desconto_vista_percentual: string;
  ipva_depreciacao_percentual: string;
}

interface TaxaFinanciamento {
  id: string;
  prazo: number;
  juros_mensal_percentual: number;
}

interface DepreciacaoCamItem {
  id: string | null;
  caminhao_id: string;
  familia: string;
  modelo: string;
  prazo: number;
  tipo_uso: string;
  depreciacao_anual_percentual: number;
}

interface DepreciacaoImpItem {
  id: string | null;
  categoria_id: string;
  categoria_nome: string;
  prazo: number;
  tipo_uso: string;
  depreciacao_anual_percentual: number;
}

const TABS = [
  { key: 'investimentos-financiamento', label: 'Investimentos e financiamento' },
  { key: 'taxas-impostos', label: 'Taxas e impostos' },
  { key: 'depreciacao-caminhoes', label: 'Depreciação caminhões' },
  { key: 'depreciacao-implementos', label: 'Depreciação implementos' },
];

const PRAZOS_PADRAO = [12, 24, 36, 48, 60, 72, 84];
const TIPOS_USO = ['Leve/Moderado', 'Severo'];

const PRAZO_OPTIONS: OptionType[] = [
  { value: 'Todos', label: 'Prazo (Todos)' },
  ...PRAZOS_PADRAO.map(p => ({ value: p.toString(), label: `${p} meses` }))
];

const TIPO_USO_OPTIONS: OptionType[] = [
  { value: 'Todos', label: 'Uso (Todos)' },
  ...TIPOS_USO.map(t => ({ value: t, label: t }))
];

// Auxiliares de formatação
const formatPercent = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '-';
  return `${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
};

const formatCurrency = (val: number | string) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num);
};

export function ConfiguracoesPage() {
  const toast = useToast();
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Controle de Permissão (Apenas administrador edita)
  const isReadOnly = profile?.perfil !== 'administrador';

  // Aba ativa na URL
  const activeTab = searchParams.get('aba') || 'investimentos-financiamento';

  const handleTabChange = (key: string) => {
    setSearchParams({ aba: key });
  };

  // ==========================================
  // ESTADOS GLOBAIS DE CARREGAMENTO E DADOS
  // ==========================================
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Aba 1 & 2: Configurações Gerais
  const [configGerais, setConfigGerais] = useState<ConfiguracoesLocacao>({
    comissao_venda_percentual: '5,80',
    imposto_venda_percentual: '34,00',
    documentacao_valor: '1000,00',
    ipva_desconto_vista_percentual: '3,00',
    ipva_depreciacao_percentual: '15,00',
  });

  // Aba 1: Financiamento
  const [taxasFinanciamento, setTaxasFinanciamento] = useState<TaxaFinanciamento[]>([]);
  const [modalFinanciamentoOpen, setModalFinanciamentoOpen] = useState(false);
  const [editingTaxa, setEditingTaxa] = useState<TaxaFinanciamento | null>(null);
  const [formTaxaJuros, setFormTaxaJuros] = useState('');

  // Aba 3: Depreciação Caminhões
  const [caminhoes, setCaminhoes] = useState<any[]>([]);
  const [depreciacoesCam, setDepreciacoesCam] = useState<any[]>([]);
  const [modalCaminhaoOpen, setModalCaminhaoOpen] = useState(false);
  const [editingDeprCam, setEditingDeprCam] = useState<DepreciacaoCamItem | null>(null);
  const [formDeprCamTaxa, setFormDeprCamTaxa] = useState('');
  // Filtros Caminhões
  const [filtroCamModelo, setFiltroCamModelo] = useState('');
  const [filtroCamPrazo, setFiltroCamPrazo] = useState<OptionType | null>({ value: 'Todos', label: 'Prazo (Todos)' });
  const [filtroCamTipo, setFiltroCamTipo] = useState<OptionType | null>({ value: 'Todos', label: 'Uso (Todos)' });
  const [pageCam, setPageCam] = useState(1);

  // Aba 4: Depreciação Implementos
  const [categorias, setCategorias] = useState<any[]>([]);
  const [depreciacoesImp, setDepreciacoesImp] = useState<any[]>([]);
  const [modalImplementoOpen, setModalImplementoOpen] = useState(false);
  const [editingDeprImp, setEditingDeprImp] = useState<DepreciacaoImpItem | null>(null);
  const [formDeprImpTaxa, setFormDeprImpTaxa] = useState('');
  // Filtros Implementos
  const [filtroImpCategoria, setFiltroImpCategoria] = useState<OptionType | null>({ value: 'Todos', label: 'Categoria (Todas)' });
  const [filtroImpPrazo, setFiltroImpPrazo] = useState<OptionType | null>({ value: 'Todos', label: 'Prazo (Todos)' });
  const [filtroImpTipo, setFiltroImpTipo] = useState<OptionType | null>({ value: 'Todos', label: 'Uso (Todos)' });
  const [pageImp, setPageImp] = useState(1);

  // ==========================================
  // CARREGAMENTO DE DADOS DO SUPABASE
  // ==========================================
  const loadConfiguracoesGerais = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_locacao')
        .select('*')
        .single();
      
      if (error) {
        console.error('Erro ao buscar configuracoes_locacao:', error);
      } else if (data) {
        setConfigGerais({
          id: data.id,
          comissao_venda_percentual: data.comissao_venda_percentual.toString().replace('.', ','),
          imposto_venda_percentual: data.imposto_venda_percentual.toString().replace('.', ','),
          documentacao_valor: data.documentacao_valor.toString().replace('.', ','),
          ipva_desconto_vista_percentual: data.ipva_desconto_vista_percentual.toString().replace('.', ','),
          ipva_depreciacao_percentual: data.ipva_depreciacao_percentual.toString().replace('.', ','),
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadTaxasFinanciamento = async () => {
    try {
      const { data, error } = await supabase
        .from('taxas_financiamento')
        .select('*')
        .order('prazo');

      if (error) {
        console.error('Erro ao buscar taxas_financiamento:', error);
      } else if (data) {
        setTaxasFinanciamento(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadDepreciacaoCaminhoesData = async () => {
    try {
      const { data: cams, error: camsErr } = await supabase
        .from('caminhoes')
        .select('id, familia, modelo')
        .order('modelo');

      const { data: deprs, error: deprsErr } = await supabase
        .from('depreciacao_caminhoes')
        .select('*');

      if (camsErr) console.error('Erro ao buscar caminhoes:', camsErr);
      if (deprsErr) console.error('Erro ao buscar depreciacoes_caminhoes:', deprsErr);

      if (cams) setCaminhoes(cams);
      if (deprs) setDepreciacoesCam(deprs);
    } catch (err) {
      console.error(err);
    }
  };

  const loadDepreciacaoImplementosData = async () => {
    try {
      const { data: cats, error: catsErr } = await supabase
        .from('categorias')
        .select('id, nome')
        .order('nome');

      const { data: deprs, error: deprsErr } = await supabase
        .from('depreciacao_implementos')
        .select('*');

      if (catsErr) console.error('Erro ao buscar categorias:', catsErr);
      if (deprsErr) console.error('Erro ao buscar depreciacoes_implementos:', deprsErr);

      if (cats) setCategorias(cats);
      if (deprs) setDepreciacoesImp(deprs);
    } catch (err) {
      console.error(err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    if (activeTab === 'investimentos-financiamento') {
      await Promise.all([loadConfiguracoesGerais(), loadTaxasFinanciamento()]);
    } else if (activeTab === 'taxas-impostos') {
      await loadConfiguracoesGerais();
    } else if (activeTab === 'depreciacao-caminhoes') {
      await loadDepreciacaoCaminhoesData();
    } else if (activeTab === 'depreciacao-implementos') {
      await loadDepreciacaoImplementosData();
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // ==========================================
  // SALVAR CONFIGURAÇÕES GERAIS (ABAS 1 E 2)
  // ==========================================
  const handleSaveConfigGerais = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    setSaving(true);
    try {
      const payload = {
        comissao_venda_percentual: parseFloat(configGerais.comissao_venda_percentual.replace(',', '.')),
        imposto_venda_percentual: parseFloat(configGerais.imposto_venda_percentual.replace(',', '.')),
        documentacao_valor: parseFloat(configGerais.documentacao_valor.replace(',', '.')),
        ipva_desconto_vista_percentual: parseFloat(configGerais.ipva_desconto_vista_percentual.replace(',', '.')),
        ipva_depreciacao_percentual: parseFloat(configGerais.ipva_depreciacao_percentual.replace(',', '.')),
      };

      if (
        isNaN(payload.comissao_venda_percentual) ||
        isNaN(payload.imposto_venda_percentual) ||
        isNaN(payload.documentacao_valor) ||
        isNaN(payload.ipva_desconto_vista_percentual) ||
        isNaN(payload.ipva_depreciacao_percentual)
      ) {
        toast.error('Erro de validação', 'Por favor, preencha todos os campos com valores válidos.');
        setSaving(false);
        return;
      }

      let error;
      if (configGerais.id) {
        const { error: err } = await supabase
          .from('configuracoes_locacao')
          .update(payload)
          .eq('id', configGerais.id);
        error = err;
      } else {
        const { error: err } = await supabase
          .from('configuracoes_locacao')
          .insert([payload]);
        error = err;
      }

      if (error) {
        toast.error('Erro ao salvar', error.message);
      } else {
        toast.success('Parâmetros salvos com sucesso!');
        loadConfiguracoesGerais();
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro inesperado', err.message || 'Houve um problema ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // SALVAR TAXAS DE FINANCIAMENTO
  // ==========================================
  const handleOpenEditTaxa = (taxa: TaxaFinanciamento) => {
    if (isReadOnly) return;
    setEditingTaxa(taxa);
    setFormTaxaJuros(taxa.juros_mensal_percentual.toString().replace('.', ','));
    setModalFinanciamentoOpen(true);
  };

  const handleSaveTaxaFinanciamento = async () => {
    if (isReadOnly || !editingTaxa) return;
    
    const taxaJuros = parseFloat(formTaxaJuros.replace(',', '.'));
    if (isNaN(taxaJuros) || taxaJuros < 0 || taxaJuros > 100) {
      toast.error('Erro de validação', 'Insira uma taxa de juros válida entre 0 e 100.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('taxas_financiamento')
        .update({ juros_mensal_percentual: taxaJuros })
        .eq('id', editingTaxa.id);

      if (error) {
        toast.error('Erro ao salvar', error.message);
      } else {
        toast.success(`Taxa para ${editingTaxa.prazo} meses atualizada!`);
        setModalFinanciamentoOpen(false);
        loadTaxasFinanciamento();
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro inesperado', err.message);
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // DEPRECIAÇÃO DE CAMINHÕES (MEMÓRIA + UPSERT)
  // ==========================================
  const caminhaoCombinations = useMemo(() => {
    const items: DepreciacaoCamItem[] = [];
    caminhoes.forEach(cam => {
      PRAZOS_PADRAO.forEach(prazo => {
        TIPOS_USO.forEach(tipo => {
          const match = depreciacoesCam.find(
            d => d.caminhao_id === cam.id && d.prazo === prazo && d.tipo_uso === tipo
          );
          items.push({
            id: match?.id || null,
            caminhao_id: cam.id,
            familia: cam.familia,
            modelo: cam.modelo,
            prazo,
            tipo_uso: tipo,
            depreciacao_anual_percentual: match?.depreciacao_anual_percentual ?? 0
          });
        });
      });
    });
    return items;
  }, [caminhoes, depreciacoesCam]);

  const filteredCaminhaoCombinations = useMemo(() => {
    return caminhaoCombinations.filter(item => {
      const matchesModelo = item.modelo.toLowerCase().includes(filtroCamModelo.toLowerCase()) || 
                            item.familia.toLowerCase().includes(filtroCamModelo.toLowerCase());
      const matchesPrazo = !filtroCamPrazo || filtroCamPrazo.value === 'Todos' || item.prazo.toString() === filtroCamPrazo.value;
      const matchesTipo = !filtroCamTipo || filtroCamTipo.value === 'Todos' || item.tipo_uso === filtroCamTipo.value;
      return matchesModelo && matchesPrazo && matchesTipo;
    });
  }, [caminhaoCombinations, filtroCamModelo, filtroCamPrazo, filtroCamTipo]);

  const paginatedCaminhoes = useMemo(() => {
    const start = (pageCam - 1) * 10;
    return filteredCaminhaoCombinations.slice(start, start + 10);
  }, [filteredCaminhaoCombinations, pageCam]);

  useEffect(() => {
    setPageCam(1);
  }, [filtroCamModelo, filtroCamPrazo, filtroCamTipo]);

  const handleOpenEditDeprCam = (item: DepreciacaoCamItem) => {
    if (isReadOnly) return;
    setEditingDeprCam(item);
    setFormDeprCamTaxa(item.depreciacao_anual_percentual.toString().replace('.', ','));
    setModalCaminhaoOpen(true);
  };

  const handleSaveDeprCam = async () => {
    if (isReadOnly || !editingDeprCam) return;

    const taxa = parseFloat(formDeprCamTaxa.replace(',', '.'));
    if (isNaN(taxa) || taxa < 0 || taxa > 100) {
      toast.error('Erro de validação', 'Insira uma taxa de depreciação válida entre 0 e 100.');
      return;
    }

    setSaving(true);
    try {
      let error;
      if (editingDeprCam.id) {
        const { error: err } = await supabase
          .from('depreciacao_caminhoes')
          .update({ depreciacao_anual_percentual: taxa })
          .eq('id', editingDeprCam.id);
        error = err;
      } else {
        const { error: err } = await supabase
          .from('depreciacao_caminhoes')
          .insert([{
            caminhao_id: editingDeprCam.caminhao_id,
            prazo: editingDeprCam.prazo,
            tipo_uso: editingDeprCam.tipo_uso,
            depreciacao_anual_percentual: taxa
          }]);
        error = err;
      }

      if (error) {
        toast.error('Erro ao salvar', error.message);
      } else {
        toast.success('Taxa de depreciação de caminhão atualizada!');
        setModalCaminhaoOpen(false);
        loadDepreciacaoCaminhoesData();
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro inesperado', err.message);
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // DEPRECIAÇÃO DE IMPLEMENTOS (MEMÓRIA + UPSERT)
  // ==========================================
  const implementoCombinations = useMemo(() => {
    const items: DepreciacaoImpItem[] = [];
    categorias.forEach(cat => {
      PRAZOS_PADRAO.forEach(prazo => {
        TIPOS_USO.forEach(tipo => {
          const match = depreciacoesImp.find(
            d => d.categoria_id === cat.id && d.prazo === prazo && d.tipo_uso === tipo
          );
          items.push({
            id: match?.id || null,
            categoria_id: cat.id,
            categoria_nome: cat.nome,
            prazo,
            tipo_uso: tipo,
            depreciacao_anual_percentual: match?.depreciacao_anual_percentual ?? 0
          });
        });
      });
    });
    return items;
  }, [categorias, depreciacoesImp]);

  const filteredImplementoCombinations = useMemo(() => {
    return implementoCombinations.filter(item => {
      const matchesCategoria = !filtroImpCategoria || filtroImpCategoria.value === 'Todos' || item.categoria_id === filtroImpCategoria.value;
      const matchesPrazo = !filtroImpPrazo || filtroImpPrazo.value === 'Todos' || item.prazo.toString() === filtroImpPrazo.value;
      const matchesTipo = !filtroImpTipo || filtroImpTipo.value === 'Todos' || item.tipo_uso === filtroImpTipo.value;
      return matchesCategoria && matchesPrazo && matchesTipo;
    });
  }, [implementoCombinations, filtroImpCategoria, filtroImpPrazo, filtroImpTipo]);

  const categoriaOptions = useMemo<OptionType[]>(() => {
    return [
      { value: 'Todos', label: 'Categoria (Todas)' },
      ...categorias.map(c => ({ value: c.id, label: c.nome }))
    ];
  }, [categorias]);

  const paginatedImplementos = useMemo(() => {
    const start = (pageImp - 1) * 10;
    return filteredImplementoCombinations.slice(start, start + 10);
  }, [filteredImplementoCombinations, pageImp]);

  useEffect(() => {
    setPageImp(1);
  }, [filtroImpCategoria, filtroImpPrazo, filtroImpTipo]);

  const handleOpenEditDeprImp = (item: DepreciacaoImpItem) => {
    if (isReadOnly) return;
    setEditingDeprImp(item);
    setFormDeprImpTaxa(item.depreciacao_anual_percentual.toString().replace('.', ','));
    setModalImplementoOpen(true);
  };

  const handleSaveDeprImp = async () => {
    if (isReadOnly || !editingDeprImp) return;

    const taxa = parseFloat(formDeprImpTaxa.replace(',', '.'));
    if (isNaN(taxa) || taxa < 0 || taxa > 100) {
      toast.error('Erro de validação', 'Insira uma taxa de depreciação válida entre 0 e 100.');
      return;
    }

    setSaving(true);
    try {
      let error;
      if (editingDeprImp.id) {
        const { error: err } = await supabase
          .from('depreciacao_implementos')
          .update({ depreciacao_anual_percentual: taxa })
          .eq('id', editingDeprImp.id);
        error = err;
      } else {
        const { error: err } = await supabase
          .from('depreciacao_implementos')
          .insert([{
            categoria_id: editingDeprImp.categoria_id,
            prazo: editingDeprImp.prazo,
            tipo_uso: editingDeprImp.tipo_uso,
            depreciacao_anual_percentual: taxa
          }]);
        error = err;
      }

      if (error) {
        toast.error('Erro ao salvar', error.message);
      } else {
        toast.success('Taxa de depreciação de implemento atualizada!');
        setModalImplementoOpen(false);
        loadDepreciacaoImplementosData();
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Erro inesperado', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      pageTitle="Configurações"
      pageSubtitle="Defina os parâmetros para o cálculo de locação."
    >
      <div className="config-locacao-page">
        {/* NAVEGAÇÃO DE ABAS */}
        <div className="config-locacao-header">
          <div className="config-locacao-tabs">
            {TABS.map(tab => (
              <button
                key={tab.key}
                type="button"
                className={`config-locacao-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* CONTEÚDO DAS ABAS */}
        <div className="config-locacao-content">
          
          {loading ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-450)' }}>
              Carregando dados...
            </div>
          ) : (
            <>
              {/* ========================================================
                  ABA 1: INVESTIMENTOS E FINANCIAMENTO
                  ======================================================== */}
              {activeTab === 'investimentos-financiamento' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-24)' }}>
                  
                  {/* Seção 1: Despesas Operacionais */}
                  <form className="config-locacao-section" onSubmit={handleSaveConfigGerais}>
                    <div className="config-locacao-section-header">
                      <h2>Despesas operacionais</h2>
                      <p>Parâmetros operacionais e custos de licenciamento.</p>
                    </div>
                    
                    <div className="config-locacao-grid-3">
                      <Input
                        label="Documentação"
                        value={configGerais.documentacao_valor}
                        onChange={e => setConfigGerais(prev => ({ ...prev, documentacao_valor: e.target.value }))}
                        placeholder="Ex: 1000,00"
                        required
                        disabled={isReadOnly}
                      />
                      <Input
                        label="IPVA desconto à vista"
                        value={configGerais.ipva_desconto_vista_percentual}
                        onChange={e => setConfigGerais(prev => ({ ...prev, ipva_desconto_vista_percentual: e.target.value }))}
                        placeholder="Ex: 3,00"
                        required
                        disabled={isReadOnly}
                      />
                      <Input
                        label="IPVA depreciação"
                        value={configGerais.ipva_depreciacao_percentual}
                        onChange={e => setConfigGerais(prev => ({ ...prev, ipva_depreciacao_percentual: e.target.value }))}
                        placeholder="Ex: 15,00"
                        required
                        disabled={isReadOnly}
                      />
                    </div>

                    {!isReadOnly && (
                      <div className="config-locacao-footer-actions">
                        <Button variant="primary" type="submit" loading={saving}>
                          Salvar despesas
                        </Button>
                      </div>
                    )}
                  </form>

                  {/* Seção 2: Financiamento */}
                  <div className="config-locacao-section">
                    <div className="config-locacao-section-header">
                      <h2>Financiamento</h2>
                      <p>Taxa de juros mensal por prazo de financiamento.</p>
                    </div>

                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th style={{ width: '40%' }}>Prazo (meses)</th>
                            <th style={{ width: '45%' }}>Juros mensal</th>
                            {!isReadOnly && <th style={{ width: '15%', textAlign: 'right' }}>Ações</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {taxasFinanciamento.map(taxa => (
                            <tr key={taxa.id}>
                              <td style={{ fontWeight: 600, color: 'var(--color-grey-800)' }}>{taxa.prazo}</td>
                              <td>{formatPercent(taxa.juros_mensal_percentual)}</td>
                              {!isReadOnly && (
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    className="action-btn action-btn-edit"
                                    onClick={() => handleOpenEditTaxa(taxa)}
                                    title="Editar taxa"
                                  >
                                    <Pencil size={16} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================
                  ABA 2: TAXAS E IMPOSTOS
                  ======================================================== */}
              {activeTab === 'taxas-impostos' && (
                <form className="config-locacao-section" onSubmit={handleSaveConfigGerais}>
                  <div className="config-locacao-section-header">
                    <h2>Venda - após encerramento do contrato</h2>
                    <p>Defina as taxas de corretagem e encargos de venda pós-locação.</p>
                  </div>

                  <div className="config-locacao-grid-2">
                    <Input
                      label="Comissão"
                      value={configGerais.comissao_venda_percentual}
                      onChange={e => setConfigGerais(prev => ({ ...prev, comissao_venda_percentual: e.target.value }))}
                      placeholder="Ex: 5,80"
                      required
                      disabled={isReadOnly}
                    />
                    <Input
                      label="Imposto de venda"
                      value={configGerais.imposto_venda_percentual}
                      onChange={e => setConfigGerais(prev => ({ ...prev, imposto_venda_percentual: e.target.value }))}
                      placeholder="Ex: 34,00"
                      required
                      disabled={isReadOnly}
                    />
                  </div>

                  {!isReadOnly && (
                    <div className="config-locacao-footer-actions">
                      <Button variant="primary" type="submit" loading={saving}>
                        Salvar taxas e impostos
                      </Button>
                    </div>
                  )}
                </form>
              )}

              {/* ========================================================
                  ABA 3: DEPRECIAÇÃO CAMINHÕES
                  ======================================================== */}
              {activeTab === 'depreciacao-caminhoes' && (
                <div className="config-locacao-section">
                  <div className="config-locacao-section-header">
                    <h2>Cálculo da locação: depreciação de caminhões</h2>
                    <p>Gerencie as taxas de depreciação anual (% aa) dos modelos cadastrados.</p>
                  </div>

                  {/* Filtros de Listagem */}
                  <div className="usuarios-filters" style={{ display: 'flex', gap: 'var(--spacing-12)', marginBottom: 'var(--spacing-20)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ width: 260 }}>
                      <Input
                        type="text"
                        placeholder="Buscar por modelo ou família..."
                        value={filtroCamModelo}
                        onChange={e => setFiltroCamModelo(e.target.value)}
                        style={{ height: 38 }}
                      />
                    </div>
                    <div style={{ width: 160 }}>
                      <Select
                        options={PRAZO_OPTIONS}
                        value={filtroCamPrazo}
                        onChange={opt => {
                          setFiltroCamPrazo(opt as OptionType);
                          setPageCam(1);
                        }}
                        placeholder="Prazo (Todos)"
                      />
                    </div>
                    <div style={{ width: 160 }}>
                      <Select
                        options={TIPO_USO_OPTIONS}
                        value={filtroCamTipo}
                        onChange={opt => {
                          setFiltroCamTipo(opt as OptionType);
                          setPageCam(1);
                        }}
                        placeholder="Uso (Todos)"
                      />
                    </div>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)', marginLeft: 'var(--spacing-8)' }}>
                      {filteredCaminhaoCombinations.length} combinações
                    </span>
                  </div>

                  {/* Listagem */}
                  <div className="table-container" style={{ marginBottom: 'var(--spacing-20)' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th style={{ width: '20%' }}>Família</th>
                          <th style={{ width: '30%' }}>Modelo</th>
                          <th style={{ width: '15%' }}>Prazo</th>
                          <th style={{ width: '15%' }}>Tipo</th>
                          <th style={{ width: '12%' }}>% aa</th>
                          {!isReadOnly && <th style={{ width: '8%', textAlign: 'right' }}>Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedCaminhoes.length === 0 ? (
                          <tr>
                            <td colSpan={isReadOnly ? 5 : 6} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-450)' }}>
                              Nenhuma depreciação de caminhão encontrada com os filtros selecionados.
                            </td>
                          </tr>
                        ) : (
                          paginatedCaminhoes.map((item, idx) => (
                            <tr key={idx}>
                              <td>{item.familia}</td>
                              <td style={{ fontWeight: 600, color: 'var(--color-grey-800)' }}>{item.modelo}</td>
                              <td>{item.prazo} meses</td>
                              <td>{item.tipo_uso}</td>
                              <td>{item.depreciacao_anual_percentual > 0 ? formatPercent(item.depreciacao_anual_percentual) : '-'}</td>
                              {!isReadOnly && (
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    className="action-btn action-btn-edit"
                                    onClick={() => handleOpenEditDeprCam(item)}
                                    title="Editar depreciação"
                                  >
                                    <Pencil size={16} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Paginação */}
                    <Pagination
                      currentPage={pageCam}
                      totalCount={filteredCaminhaoCombinations.length}
                      itemsPerPage={10}
                      onPageChange={setPageCam}
                      itemLabel="combinações"
                    />
                  </div>
                </div>
              )}

              {/* ========================================================
                  ABA 4: DEPRECIAÇÃO IMPLEMENTOS
                  ======================================================== */}
              {activeTab === 'depreciacao-implementos' && (
                <div className="config-locacao-section">
                  <div className="config-locacao-section-header">
                    <h2>Cálculo da locação: depreciação de implementos</h2>
                    <p>Gerencie as taxas de depreciação anual (% aa) das categorias de implemento.</p>
                  </div>

                  {/* Filtros de Listagem */}
                  <div className="usuarios-filters" style={{ display: 'flex', gap: 'var(--spacing-12)', marginBottom: 'var(--spacing-20)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ width: 220 }}>
                      <Select
                        options={categoriaOptions}
                        value={filtroImpCategoria}
                        onChange={opt => {
                          setFiltroImpCategoria(opt as OptionType);
                          setPageImp(1);
                        }}
                        placeholder="Categoria (Todas)"
                      />
                    </div>
                    <div style={{ width: 160 }}>
                      <Select
                        options={PRAZO_OPTIONS}
                        value={filtroImpPrazo}
                        onChange={opt => {
                          setFiltroImpPrazo(opt as OptionType);
                          setPageImp(1);
                        }}
                        placeholder="Prazo (Todos)"
                      />
                    </div>
                    <div style={{ width: 160 }}>
                      <Select
                        options={TIPO_USO_OPTIONS}
                        value={filtroImpTipo}
                        onChange={opt => {
                          setFiltroImpTipo(opt as OptionType);
                          setPageImp(1);
                        }}
                        placeholder="Uso (Todos)"
                      />
                    </div>
                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)', marginLeft: 'var(--spacing-8)' }}>
                      {filteredImplementoCombinations.length} combinações
                    </span>
                  </div>

                  {/* Listagem */}
                  <div className="table-container" style={{ marginBottom: 'var(--spacing-20)' }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th style={{ width: '40%' }}>Categoria</th>
                          <th style={{ width: '20%' }}>Prazo</th>
                          <th style={{ width: '20%' }}>Tipo</th>
                          <th style={{ width: '12%' }}>% aa</th>
                          {!isReadOnly && <th style={{ width: '8%', textAlign: 'right' }}>Ações</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedImplementos.length === 0 ? (
                          <tr>
                            <td colSpan={isReadOnly ? 4 : 5} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-450)' }}>
                              Nenhuma depreciação de implemento encontrada com os filtros selecionados.
                            </td>
                          </tr>
                        ) : (
                          paginatedImplementos.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: 600, color: 'var(--color-grey-800)' }}>{item.categoria_nome}</td>
                              <td>{item.prazo} meses</td>
                              <td>{item.tipo_uso}</td>
                              <td>{item.depreciacao_anual_percentual > 0 ? formatPercent(item.depreciacao_anual_percentual) : '-'}</td>
                              {!isReadOnly && (
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    className="action-btn action-btn-edit"
                                    onClick={() => handleOpenEditDeprImp(item)}
                                    title="Editar depreciação"
                                  >
                                    <Pencil size={16} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>

                    {/* Paginação */}
                    <Pagination
                      currentPage={pageImp}
                      totalCount={filteredImplementoCombinations.length}
                      itemsPerPage={10}
                      onPageChange={setPageImp}
                      itemLabel="combinações"
                    />
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* MODAL: EDITAR FINANCIAMENTO */}
      <Modal
        open={modalFinanciamentoOpen}
        onClose={() => setModalFinanciamentoOpen(false)}
        title="Editar taxa de financiamento"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-12)' }}>
            <Button variant="secondary" onClick={() => setModalFinanciamentoOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveTaxaFinanciamento} loading={saving}>
              Salvar
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-16)' }}>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-600)' }}>
            Modifique a taxa de juros mensal para o prazo de <strong>{editingTaxa?.prazo} meses</strong>.
          </p>
          <Input
            label="Juros mensal (%)"
            value={formTaxaJuros}
            onChange={e => setFormTaxaJuros(e.target.value)}
            placeholder="Ex: 1,01"
            required
            autoFocus
          />
        </div>
      </Modal>

      {/* MODAL: EDITAR DEPRECIAÇÃO CAMINHÃO */}
      <Modal
        open={modalCaminhaoOpen}
        onClose={() => setModalCaminhaoOpen(false)}
        title="Editar depreciação de caminhão"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-12)' }}>
            <Button variant="secondary" onClick={() => setModalCaminhaoOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveDeprCam} loading={saving}>
              Salvar
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-16)' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-600)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span><strong>Modelo:</strong> {editingDeprCam?.modelo} ({editingDeprCam?.familia})</span>
            <span><strong>Prazo:</strong> {editingDeprCam?.prazo} meses</span>
            <span><strong>Tipo de Uso:</strong> {editingDeprCam?.tipo_uso}</span>
          </div>
          <Input
            label="Depreciação anual (% aa)"
            value={formDeprCamTaxa}
            onChange={e => setFormDeprCamTaxa(e.target.value)}
            placeholder="Ex: 12,50"
            required
            autoFocus
          />
        </div>
      </Modal>

      {/* MODAL: EDITAR DEPRECIAÇÃO IMPLEMENTO */}
      <Modal
        open={modalImplementoOpen}
        onClose={() => setModalImplementoOpen(false)}
        title="Editar depreciação de implemento"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-12)' }}>
            <Button variant="secondary" onClick={() => setModalImplementoOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveDeprImp} loading={saving}>
              Salvar
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-16)' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-600)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span><strong>Categoria:</strong> {editingDeprImp?.categoria_nome}</span>
            <span><strong>Prazo:</strong> {editingDeprImp?.prazo} meses</span>
            <span><strong>Tipo de Uso:</strong> {editingDeprImp?.tipo_uso}</span>
          </div>
          <Input
            label="Depreciação anual (% aa)"
            value={formDeprImpTaxa}
            onChange={e => setFormDeprImpTaxa(e.target.value)}
            placeholder="Ex: 12,50"
            required
            autoFocus
          />
        </div>
      </Modal>

    </DashboardLayout>
  );
}
