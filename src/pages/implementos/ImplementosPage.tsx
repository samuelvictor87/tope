// pages/implementos/ImplementosPage.tsx — Módulo de Implementos TOPE
import React, { useState, useMemo } from 'react';
import { Plus, Pencil, Trash, Funnel } from '@phosphor-icons/react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { MultiSelect } from '../../components/ui/MultiSelect';
import { Drawer } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import '../../styles/components/implementos.css';
import '../../styles/components/table.css';

// Interfaces
interface Categoria {
  id: string;
  createdAt: string;
  name: string;
  attributes: string[]; // nomes dos atributos vinculados
}

interface Atributo {
  id: string;
  createdAt: string;
  categoryName: string;
  name: string;
  options: string[]; // nomes das opções associadas
}

interface OpcaoAtributo {
  id: string;
  createdAt: string;
  categoryName: string;
  attributeName: string;
  name: string;
  weight: string; // Peso (Kg)
  wheelbases: string[]; // Entre eixos compatíveis
}

// Dados Iniciais Baseados nos Prints
const INITIAL_CATEGORIAS: Categoria[] = [
  { id: 'c1', createdAt: '25/08/2025', name: 'Pipa', attributes: ['Capacidade', 'Tipo de Líquido'] },
  { id: 'c2', createdAt: '26/05/2025', name: 'Munck', attributes: ['Capacidade'] },
  { id: 'c3', createdAt: '25/05/2025', name: 'Poliguindaste', attributes: ['Braço Articulado'] },
  { id: 'c4', createdAt: '25/05/2025', name: 'Furgão Baú', attributes: ['Modelo', 'Tipo de Baú', 'Tamanho', 'Tipo'] }
];

const INITIAL_ATRIBUTOS: Atributo[] = [
  { id: 'a1', createdAt: '23/11/2025', categoryName: 'Furgão Baú', name: 'Tipo', options: [] },
  { id: 'a2', createdAt: '23/11/2025', categoryName: 'Furgão Baú', name: 'Tamanho', options: [] },
  { id: 'a3', createdAt: '25/08/2025', categoryName: 'Pipa', name: 'Tipo de Líquido', options: ['Combustível'] },
  { id: 'a4', createdAt: '25/08/2025', categoryName: 'Pipa', name: 'Capacidade', options: ['10000L'] },
  { id: 'a5', createdAt: '27/05/2025', categoryName: 'Furgão Baú', name: 'Tipo de Baú', options: ['Aço'] },
  { id: 'a6', createdAt: '26/05/2025', categoryName: 'Munck', name: 'Capacidade', options: ['30 tons', '6 tons'] },
  { id: 'a7', createdAt: '25/05/2025', categoryName: 'Furgão Baú', name: 'Modelo', options: ['Comum 7m', 'Comum 8,5m', 'Sider 8,5m', 'Sider 7m'] },
  { id: 'a8', createdAt: '25/05/2025', categoryName: 'Poliguindaste', name: 'Braço Articulado', options: ['Simples', 'Duplo', 'Triplo'] }
];

