// pages/caminhoes/CaminhoesPage.tsx — Módulo de Caminhões TOPE
import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash, ArrowsLeftRight } from '@phosphor-icons/react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Pagination } from '../../components/ui/Pagination';
import { supabase } from '../../lib/supabase';
import '../../styles/components/caminhoes.css';
import '../../styles/components/table.css';

// Interfaces
interface Wheelbase {
  dimension: string; // e.g., "3400"
  price: string;      // e.g., "560000"
  curbWeight: string; // Peso ordem de marcha (Kg)
  technicalPbt: string; // PBT técnico
  homologatedPbt: string; // PBT homologado
  homologatedPbtc: string; // PBTC homologado
  priceValidity: string; // Vigência preço
}

interface Caminhao {
  id: string;
  createdAt: string;
  family: string;
  model: string;
  transmission: string[];
  wheelbases: Wheelbase[];
}

// Opções estáticas para Selects
const FAMILY_OPTIONS: OptionType[] = [
  { value: 'Constellation', label: 'Constellation' },
  { value: 'Meteor', label: 'Meteor' },
  { value: 'Delivery', label: 'Delivery' }
];

const FILTER_FAMILY_OPTIONS: OptionType[] = [
  { value: 'Todos', label: 'Família (Todas)' },
  ...FAMILY_OPTIONS
];

const TRANSMISSION_OPTIONS: OptionType[] = [
  { value: 'Automatizada', label: 'Automatizada' },
  { value: 'Automática', label: 'Automática' },
  { value: 'Manual', label: 'Manual' }
];

// Auxiliares de formatação de moeda
const formatPrice = (val: string | number) => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(num);
};

const getPriceRange = (wheelbases: Wheelbase[]) => {
  if (!wheelbases || wheelbases.length === 0) return '-';
  const prices = wheelbases
    .map(w => parseFloat(w.price))
    .filter(p => !isNaN(p));
  if (prices.length === 0) return '-';
  
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  
  if (min === max) {
    return formatPrice(min);
  }
  return `${formatPrice(min)} - ${formatPrice(max)}`;
};

