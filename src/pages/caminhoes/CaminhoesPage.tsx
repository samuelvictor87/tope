// pages/caminhoes/CaminhoesPage.tsx — Módulo de Caminhões TOPE
import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash, Funnel, ArrowsLeftRight } from '@phosphor-icons/react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
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
  transmission: string;
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

// Dados Iniciais extraídos do Print do Usuário
const INITIAL_CAMINHOES: Caminhao[] = [
  {
    id: '1',
    createdAt: '03/11/2025',
    family: 'Constellation',
    model: '31-320 DC V-Tronic 6x4',
    transmission: 'Automatizada',
    wheelbases: [
      { dimension: '3440', price: '560000', curbWeight: '4100', technicalPbt: '23000', homologatedPbt: '23000', homologatedPbtc: '42000', priceValidity: '03/11/2025' },
      { dimension: '4580', price: '570000', curbWeight: '4300', technicalPbt: '23000', homologatedPbt: '23000', homologatedPbtc: '42000', priceValidity: '03/11/2025' }
    ]
  },
  {
    id: '2',
    createdAt: '03/11/2025',
    family: 'Constellation',
    model: '30-320 SC V-Tronic 8x2',
    transmission: 'Automatizada',
    wheelbases: [
      { dimension: '6100', price: '574000', curbWeight: '4200', technicalPbt: '29000', homologatedPbt: '29000', homologatedPbtc: '54000', priceValidity: '03/11/2025' },
      { dimension: '6500', price: '574000', curbWeight: '4300', technicalPbt: '29000', homologatedPbt: '29000', homologatedPbtc: '54000', priceValidity: '03/11/2025' }
    ]
  },
  {
    id: '3',
    createdAt: '03/11/2025',
    family: 'Constellation',
    model: '27-260 DC 6x4',
    transmission: 'Manual',
    wheelbases: [
      { dimension: '4800', price: '489000', curbWeight: '4000', technicalPbt: '23000', homologatedPbt: '23000', homologatedPbtc: '42000', priceValidity: '03/11/2025' },
      { dimension: '5940', price: '499000', curbWeight: '4200', technicalPbt: '23000', homologatedPbt: '23000', homologatedPbtc: '42000', priceValidity: '03/11/2025' }
    ]
  },
  {
    id: '4',
    createdAt: '03/11/2025',
    family: 'Constellation',
    model: '26-320 SC V-Tronic',
    transmission: 'Automatizada',
    wheelbases: [
      { dimension: '5207', price: '502000', curbWeight: '4100', technicalPbt: '23000', homologatedPbt: '23000', homologatedPbtc: '42000', priceValidity: '03/11/2025' }
    ]
  },
  {
    id: '5',
    createdAt: '03/11/2025',
    family: 'Constellation',
    model: '26-320 SC V-Tronic',
    transmission: 'Automatizada',
    wheelbases: [
      { dimension: '4800', price: '502000', curbWeight: '4100', technicalPbt: '23000', homologatedPbt: '23000', homologatedPbtc: '42000', priceValidity: '03/11/2025' },
      { dimension: '5207', price: '502000', curbWeight: '4200', technicalPbt: '23000', homologatedPbt: '23000', homologatedPbtc: '42000', priceValidity: '03/11/2025' }
    ]
  },
  {
    id: '6',
    createdAt: '03/11/2025',
    family: 'Constellation',
    model: '26-320 SC',
    transmission: 'Manual',
    wheelbases: [
      { dimension: '4800', price: '487000', curbWeight: '4000', technicalPbt: '23000', homologatedPbt: '23000', homologatedPbtc: '42000', priceValidity: '03/11/2025' },
      { dimension: '5207', price: '487000', curbWeight: '4100', technicalPbt: '23000', homologatedPbt: '23000', homologatedPbtc: '42000', priceValidity: '03/11/2025' }
    ]
  },
  {
    id: '7',
    createdAt: '03/11/2025',
    family: 'Constellation',
    model: '26-320 DC V-Tronic',
    transmission: 'Automática',
    wheelbases: [
      { dimension: '4800', price: '492000', curbWeight: '4100', technicalPbt: '23000', homologatedPbt: '23000', homologatedPbtc: '42000', priceValidity: '03/11/2025' },
      { dimension: '5207', price: '492000', curbWeight: '4200', technicalPbt: '23000', homologatedPbt: '23000', homologatedPbtc: '42000', priceValidity: '03/11/2025' }
    ]
  },
  {
    id: '8',
    createdAt: '03/11/2025',
    family: 'Constellation',
    model: '26-320 DC',
    transmission: 'Manual',
    wheelbases: [
      { dimension: '4800', price: '477000', curbWeight: '4000', technicalPbt: '23000', homologatedPbt: '23000', homologatedPbtc: '42000', priceValidity: '03/11/2025' },
      { dimension: '5207', price: '477000', curbWeight: '4100', technicalPbt: '23000', homologatedPbt: '23000', homologatedPbtc: '42000', priceValidity: '03/11/2025' }
    ]
  },
  {
    id: '9',
    createdAt: '03/11/2025',
    family: 'Constellation',
    model: '25-480 HD SC',
    transmission: 'Automatizada',
    wheelbases: [
      { dimension: '3600', price: '628000', curbWeight: '4100', technicalPbt: '23000', homologatedPbt: '23000', homologatedPbtc: '42000', priceValidity: '03/11/2025' }
    ]
  },
  {
    id: '10',
    createdAt: '03/11/2025',
    family: 'Constellation',
    model: '20-480 SC',
    transmission: 'Automatizada',
    wheelbases: [
      { dimension: '3600', price: '599900', curbWeight: '4100', technicalPbt: '20000', homologatedPbt: '20000', homologatedPbtc: '38000', priceValidity: '03/11/2025' }
    ]
  },
  {
    id: '11',
    createdAt: '03/11/2025',
    family: 'Constellation',
    model: '19-380 SCv',
    transmission: 'Automatizada',
    wheelbases: [
      { dimension: '3560', price: '525000', curbWeight: '4000', technicalPbt: '19000', homologatedPbt: '19000', homologatedPbtc: '35000', priceValidity: '03/11/2025' }
    ]
  },
  {
    id: '12',
    createdAt: '03/11/2025',
    family: 'Constellation',
    model: '17-210',
    transmission: 'Manual',
    wheelbases: [
      { dimension: '4800', price: '395000', curbWeight: '3800', technicalPbt: '16000', homologatedPbt: '16000', homologatedPbtc: '30000', priceValidity: '03/11/2025' },
      { dimension: '5207', price: '395000', curbWeight: '3900', technicalPbt: '16000', homologatedPbt: '16000', homologatedPbtc: '30000', priceValidity: '03/11/2025' }
    ]
  },
  {
    id: '13',
    createdAt: '03/11/2025',
    family: 'Constellation',
    model: '14-210',
    transmission: 'Manual',
    wheelbases: [
      { dimension: '4800', price: '385000', curbWeight: '3700', technicalPbt: '14000', homologatedPbt: '14000', homologatedPbtc: '28000', priceValidity: '03/11/2025' },
      { dimension: '5207', price: '385000', curbWeight: '3800', technicalPbt: '14000', homologatedPbt: '14000', homologatedPbtc: '28000', priceValidity: '03/11/2025' }
    ]
  }
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
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>(INITIAL_CAMINHOES);
  const [isFormMode, setIsFormMode] = useState(false);
  const [editingCaminhao, setEditingCaminhao] = useState<Caminhao | null>(null);
  
  // Filtros
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFamily, setFilterFamily] = useState<OptionType | null>({ value: 'Todos', label: 'Família (Todas)' });

  // Formulário - Ficha Técnica
  const [formFamily, setFormFamily] = useState<OptionType | null>(null);
  const [formModel, setFormModel] = useState('');
  const [formTransmission, setFormTransmission] = useState<OptionType | null>(null);

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

  // Filtragem Dinâmica da Tabela
  const filteredCaminhoes = useMemo(() => {
    return caminhoes.filter(cam => {
      const matchesSearch = cam.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            cam.family.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFamily = !filterFamily || filterFamily.value === 'Todos' || cam.family === filterFamily.value;
      return matchesSearch && matchesFamily;
    });
  }, [caminhoes, searchTerm, filterFamily]);

  // Transição de Telas
  const handleOpenCreateForm = () => {
    setEditingCaminhao(null);
    setFormFamily(null);
    setFormModel('');
    setFormTransmission(null);
    setFormWheelbases([]);
    clearWbFields();
    setIsFormMode(true);
  };

  const handleOpenEditForm = (cam: Caminhao) => {
    setEditingCaminhao(cam);
    setFormFamily({ value: cam.family, label: cam.family });
    setFormModel(cam.model);
    setFormTransmission({ value: cam.transmission, label: cam.transmission });
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
  const handleSaveCaminhao = () => {
    if (!formFamily || !formModel.trim() || !formTransmission) {
      toast.error('Ficha técnica incompleta', 'Preencha a família, modelo e transmissão do caminhão.');
      return;
    }

    if (formWheelbases.length === 0) {
      toast.error('Nenhum entre-eixo', 'Associe pelo menos um entre-eixo ao caminhão.');
      return;
    }

    if (editingCaminhao) {
      // Editar
      setCaminhoes(prev => prev.map(c => c.id === editingCaminhao.id ? {
        ...c,
        family: formFamily.value,
        model: formModel.trim(),
        transmission: formTransmission.value,
        wheelbases: formWheelbases
      } : c));
      toast.success('Caminhão atualizado com sucesso!');
    } else {
      // Criar novo
      const newCam: Caminhao = {
        id: Math.random().toString(36).slice(2),
        createdAt: new Date().toLocaleDateString('pt-BR'),
        family: formFamily.value,
        model: formModel.trim(),
        transmission: formTransmission.value,
        wheelbases: formWheelbases
      };
      setCaminhoes(prev => [newCam, ...prev]);
      toast.success('Novo caminhão registrado com sucesso!');
    }

    setIsFormMode(false);
  };

  // Exclusão
  const handleOpenDelete = (id: string, model: string) => {
    setCaminhaoToDelete({ id, model });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!caminhaoToDelete) return;
    setCaminhoes(prev => prev.filter(c => c.id !== caminhaoToDelete.id));
    toast.success('Caminhão excluído', `O modelo "${caminhaoToDelete.model}" foi removido com sucesso.`);
    setDeleteConfirmOpen(false);
    setCaminhaoToDelete(null);
  };

  return (
    <DashboardLayout pageTitle="Caminhões">
      {!isFormMode ? (
        <>
          {/* TÍTULO E AÇÕES DA PÁGINA */}
          <div className="caminhoes-header-section">
            <div className="caminhoes-header-title-wrapper">
              <div className="caminhoes-title-row">
                <h2>Gestão dos caminhões</h2>
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)', fontWeight: 500 }}>
                  {filteredCaminhoes.length} caminhão(es)
                </span>
              </div>
              <p className="caminhoes-desc">Organize chassis e entre-eixos compatíveis.</p>
            </div>
            <div className="caminhoes-header-actions">
              <Button
                variant="secondary"
                onClick={() => setFiltersOpen(!filtersOpen)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
              >
                <Funnel size={16} />
                Filtros
              </Button>
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

          {/* FILTROS COLAPSÁVEIS */}
          {filtersOpen && (
            <div
              className="caminhoes-filters"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-12)',
                marginBottom: 'var(--spacing-24)',
                flexWrap: 'wrap',
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
                  onChange={opt => setFilterFamily(opt as OptionType)}
                  placeholder="Família (Todas)"
                />
              </div>
            </div>
          )}

          {/* TABELA DE LISTAGEM */}
          <div className="table-container" style={{ marginBottom: 'var(--spacing-24)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '12%' }}>Data</th>
                  <th style={{ width: '18%' }}>Família</th>
                  <th style={{ width: '25%' }}>Modelo</th>
                  <th style={{ width: '15%' }}>Transmissão</th>
                  <th style={{ width: '12%' }}>Entre-eixos</th>
                  <th style={{ width: '13%' }}>Preços</th>
                  <th style={{ width: '5%', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredCaminhoes.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                      Nenhum caminhão registrado.
                    </td>
                  </tr>
                ) : (
                  filteredCaminhoes.map(cam => (
                    <tr key={cam.id}>
                      <td>{cam.createdAt}</td>
                      <td>{cam.family}</td>
                      <td style={{ fontWeight: 600, color: 'var(--color-grey-800)' }}>{cam.model}</td>
                      <td>{cam.transmission}</td>
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
              <Button variant="primary" onClick={handleSaveCaminhao}>
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
                placeholder="Selecione a transmissão..."
                options={TRANSMISSION_OPTIONS}
                value={formTransmission}
                onChange={opt => setFormTransmission(opt as OptionType)}
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