const INITIAL_OPCOES: OpcaoAtributo[] = [
  { id: 'o1', createdAt: '25/08/2025', categoryName: 'Pipa', attributeName: 'Tipo de Líquido', name: 'Combustível', weight: '100', wheelbases: ['3400', '4000', '4400', '4600', '3560', '4800', '5207'] },
  { id: 'o2', createdAt: '25/08/2025', categoryName: 'Pipa', attributeName: 'Capacidade', name: '10000L', weight: '900', wheelbases: ['3400', '4000', '4400', '4600', '3560', '4800', '5207'] },
  { id: 'o3', createdAt: '27/05/2025', categoryName: 'Furgão Baú', attributeName: 'Tipo de Baú', name: 'Aço', weight: '0', wheelbases: ['3400', '4000', '5207'] },
  { id: 'o4', createdAt: '26/05/2025', categoryName: 'Munck', attributeName: 'Capacidade', name: '6 tons', weight: '600', wheelbases: ['3400', '4600'] },
  { id: 'o5', createdAt: '26/05/2025', categoryName: 'Munck', attributeName: 'Capacidade', name: '30 tons', weight: '1.000', wheelbases: ['3400', '4000', '4400', '4600', '3560', '4800', '5207'] },
  { id: 'o6', createdAt: '25/05/2025', categoryName: 'Poliguindaste', attributeName: 'Braço Articulado', name: 'Triplo', weight: '4.200', wheelbases: ['3400', '4000', '4400', '4600', '3560', '4800', '5207'] },
  { id: 'o7', createdAt: '25/05/2025', categoryName: 'Furgão Baú', attributeName: 'Modelo', name: 'Sider 7m', weight: '1.870', wheelbases: ['3400', '4000', '4400', '4600', '3560', '4800', '5207'] },
  { id: 'o8', createdAt: '25/05/2025', categoryName: 'Furgão Baú', attributeName: 'Modelo', name: 'Sider 8,5m', weight: '2.700', wheelbases: ['3400', '4000', '4400', '4600', '3560', '4800', '5207'] },
  { id: 'o9', createdAt: '25/05/2025', categoryName: 'Poliguindaste', attributeName: 'Braço Articulado', name: 'Duplo', weight: '3.800', wheelbases: ['3400', '4000', '4400', '4600', '3560', '4800', '5207'] },
  { id: 'o10', createdAt: '25/05/2025', categoryName: 'Poliguindaste', attributeName: 'Braço Articulado', name: 'Simples', weight: '3.200', wheelbases: ['4000', '4400', '4800', '5207'] }
];

const WHEELBASE_OPTIONS = [
  { value: '3400', label: '3400' },
  { value: '3560', label: '3560' },
  { value: '4000', label: '4000' },
  { value: '4400', label: '4400' },
  { value: '4600', label: '4600' },
  { value: '4800', label: '4800' },
  { value: '5207', label: '5207' }
];