export function CaminhoesPage() {
  const toast = useToast();

  // Estados locais
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([]);
  const [isFormMode, setIsFormMode] = useState(false);
  const [editingCaminhao, setEditingCaminhao] = useState<Caminhao | null>(null);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterFamily, setFilterFamily] = useState<OptionType | null>({ value: 'Todos', label: 'Família (Todas)' });

  // Formulário - Ficha Técnica
  const [formFamily, setFormFamily] = useState<OptionType | null>(null);
  const [formModel, setFormModel] = useState('');
  const [formTransmission, setFormTransmission] = useState<OptionType[] | null>(null);

  // Formulário - Lista de Entre-eixos Vinculados
  const [formWheelbases, setFormWheelbases] = useState<Wheelbase[]>([]);

  // Formulário - Campos Temporários para o Novo Entre-eixos (Direita)
  const [wbDimension, setWbDimension] = useState('');
  const [wbPrice, setWbPrice] = useState('');
  const [wbCurbWeight, setWbCurbWeight] = useState('');
  const [wbTechnicalPbt, setWbTechnicalPbt] = useState('');
  const [wbHomologatedPbt, setWbHomologatedPbt] = useState('');
  const [wbHomologatedPbtc, setWbHomologatedPbtc] = useState('');
  const [wbPriceValidity, setWbPriceValidity] = useState('');

  // Confirmação de Exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [caminhaoToDelete, setCaminhaoToDelete] = useState<{ id: string; model: string } | null>(null);

  // Estados de Carregamento e Paginação
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 10;

  // Carregar Caminhões do Supabase
  const loadCaminhoes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('caminhoes')
        .select('*, caminhoes_entre_eixos(*)', { count: 'exact' });

      if (debouncedSearch.trim()) {
        const term = `%${debouncedSearch.trim()}%`;
        query = query.or(`modelo.ilike.${term},familia.ilike.${term}`);
      }

      if (filterFamily && filterFamily.value !== 'Todos') {
        query = query.eq('familia', filterFamily.value);
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.order('criado_em', { ascending: false }).range(from, to);

      const { data, error, count } = await query;

      if (error) {
        toast.error('Erro ao carregar caminhões', error.message);
      } else if (data) {
        const mapped = data.map((item: any) => ({
          id: item.id,
          createdAt: new Date(item.criado_em).toLocaleDateString('pt-BR'),
          family: item.familia,
          model: item.modelo,
          transmission: Array.isArray(item.transmissao) ? item.transmissao : [item.transmissao],
          wheelbases: (item.caminhoes_entre_eixos || []).map((w: any) => ({
            dimension: w.dimensao,
            price: w.preco,
            curbWeight: w.peso_ordem_marcha || '0',
            technicalPbt: w.pbt_tecnico || '0',
            homologatedPbt: w.pbt_homologado || '0',
            homologatedPbtc: w.pbtc_homologado || '0',
            priceValidity: w.vigencia_preco || ''
          }))
        }));
        setCaminhoes(mapped);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Erro inesperado ao buscar caminhões:', err);
    } finally {
      setLoading(false);
    }
  };

  // Debounce para busca textual
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Carregar caminhões quando a página ou filtro mudam
  useEffect(() => {
    loadCaminhoes();
  }, [currentPage, filterFamily, debouncedSearch]);

  // Transição de Telas
  const handleOpenCreateForm = () => {
    setEditingCaminhao(null);
    setFormFamily(null);
    setFormModel('');
    setFormTransmission([]);
    setFormWheelbases([]);
    clearWbFields();
    setIsFormMode(true);
  };

  const handleOpenEditForm = (cam: Caminhao) => {
    setEditingCaminhao(cam);
    setFormFamily({ value: cam.family, label: cam.family });
    setFormModel(cam.model);
    const transArray = Array.isArray(cam.transmission) ? cam.transmission : [cam.transmission];
    setFormTransmission(transArray.map(t => ({ value: t, label: t })));
    setFormWheelbases(cam.wheelbases);
    clearWbFields();
    setIsFormMode(true);
  };

  const clearWbFields = () => {
    setWbDimension('');
    setWbPrice('');
    setWbCurbWeight('');
    setWbTechnicalPbt('');
    setWbHomologatedPbt('');
    setWbHomologatedPbtc('');
    setWbPriceValidity('');
  };

  // Adicionar Entre-eixo temporário
  const handleAddWheelbase = () => {
    if (!wbDimension.trim() || !wbPrice.trim()) {
      toast.error('Campos obrigatórios', 'Por favor, preencha pelo menos a dimensão e o preço do entre-eixo.');
      return;
    }

    const newWb: Wheelbase = {
      dimension: wbDimension.trim(),
      price: wbPrice.trim(),
      curbWeight: wbCurbWeight.trim() || '0',
      technicalPbt: wbTechnicalPbt.trim() || '0',
      homologatedPbt: wbHomologatedPbt.trim() || '0',
      homologatedPbtc: wbHomologatedPbtc.trim() || '0',
      priceValidity: wbPriceValidity.trim() || new Date().toLocaleDateString('pt-BR')
    };

    setFormWheelbases(prev => [...prev, newWb]);
    clearWbFields();
    toast.success('Entre-eixo adicionado à lista com sucesso!');
  };

  const handleRemoveWheelbase = (idx: number) => {
    setFormWheelbases(prev => prev.filter((_, i) => i !== idx));
    toast.info('Entre-eixo removido da lista.');
  };

  // Salvar Caminhão
  const handleSaveCaminhao = async () => {
    if (!formFamily || !formModel.trim() || !formTransmission || formTransmission.length === 0) {
      toast.error('Ficha técnica incompleta', 'Preencha a família, modelo e pelo menos uma transmissão do caminhão.');
      return;
    }

    if (formWheelbases.length === 0) {
      toast.error('Nenhum entre-eixo', 'Associe pelo menos um entre-eixo ao caminhão.');
      return;
    }

    setSaving(true);
    try {
      const dataCaminhao = {
        familia: formFamily.value,
        modelo: formModel.trim(),
        transmissao: formTransmission.map(opt => opt.value)
      };

      let caminhaoId = '';

      if (editingCaminhao) {
        caminhaoId = editingCaminhao.id;
        // 1. Atualizar caminhão
        const { error: camError } = await supabase
          .from('caminhoes')
          .update(dataCaminhao)
          .eq('id', caminhaoId);

        if (camError) throw camError;

        // 2. Remover entre-eixos anteriores
        const { error: delError } = await supabase
          .from('caminhoes_entre_eixos')
          .delete()
          .eq('caminhao_id', caminhaoId);

        if (delError) throw delError;
      } else {
        // 1. Inserir novo caminhão
        const { data: camData, error: camError } = await supabase
          .from('caminhoes')
          .insert([dataCaminhao])
          .select()
          .single();

        if (camError) throw camError;
        caminhaoId = camData.id;
      }

      // 2. Inserir os novos entre-eixos
      const wbRows = formWheelbases.map(wb => ({
        caminhao_id: caminhaoId,
        dimensao: wb.dimension,
        preco: wb.price,
        peso_ordem_marcha: wb.curbWeight,
        pbt_tecnico: wb.technicalPbt,
        pbt_homologado: wb.homologatedPbt,
        pbtc_homologado: wb.homologatedPbtc,
        vigencia_preco: wb.priceValidity
      }));

      const { error: wbError } = await supabase
        .from('caminhoes_entre_eixos')
        .insert(wbRows);

      if (wbError) throw wbError;

      toast.success(editingCaminhao ? 'Caminhão atualizado com sucesso!' : 'Novo caminhão registrado com sucesso!');
      setIsFormMode(false);
      loadCaminhoes();
    } catch (error: any) {
      console.error('Erro ao salvar caminhão:', error);
      toast.error('Erro ao salvar', error.message || 'Houve um erro desconhecido.');
    } finally {
      setSaving(false);
    }
  };

  // Exclusão
  const handleOpenDelete = (id: string, model: string) => {
    setCaminhaoToDelete({ id, model });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!caminhaoToDelete) return;
    try {
      const { error } = await supabase
        .from('caminhoes')
        .delete()
        .eq('id', caminhaoToDelete.id);

      if (error) {
        toast.error('Erro ao excluir caminhão', error.message);
      } else {
        toast.success('Caminhão excluído', `O modelo "${caminhaoToDelete.model}" foi removido com sucesso.`);
        loadCaminhoes();
      }
    } catch (err: any) {
      console.error('Erro ao excluir caminhão:', err);
      toast.error('Erro inesperado', err.message || 'Não foi possível excluir o caminhão.');
    } finally {
      setDeleteConfirmOpen(false);
      setCaminhaoToDelete(null);
    }
  };

  return (
    <DashboardLayout
      pageTitle="Caminhões"
      pageSubtitle="Organize chassis e entre-eixos compatíveis."
    >
      {!isFormMode ? (
        <>
          {/* Barra de Filtros — Alinhada e Estilizada */}
          <div
            className="usuarios-filters"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-12)',
              marginBottom: 'var(--spacing-24)',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ width: 280 }}>
              <Input
                type="text"
                placeholder="Buscar por modelo ou família..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ height: 38 }}
              />
            </div>
            <div style={{ width: 200 }}>
              <Select
                options={FILTER_FAMILY_OPTIONS}
                value={filterFamily}
                onChange={opt => {
                  setFilterFamily(opt as OptionType);
                  setCurrentPage(1);
                }}
                placeholder="Família (Todas)"
              />
            </div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)', marginLeft: 'var(--spacing-8)' }}>
              {totalCount} {totalCount === 1 ? 'caminhão' : 'caminhões'}
            </span>

            {/* Botão Novo Caminhão alinhado à direita */}
            <div style={{ marginLeft: 'auto' }}>
              <Button
                variant="primary"
                onClick={handleOpenCreateForm}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
              >
                <Plus size={16} weight="bold" />
                Novo caminhão
              </Button>
            </div>
          </div>

          {/* TABELA DE LISTAGEM */}
          <div className="table-container" style={{ marginBottom: 'var(--spacing-24)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '10%' }}>Data</th>
                  <th style={{ width: '15%' }}>Família</th>
                  <th style={{ width: '25%' }}>Modelo</th>
                  <th style={{ width: '15%' }}>Transmissão</th>
                  <th style={{ width: '12%' }}>Entre-eixos</th>
                  <th style={{ width: '13%' }}>Preços</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                      Carregando caminhões...
                    </td>
                  </tr>
                ) : caminhoes && caminhoes.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                      Nenhum caminhão registrado.
                    </td>
                  </tr>
                ) : (
                  caminhoes.map(cam => (
                    <tr key={cam.id}>
                      <td>{cam.createdAt}</td>
                      <td>{cam.family}</td>
                      <td style={{ fontWeight: 600, color: 'var(--color-grey-800)' }}>{cam.model}</td>
                      <td>{Array.isArray(cam.transmission) ? cam.transmission.join(', ') : cam.transmission}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {cam.wheelbases.map(w => (
                            <Badge key={w.dimension} variant="neutral">
                              {w.dimension}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{getPriceRange(cam.wheelbases)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button
                            className="action-btn action-btn-edit"
                            onClick={() => handleOpenEditForm(cam)}
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="action-btn action-btn-delete"
                            onClick={() => handleOpenDelete(cam.id, cam.model)}
                            title="Excluir"
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            
            {/* Paginação embutida na tabela */}
            <Pagination
              currentPage={currentPage}
              totalCount={totalCount}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
              itemLabel="caminhões"
            />
          </div>
        </>
      ) : (
        /* FORMULÁRIO DE CADASTRO / EDIÇÃO COMPLETO */
        <div className="caminhao-form-container">
          <div className="caminhao-form-header">
            <div className="caminhao-form-title-wrapper">
              <h3>{editingCaminhao ? 'Editar caminhão' : 'Novo caminhão'}</h3>
              <p>Forneça as informações cadastrais.</p>
            </div>
            <div className="caminhao-form-actions">
              <Button variant="secondary" onClick={() => setIsFormMode(false)}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={handleSaveCaminhao} loading={saving}>
                Salvar
              </Button>
            </div>
          </div>

          <div className="caminhao-form-grid">
            {/* Ficha Técnica (Esquerda) */}
            <div className="caminhao-fiche-tecnica-section">
              <h4 className="caminhao-fiche-tecnica-title">Ficha técnica</h4>
              
              <Select
                label="Família"
                placeholder="Selecione a família..."
                options={FAMILY_OPTIONS}
                value={formFamily}
                onChange={opt => setFormFamily(opt as OptionType)}
              />

              <Input
                label="Modelo"
                placeholder="Digite o modelo..."
                value={formModel}
                onChange={e => setFormModel(e.target.value)}
                required
              />

              <Select
                label="Transmissão"
                placeholder="Selecione as transmissões..."
                options={TRANSMISSION_OPTIONS}
                value={formTransmission}
                onChange={opt => setFormTransmission(opt as OptionType[])}
                isMulti
              />
            </div>

            {/* Novo Entre-Eixos e Compatibilidade (Direita) */}
            <div>
              <div className="caminhao-wheelbase-card">
                <div className="caminhao-wheelbase-card-header">
                  <div className="caminhao-wheelbase-card-icon">
                    <ArrowsLeftRight size={20} />
                  </div>
                  <div className="caminhao-wheelbase-card-title-wrapper">
                    <h4>Novo entre-eixos</h4>
                    <p>Associe quantos entre-eixos necessários para este modelo de caminhão.</p>
                  </div>
                </div>

                <div className="caminhao-wheelbase-card-fields">
                  <div className="caminhao-wheelbase-card-fields-row">
                    <Input
                      label="Dimensão"
                      placeholder="Ex: 3400"
                      value={wbDimension}
                      onChange={e => setWbDimension(e.target.value)}
                    />
                    <Input
                      label="Preço (R$)"
                      placeholder="Ex: 560000"
                      value={wbPrice}
                      onChange={e => setWbPrice(e.target.value)}
                    />
                  </div>

                  <Input
                    label="Peso ordem de marcha"
                    placeholder="Ex: 4100"
                    value={wbCurbWeight}
                    onChange={e => setWbCurbWeight(e.target.value)}
                  />

                  <Input
                    label="PBT técnico"
                    placeholder="Ex: 23000"
                    value={wbTechnicalPbt}
                    onChange={e => setWbTechnicalPbt(e.target.value)}
                  />

                  <Input
                    label="PBT homologado"
                    placeholder="Ex: 23000"
                    value={wbHomologatedPbt}
                    onChange={e => setWbHomologatedPbt(e.target.value)}
                  />

                  <Input
                    label="PBTC homologado"
                    placeholder="Ex: 42000"
                    value={wbHomologatedPbtc}
                    onChange={e => setWbHomologatedPbtc(e.target.value)}
                  />

                  <Input
                    label="Vigência preço"
                    placeholder="Ex: 03/11/2025"
                    value={wbPriceValidity}
                    onChange={e => setWbPriceValidity(e.target.value)}
                  />

                  <button
                    type="button"
                    className="add-wheelbase-btn"
                    onClick={handleAddWheelbase}
                  >
                    <span className="add-wheelbase-btn-checkbox">
                      <Plus size={10} weight="bold" />
                    </span>
                    Adicionar entre-eixo
                  </button>
                </div>
              </div>

              {/* LISTAGEM DOS ENTRE-EIXOS JÁ ADICIONADOS */}
              {formWheelbases.length > 0 && (
                <div className="added-wheelbases-list">
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-grey-800)', marginBottom: 4 }}>
                    Entre-eixos adicionados ({formWheelbases.length})
                  </h4>
                  {formWheelbases.map((wb, index) => (
                    <div key={index} className="added-wheelbase-item">
                      <div className="added-wheelbase-info">
                        <div className="added-wheelbase-dim-price">
                          <span className="added-wheelbase-dim">{wb.dimension} mm</span>
                          <span className="added-wheelbase-price">{formatPrice(wb.price)}</span>
                        </div>
                        <span className="added-wheelbase-specs">
                          P.O.M: {wb.curbWeight}kg | PBT Téc: {wb.technicalPbt}kg | PBT Hom: {wb.homologatedPbt}kg | PBTC: {wb.homologatedPbtc}kg
                        </span>
                      </div>
                      <button
                        type="button"
                        className="added-wheelbase-delete-btn"
                        onClick={() => handleRemoveWheelbase(index)}
                        title="Remover entre-eixo"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMAÇÃO DE EXCLUSÃO */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Caminhão"
        message={
          <>
            Tem certeza que deseja excluir o modelo <strong>{caminhaoToDelete?.model}</strong>?
          </>
        }
        subMessage="Todos os entre-eixos e preços associados a este caminhão serão perdidos."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
    </DashboardLayout>
  );
}