export function ImplementosPage() {
  const toast = useToast();
  
  // Abas
  const [activeTab, setActiveTab] = useState<'categorias' | 'atributos' | 'opcoes'>('categorias');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Estados dos Dados
  const [categorias, setCategorias] = useState<Categoria[]>(INITIAL_CATEGORIAS);
  const [atributos, setAtributos] = useState<Atributo[]>(INITIAL_ATRIBUTOS);
  const [opcoes, setOpcoes] = useState<OpcaoAtributo[]>(INITIAL_OPCOES);

  // Estados de Filtros
  const [searchCategory, setSearchCategory] = useState('');
  const [searchAttribute, setSearchAttribute] = useState('');
  const [filterAttrCategory, setFilterAttrCategory] = useState<OptionType | null>({ value: 'Todos', label: 'Categoria (Todas)' });
  const [searchOption, setSearchOption] = useState('');
  const [filterOptCategory, setFilterOptCategory] = useState<OptionType | null>({ value: 'Todos', label: 'Categoria (Todas)' });
  const [filterOptAttribute, setFilterOptAttribute] = useState<OptionType | null>({ value: 'Todos', label: 'Atributo (Todos)' });

  // Controles de Drawers
  const [drawerCategoryOpen, setDrawerCategoryOpen] = useState(false);
  const [drawerAttributeOpen, setDrawerAttributeOpen] = useState(false);
  const [drawerOptionOpen, setDrawerOptionOpen] = useState(false);

  // Entidades em Edição
  const [editingCategory, setEditingCategory] = useState<Categoria | null>(null);
  const [editingAttribute, setEditingAttribute] = useState<Atributo | null>(null);
  const [editingOption, setEditingOption] = useState<OpcaoAtributo | null>(null);

  // Controles de Modais de Confirmação
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: 'categoria' | 'atributo' | 'opcao' } | null>(null);

  // Form Fields - Categoria
  const [formCategoryName, setFormCategoryName] = useState('');
  const [formCategoryAttributes, setFormCategoryAttributes] = useState<string[]>([]);

  // Form Fields - Atributo
  const [formAttributeCategory, setFormAttributeCategory] = useState<OptionType | null>(null);
  const [formAttributeName, setFormAttributeName] = useState('');

  // Form Fields - Opções
  const [formOptionCategory, setFormOptionCategory] = useState<OptionType | null>(null);
  const [formOptionAttribute, setFormOptionAttribute] = useState<OptionType | null>(null);
  const [formOptionName, setFormOptionName] = useState('');
  const [formOptionWeight, setFormOptionWeight] = useState('');
  const [formOptionWheelbases, setFormOptionWheelbases] = useState<string[]>([]);

  // Opções para Selects e MultiSelects dinâmicos
  const categoryOptions: OptionType[] = useMemo(() => {
    return categorias.map(c => ({ value: c.name, label: c.name }));
  }, [categorias]);

  const attributeOptionsForSelectedCategory: OptionType[] = useMemo(() => {
    if (!formOptionCategory) return [];
    // Filtra atributos vinculados à categoria selecionada
    return atributos
      .filter(a => a.categoryName === formOptionCategory.value)
      .map(a => ({ value: a.name, label: a.name }));
  }, [formOptionCategory, atributos]);

  // Listagens Filtradas
  const filteredCategorias = useMemo(() => {
    return categorias.filter(c => {
      const term = searchCategory.toLowerCase();
      return c.name.toLowerCase().includes(term) ||
             c.attributes.some(a => a.toLowerCase().includes(term));
    });
  }, [categorias, searchCategory]);

  const filteredAtributos = useMemo(() => {
    return atributos.filter(a => {
      const matchesSearch = a.name.toLowerCase().includes(searchAttribute.toLowerCase()) ||
                            a.categoryName.toLowerCase().includes(searchAttribute.toLowerCase());
      const matchesCategory = !filterAttrCategory || 
                              filterAttrCategory.value === 'Todos' || 
                              a.categoryName === filterAttrCategory.value;
      return matchesSearch && matchesCategory;
    });
  }, [atributos, searchAttribute, filterAttrCategory]);

  const filteredOpcoes = useMemo(() => {
    return opcoes.filter(o => {
      const matchesSearch = o.name.toLowerCase().includes(searchOption.toLowerCase()) ||
                            o.categoryName.toLowerCase().includes(searchOption.toLowerCase()) ||
                            o.attributeName.toLowerCase().includes(searchOption.toLowerCase());
      const matchesCategory = !filterOptCategory ||
                              filterOptCategory.value === 'Todos' ||
                              o.categoryName === filterOptCategory.value;
      const matchesAttribute = !filterOptAttribute ||
                               filterOptAttribute.value === 'Todos' ||
                               o.attributeName === filterOptAttribute.value;
      return matchesSearch && matchesCategory && matchesAttribute;
    });
  }, [opcoes, searchOption, filterOptCategory, filterOptAttribute]);

  // Handlers Categoria (Criar/Editar/Salvar/Excluir)
  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setFormCategoryName('');
    setFormCategoryAttributes([]);
    setDrawerCategoryOpen(true);
  };

  const handleOpenEditCategory = (c: Categoria) => {
    setEditingCategory(c);
    setFormCategoryName(c.name);
    setFormCategoryAttributes(c.attributes);
    setDrawerCategoryOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCategoryName.trim()) {
      toast.error('Campos obrigatórios', 'Por favor, preencha o nome da categoria.');
      return;
    }

    if (editingCategory) {
      // Atualiza categoria
      setCategorias(prev => prev.map(c => c.id === editingCategory.id ? { ...c, name: formCategoryName.trim(), attributes: formCategoryAttributes } : c));
      // Atualiza também nos atributos se o nome mudou
      if (editingCategory.name !== formCategoryName.trim()) {
        setAtributos(prev => prev.map(a => a.categoryName === editingCategory.name ? { ...a, categoryName: formCategoryName.trim() } : a));
        setOpcoes(prev => prev.map(o => o.categoryName === editingCategory.name ? { ...o, categoryName: formCategoryName.trim() } : o));
      }
      toast.success('Categoria atualizada com sucesso!');
    } else {
      const newCat: Categoria = {
        id: Math.random().toString(36).slice(2),
        createdAt: new Date().toLocaleDateString('pt-BR'),
        name: formCategoryName.trim(),
        attributes: formCategoryAttributes
      };
      setCategorias(prev => [newCat, ...prev]);
      toast.success('Nova categoria criada com sucesso!');
    }
    setDrawerCategoryOpen(false);
  };

  // Handlers Atributo (Criar/Editar/Salvar/Excluir)
  const handleOpenCreateAttribute = () => {
    setEditingAttribute(null);
    setFormAttributeCategory(null);
    setFormAttributeName('');
    setDrawerAttributeOpen(true);
  };

  const handleOpenEditAttribute = (a: Atributo) => {
    setEditingAttribute(a);
    setFormAttributeCategory({ value: a.categoryName, label: a.categoryName });
    setFormAttributeName(a.name);
    setDrawerAttributeOpen(true);
  };

  const handleSaveAttribute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAttributeCategory || !formAttributeName.trim()) {
      toast.error('Campos obrigatórios', 'Por favor, selecione a categoria e o nome do atributo.');
      return;
    }

    if (editingAttribute) {
      setAtributos(prev => prev.map(a => a.id === editingAttribute.id ? { ...a, categoryName: formAttributeCategory.value, name: formAttributeName.trim() } : a));
      // Atualiza também nas opções se o nome do atributo ou categoria mudou
      if (editingAttribute.name !== formAttributeName.trim() || editingAttribute.categoryName !== formAttributeCategory.value) {
        setOpcoes(prev => prev.map(o => o.attributeName === editingAttribute.name && o.categoryName === editingAttribute.categoryName ? { ...o, categoryName: formAttributeCategory.value, attributeName: formAttributeName.trim() } : o));
      }
      toast.success('Atributo atualizado com sucesso!');
    } else {
      const newAttr: Atributo = {
        id: Math.random().toString(36).slice(2),
        createdAt: new Date().toLocaleDateString('pt-BR'),
        categoryName: formAttributeCategory.value,
        name: formAttributeName.trim(),
        options: []
      };
      setAtributos(prev => [newAttr, ...prev]);

      // Atualiza os atributos vinculados na categoria correspondente
      setCategorias(prev => prev.map(c => c.name === formAttributeCategory.value ? { ...c, attributes: [...c.attributes, formAttributeName.trim()] } : c));

      toast.success('Novo atributo criado com sucesso!');
    }
    setDrawerAttributeOpen(false);
  };

  // Handlers Opção (Criar/Editar/Salvar/Excluir)
  const handleOpenCreateOption = () => {
    setEditingOption(null);
    setFormOptionCategory(null);
    setFormOptionAttribute(null);
    setFormOptionName('');
    setFormOptionWeight('');
    setFormOptionWheelbases([]);
    setDrawerOptionOpen(true);
  };

  const handleOpenEditOption = (o: OpcaoAtributo) => {
    setEditingOption(o);
    setFormOptionCategory({ value: o.categoryName, label: o.categoryName });
    setFormOptionAttribute({ value: o.attributeName, label: o.attributeName });
    setFormOptionName(o.name);
    setFormOptionWeight(o.weight);
    setFormOptionWheelbases(o.wheelbases);
    setDrawerOptionOpen(true);
  };

  const handleSaveOption = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOptionCategory || !formOptionAttribute || !formOptionName.trim()) {
      toast.error('Campos obrigatórios', 'Por favor, selecione a categoria, o atributo e o nome da opção.');
      return;
    }

    if (editingOption) {
      setOpcoes(prev => prev.map(o => o.id === editingOption.id ? {
        ...o,
        categoryName: formOptionCategory.value,
        attributeName: formOptionAttribute.value,
        name: formOptionName.trim(),
        weight: formOptionWeight.trim(),
        wheelbases: formOptionWheelbases
      } : o));
      toast.success('Opção atualizada com sucesso!');
    } else {
      const newOpt: OpcaoAtributo = {
        id: Math.random().toString(36).slice(2),
        createdAt: new Date().toLocaleDateString('pt-BR'),
        categoryName: formOptionCategory.value,
        attributeName: formOptionAttribute.value,
        name: formOptionName.trim(),
        weight: formOptionWeight.trim() || '0',
        wheelbases: formOptionWheelbases
      };
      setOpcoes(prev => [newOpt, ...prev]);

      // Adiciona o nome da opção na lista de opções do atributo correspondente
      setAtributos(prev => prev.map(a => a.categoryName === formOptionCategory.value && a.name === formOptionAttribute.value ? { ...a, options: [...a.options, formOptionName.trim()] } : a));

      toast.success('Nova opção criada com sucesso!');
    }
    setDrawerOptionOpen(false);
  };

  // Exclusão Unificada
  const handleOpenDelete = (id: string, name: string, type: 'categoria' | 'atributo' | 'opcao') => {
    setDeleteTarget({ id, name, type });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'categoria') {
      setCategorias(prev => prev.filter(c => c.id !== deleteTarget.id));
      toast.success('Categoria excluída com sucesso!');
    } else if (deleteTarget.type === 'atributo') {
      setAtributos(prev => prev.filter(a => a.id !== deleteTarget.id));
      toast.success('Atributo excluído com sucesso!');
    } else if (deleteTarget.type === 'opcao') {
      setOpcoes(prev => prev.filter(o => o.id !== deleteTarget.id));
      toast.success('Opção excluída com sucesso!');
    }

    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  };

  return (
    <DashboardLayout pageTitle="Implementos">
      
      {/* Título e Ações */}
      <div className="implementos-header-section">
        <div className="implementos-header-title-wrapper">
          <div className="implementos-title-row">
            <h2>Gestão dos implementos</h2>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)', fontWeight: 500 }}>
              {activeTab === 'categorias' && `${filteredCategorias.length} categoria(s)`}
              {activeTab === 'atributos' && `${filteredAtributos.length} atributo(s)`}
              {activeTab === 'opcoes' && `${filteredOpcoes.length} opção(ões)`}
            </span>
          </div>
          <p className="implementos-desc">Organize implementos e entre-eixos compatíveis.</p>
        </div>
        <div className="implementos-header-actions">
          <Button
            variant="secondary"
            onClick={() => setFiltersOpen(!filtersOpen)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
          >
            <Funnel size={16} />
            Filtros
          </Button>
          {activeTab === 'categorias' && (
            <Button
              variant="primary"
              onClick={handleOpenCreateCategory}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
            >
              <Plus size={16} weight="bold" />
              Nova categoria
            </Button>
          )}
          {activeTab === 'atributos' && (
            <Button
              variant="primary"
              onClick={handleOpenCreateAttribute}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
            >
              <Plus size={16} weight="bold" />
              Novo atributo
            </Button>
          )}
          {activeTab === 'opcoes' && (
            <Button
              variant="primary"
              onClick={handleOpenCreateOption}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
            >
              <Plus size={16} weight="bold" />
              Nova opção
            </Button>
          )}
        </div>
      </div>

      {/* Abas */}
      <div className="implementos-tabs-container">
        <div className="implementos-tabs">
          <button
            type="button"
            className={`implementos-tab-btn ${activeTab === 'categorias' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('categorias');
              setFiltersOpen(false);
            }}
          >
            Categorias
          </button>
          <button
            type="button"
            className={`implementos-tab-btn ${activeTab === 'atributos' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('atributos');
              setFiltersOpen(false);
            }}
          >
            Atributos
          </button>
          <button
            type="button"
            className={`implementos-tab-btn ${activeTab === 'opcoes' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('opcoes');
              setFiltersOpen(false);
            }}
          >
            Opções de atributos
          </button>
        </div>
      </div>

      {/* Barra de Filtros Colapsável */}
      {filtersOpen && (
        <div
          className="implementos-filters"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-12)',
            marginBottom: 'var(--spacing-24)',
            flexWrap: 'wrap',
          }}
        >
          {activeTab === 'categorias' && (
            <div style={{ width: 280 }}>
              <Input
                type="text"
                placeholder="Buscar por categoria ou atributo..."
                value={searchCategory}
                onChange={e => setSearchCategory(e.target.value)}
                style={{ height: 38 }}
              />
            </div>
          )}

          {activeTab === 'atributos' && (
            <>
              <div style={{ width: 280 }}>
                <Input
                  type="text"
                  placeholder="Buscar por atributo..."
                  value={searchAttribute}
                  onChange={e => setSearchAttribute(e.target.value)}
                  style={{ height: 38 }}
                />
              </div>
              <div style={{ width: 220 }}>
                <Select
                  options={[{ value: 'Todos', label: 'Categoria (Todas)' }, ...categoryOptions]}
                  value={filterAttrCategory}
                  onChange={(opt) => setFilterAttrCategory(opt as OptionType)}
                  placeholder="Categoria (Todas)"
                />
              </div>
            </>
          )}

          {activeTab === 'opcoes' && (
            <>
              <div style={{ width: 260 }}>
                <Input
                  type="text"
                  placeholder="Buscar por opção..."
                  value={searchOption}
                  onChange={e => setSearchOption(e.target.value)}
                  style={{ height: 38 }}
                />
              </div>
              <div style={{ width: 200 }}>
                <Select
                  options={[{ value: 'Todos', label: 'Categoria (Todas)' }, ...categoryOptions]}
                  value={filterOptCategory}
                  onChange={(opt) => {
                    setFilterOptCategory(opt as OptionType);
                    setFilterOptAttribute({ value: 'Todos', label: 'Atributo (Todos)' });
                  }}
                  placeholder="Categoria (Todas)"
                />
              </div>
              <div style={{ width: 200 }}>
                <Select
                  options={[
                    { value: 'Todos', label: 'Atributo (Todos)' },
                    ...atributos
                      .filter(a => !filterOptCategory || filterOptCategory.value === 'Todos' || a.categoryName === filterOptCategory.value)
                      .map(a => ({ value: a.name, label: a.name }))
                  ]}
                  value={filterOptAttribute}
                  onChange={(opt) => setFilterOptAttribute(opt as OptionType)}
                  placeholder="Atributo (Todos)"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Tabelas de Listagem */}
      <div className="table-container" style={{ marginBottom: 'var(--spacing-24)' }}>
        
        {/* Tabela Categorias */}
        {activeTab === 'categorias' && (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '20%' }}>Data</th>
                <th style={{ width: '40%' }}>Categoria</th>
                <th style={{ width: '30%' }}>Atributo</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategorias.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                    Nenhuma categoria encontrada.
                  </td>
                </tr>
              ) : (
                filteredCategorias.map(c => (
                  <tr key={c.id}>
                    <td>{c.createdAt}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-grey-800)' }}>{c.name}</td>
                    <td>{c.attributes.join(', ') || <span style={{ color: 'var(--color-grey-400)' }}>-</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <button
                          className="action-btn action-btn-edit"
                          onClick={() => handleOpenEditCategory(c)}
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="action-btn action-btn-delete"
                          onClick={() => handleOpenDelete(c.id, c.name, 'categoria')}
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
        )}

        {/* Tabela Atributos */}
        {activeTab === 'atributos' && (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '20%' }}>Data</th>
                <th style={{ width: '30%' }}>Categoria</th>
                <th style={{ width: '25%' }}>Atributo</th>
                <th style={{ width: '15%' }}>Opções</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredAtributos.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                    Nenhum atributo encontrado.
                  </td>
                </tr>
              ) : (
                filteredAtributos.map(a => (
                  <tr key={a.id}>
                    <td>{a.createdAt}</td>
                    <td>{a.categoryName}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-grey-800)' }}>{a.name}</td>
                    <td>
                      {a.options.length === 0 ? (
                        <span style={{ color: 'var(--color-grey-400)' }}>-</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {a.options.map(opt => (
                            <Badge key={opt} variant="neutral">
                              {opt}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <button
                          className="action-btn action-btn-edit"
                          onClick={() => handleOpenEditAttribute(a)}
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="action-btn action-btn-delete"
                          onClick={() => handleOpenDelete(a.id, a.name, 'atributo')}
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
        )}

        {/* Tabela Opções */}
        {activeTab === 'opcoes' && (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '12%' }}>Data</th>
                <th style={{ width: '15%' }}>Categoria</th>
                <th style={{ width: '15%' }}>Atributo</th>
                <th style={{ width: '15%' }}>Opções</th>
                <th style={{ width: '10%' }}>Peso (Kg)</th>
                <th style={{ width: '25%' }}>Entre eixo (mm)</th>
                <th style={{ width: '8%', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredOpcoes.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                    Nenhuma opção encontrada.
                  </td>
                </tr>
              ) : (
                filteredOpcoes.map(o => (
                  <tr key={o.id}>
                    <td>{o.createdAt}</td>
                    <td>{o.categoryName}</td>
                    <td>{o.attributeName}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-grey-800)' }}>{o.name}</td>
                    <td>{o.weight}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {o.wheelbases.map(wb => (
                          <Badge key={wb} variant="neutral">
                            {wb}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <button
                          className="action-btn action-btn-edit"
                          onClick={() => handleOpenEditOption(o)}
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="action-btn action-btn-delete"
                          onClick={() => handleOpenDelete(o.id, o.name, 'opcao')}
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
        )}
      </div>

      {/* Drawer Categoria */}
      <Drawer
        isOpen={drawerCategoryOpen}
        onClose={() => setDrawerCategoryOpen(false)}
        title={editingCategory ? 'Editar categoria' : 'Nova categoria'}
        subtitle="Forneça as informações da categoria do implemento."
        width="580px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-12)', width: '100%' }}>
            <Button variant="secondary" onClick={() => setDrawerCategoryOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveCategory}>
              Salvar
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveCategory} className="implemento-form-sections-container">
          <div className="implemento-form-section">
            <div className="implemento-section-info">
              <h3 className="implemento-section-title">Categoria</h3>
              <p className="implemento-section-desc">Identifique a categoria principal do implemento.</p>
            </div>
            <div className="implemento-section-fields">
              <Input
                label="Categoria"
                placeholder="Ex: Pipa, Munck, Furgão Baú"
                value={formCategoryName}
                onChange={e => setFormCategoryName(e.target.value)}
                required
              />
              <MultiSelect
                label="Atributos vinculados"
                placeholder="Selecione os atributos..."
                options={atributos.map(a => ({ value: a.name, label: a.name }))}
                value={formCategoryAttributes}
                onChange={setFormCategoryAttributes}
              />
            </div>
          </div>
        </form>
      </Drawer>

      {/* Drawer Atributo */}
      <Drawer
        isOpen={drawerAttributeOpen}
        onClose={() => setDrawerAttributeOpen(false)}
        title={editingAttribute ? 'Editar atributo' : 'Novo atributo'}
        subtitle="Configure os atributos vinculados a uma categoria."
        width="580px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-12)', width: '100%' }}>
            <Button variant="secondary" onClick={() => setDrawerAttributeOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveAttribute}>
              Salvar
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveAttribute} className="implemento-form-sections-container">
          <div className="implemento-form-section">
            <div className="implemento-section-info">
              <h3 className="implemento-section-title">Atributo</h3>
              <p className="implemento-section-desc">Vincule o atributo a uma categoria existente.</p>
            </div>
            <div className="implemento-section-fields">
              <Select
                label="Categoria"
                placeholder="Selecione a categoria..."
                options={categoryOptions}
                value={formAttributeCategory}
                onChange={(opt) => setFormAttributeCategory(opt as OptionType)}
              />
              <Input
                label="Nome do Atributo"
                placeholder="Ex: Capacidade, Tipo de Baú, Modelo"
                value={formAttributeName}
                onChange={e => setFormAttributeName(e.target.value)}
                required
              />
            </div>
          </div>
        </form>
      </Drawer>

      {/* Drawer Opção de Atributo */}
      <Drawer
        isOpen={drawerOptionOpen}
        onClose={() => setDrawerOptionOpen(false)}
        title={editingOption ? 'Editar opção' : 'Nova opção'}
        subtitle="Defina os valores das opções e pesos compatíveis."
        width="580px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-12)', width: '100%' }}>
            <Button variant="secondary" onClick={() => setDrawerOptionOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveOption}>
              Salvar
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveOption} className="implemento-form-sections-container">
          <div className="implemento-form-section">
            <div className="implemento-section-info">
              <h3 className="implemento-section-title">Dados Básicos</h3>
              <p className="implemento-section-desc">Selecione a categoria e o atributo correspondente.</p>
            </div>
            <div className="implemento-section-fields">
              <Select
                label="Categoria"
                placeholder="Selecione a categoria..."
                options={categoryOptions}
                value={formOptionCategory}
                onChange={(opt) => {
                  setFormOptionCategory(opt as OptionType);
                  setFormOptionAttribute(null); // reseta atributo quando muda a categoria
                }}
              />
              <Select
                label="Atributo"
                placeholder={formOptionCategory ? "Selecione o atributo..." : "Selecione a categoria primeiro"}
                options={attributeOptionsForSelectedCategory}
                value={formOptionAttribute}
                onChange={(opt) => setFormOptionAttribute(opt as OptionType)}
                isDisabled={!formOptionCategory}
              />
              <Input
                label="Nome da Opção"
                placeholder="Ex: Combustível, 10000L, Sider 7m"
                value={formOptionName}
                onChange={e => setFormOptionName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="implemento-form-section">
            <div className="implemento-section-info">
              <h3 className="implemento-section-title">Medidas e Compatibilidade</h3>
              <p className="implemento-section-desc">Informe o peso estimado do implemento e os entre-eixos recomendados.</p>
            </div>
            <div className="implemento-section-fields">
              <Input
                label="Peso (Kg)"
                placeholder="Ex: 900"
                value={formOptionWeight}
                onChange={e => setFormOptionWeight(e.target.value)}
              />
              <div>
                <label className="input-label" style={{ display: 'block', marginBottom: 8 }}>Entre eixo compatível (mm)</label>
                <div className="wheelbases-checkbox-grid">
                  {WHEELBASE_OPTIONS.map(opt => {
                    const isChecked = formOptionWheelbases.includes(opt.value);
                    return (
                      <label key={opt.value} className="wheelbase-checkbox-label">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setFormOptionWheelbases(prev => prev.filter(v => v !== opt.value));
                            } else {
                              setFormOptionWheelbases(prev => [...prev, opt.value]);
                            }
                          }}
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </form>
      </Drawer>

      {/* Modal Confirmação Exclusão */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title={`Excluir ${deleteTarget?.type === 'categoria' ? 'Categoria' : deleteTarget?.type === 'atributo' ? 'Atributo' : 'Opção'}`}
        message={
          <>
            Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>?
          </>
        }
        subMessage="Esta ação não pode ser desfeita e removerá a associação do sistema imediatamente."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
    </DashboardLayout>
  );
}
