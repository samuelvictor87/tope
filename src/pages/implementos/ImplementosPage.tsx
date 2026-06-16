// pages/implementos/ImplementosPage.tsx — Módulo de Implementos TOPE
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Pencil, Trash } from '@phosphor-icons/react';
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
import { Pagination } from '../../components/ui/Pagination';
import { supabase } from '../../lib/supabase';
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

const WHEELBASE_OPTIONS = [
  { value: '3400', label: '3400' },
  { value: '3560', label: '3560' },
  { value: '4000', label: '4000' },
  { value: '4400', label: '4400' },
  { value: '4600', label: '4600' },
  { value: '4800', label: '4800' },
  { value: '5207', label: '5207' }
];

const IMPLEMENTO_OPTIONS = [
  { value: 'furgao-bau', label: 'Furgão Baú' },
  { value: 'sider', label: 'Sider' },
  { value: 'grade-baixa', label: 'Grade Baixa' },
  { value: 'porta-conteiner', label: 'Porta Contêiner' },
  { value: 'basculante', label: 'Basculante' },
  { value: 'prancha', label: 'Prancha' },
  { value: 'frigorifico', label: 'Frigorífico' }
];

const FILTER_IMPLEMENTO_OPTIONS: OptionType[] = [
  { value: 'Todos', label: 'Implementos (Todos)' },
  ...IMPLEMENTO_OPTIONS
];

export function ImplementosPage() {
  const toast = useToast();
  
  // Abas
  const [activeTab, setActiveTab] = useState<'categorias' | 'atributos' | 'opcoes'>('categorias');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Estados dos Dados
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [atributos, setAtributos] = useState<Atributo[]>([]);
  const [opcoes, setOpcoes] = useState<OpcaoAtributo[]>([]);

  // Estados de Filtros
  const [searchCategory, setSearchCategory] = useState('');
  const [debouncedCategory, setDebouncedCategory] = useState('');
  const [searchAttribute, setSearchAttribute] = useState('');
  const [debouncedAttribute, setDebouncedAttribute] = useState('');
  const [filterAttrCategory, setFilterAttrCategory] = useState<OptionType | null>({ value: 'Todos', label: 'Categoria (Todas)' });
  const [searchOption, setSearchOption] = useState('');
  const [debouncedOption, setDebouncedOption] = useState('');
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

  // Estados de Carregamento e Paginação
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 10;

  const [dbCategorias, setDbCategorias] = useState<OptionType[]>([]);
  const [dbAtributos, setDbAtributos] = useState<OptionType[]>([]);

  const loadFilterOptions = async () => {
    try {
      const { data: cats, error: err1 } = await supabase
        .from('categorias')
        .select('id, nome')
        .order('nome');
      
      if (!err1 && cats) {
        setDbCategorias(cats.map(c => ({ value: c.id, label: c.nome })));
      }

      const { data: attrs, error: err2 } = await supabase
        .from('atributos')
        .select('id, nome, categoria_id')
        .order('nome');

      if (!err2 && attrs) {
        setDbAtributos(attrs.map(a => ({ value: a.id, label: a.nome, categoryId: a.categoria_id })));
      }
    } catch (err) {
      console.error('Erro ao buscar opções de filtros:', err);
    }
  };

  const loadCategorias = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('categorias')
        .select(`
          *,
          atributos:atributos(nome)
        `, { count: 'exact' });

      if (debouncedCategory.trim()) {
        const term = `%${debouncedCategory.trim()}%`;
        query = query.ilike('nome', term);
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.order('criado_em', { ascending: false }).range(from, to);

      const { data, error, count } = await query;
      if (error) {
        toast.error('Erro ao carregar categorias', error.message);
      } else if (data) {
        const mapped = data.map(item => ({
          id: item.id,
          createdAt: new Date(item.criado_em).toLocaleDateString('pt-BR'),
          name: item.nome,
          attributes: item.atributos ? (item.atributos as any[]).map(a => a.nome) : []
        }));
        setCategorias(mapped);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAtributos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('atributos')
        .select(`
          *,
          categoria:categorias(nome),
          opcoes:opcoes_atributos(nome)
        `, { count: 'exact' });

      if (debouncedAttribute.trim()) {
        const term = `%${debouncedAttribute.trim()}%`;
        query = query.ilike('nome', term);
      }

      if (filterAttrCategory && filterAttrCategory.value !== 'Todos') {
        query = query.eq('categoria_id', filterAttrCategory.value);
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.order('criado_em', { ascending: false }).range(from, to);

      const { data, error, count } = await query;
      if (error) {
        toast.error('Erro ao carregar atributos', error.message);
      } else if (data) {
        const mapped = data.map(item => ({
          id: item.id,
          createdAt: new Date(item.criado_em).toLocaleDateString('pt-BR'),
          categoryName: item.categoria ? (item.categoria as any).nome : '',
          name: item.nome,
          options: item.opcoes ? (item.opcoes as any[]).map(o => o.nome) : []
        }));
        setAtributos(mapped);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadOpcoes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('opcoes_atributos')
        .select(`
          *,
          atributo:atributos(
            nome,
            categoria:categorias(id, nome)
          )
        `, { count: 'exact' });

      if (debouncedOption.trim()) {
        const term = `%${debouncedOption.trim()}%`;
        query = query.ilike('nome', term);
      }

      if (filterOptCategory && filterOptCategory.value !== 'Todos') {
        query = query.eq('atributo.categoria_id', filterOptCategory.value);
      }

      if (filterOptAttribute && filterOptAttribute.value !== 'Todos') {
        query = query.eq('atributo_id', filterOptAttribute.value);
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.order('criado_em', { ascending: false }).range(from, to);

      const { data, error, count } = await query;
      if (error) {
        toast.error('Erro ao carregar opções', error.message);
      } else if (data) {
        const mapped = data.map(item => ({
          id: item.id,
          createdAt: new Date(item.criado_em).toLocaleDateString('pt-BR'),
          categoryName: item.atributo?.categoria ? (item.atributo.categoria as any).nome : '',
          attributeName: item.atributo ? (item.atributo as any).nome : '',
          name: item.nome,
          weight: item.peso || '0',
          wheelbases: item.entre_eixos || []
        }));
        setOpcoes(mapped);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Debounce para Categorias
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCategory(searchCategory);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchCategory]);

  // Debounce para Atributos
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedAttribute(searchAttribute);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchAttribute]);

  // Debounce para Opções
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedOption(searchOption);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchOption]);

  // Carregar dados iniciais dos filtros
  useEffect(() => {
    loadFilterOptions();
  }, []);

  // Carrega lista ao mudar abas ou paginação/filtros/buscas
  useEffect(() => {
    if (activeTab === 'categorias') {
      loadCategorias();
    } else if (activeTab === 'atributos') {
      loadAtributos();
    } else if (activeTab === 'opcoes') {
      loadOpcoes();
    }
  }, [activeTab, currentPage, filterAttrCategory, filterOptCategory, filterOptAttribute, debouncedCategory, debouncedAttribute, debouncedOption]);

  const filteredCategorias = categorias;
  const filteredAtributos = atributos;
  const filteredOpcoes = opcoes;

  // Opções para Selects e MultiSelects dinâmicos
  const categoryOptions: OptionType[] = useMemo(() => {
    return dbCategorias;
  }, [dbCategorias]);

  const attributeOptionsForSelectedCategory: OptionType[] = useMemo(() => {
    if (!formOptionCategory) return [];
    return dbAtributos
      .filter((a: any) => a.categoryId === formOptionCategory.value)
      .map(a => ({ value: a.value, label: a.label }));
  }, [formOptionCategory, dbAtributos]);

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

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCategoryName.trim()) {
      toast.error('Campos obrigatórios', 'Por favor, preencha o nome da categoria.');
      return;
    }

    setSaving(true);
    try {
      let catId = editingCategory?.id;
      if (editingCategory) {
        const { error } = await supabase
          .from('categorias')
          .update({ nome: formCategoryName.trim() })
          .eq('id', editingCategory.id);
        if (error) {
          toast.error('Erro ao atualizar categoria', error.message);
          return;
        }
      } else {
        const { data, error } = await supabase
          .from('categorias')
          .insert({ nome: formCategoryName.trim() })
          .select()
          .single();
        if (error) {
          toast.error('Erro ao criar categoria', error.message);
          return;
        }
        catId = data.id;
      }

      if (catId) {
        await supabase
          .from('atributos')
          .update({ categoria_id: null })
          .eq('categoria_id', catId);

        if (formCategoryAttributes.length > 0) {
          await supabase
            .from('atributos')
            .update({ categoria_id: catId })
            .in('nome', formCategoryAttributes);
        }
      }

      toast.success(editingCategory ? 'Categoria atualizada com sucesso!' : 'Nova categoria criada com sucesso!');
      setDrawerCategoryOpen(false);
      loadCategorias();
      loadFilterOptions();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
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
    const catOpt = dbCategorias.find(o => o.label === a.categoryName) || null;
    setFormAttributeCategory(catOpt);
    setFormAttributeName(a.name);
    setDrawerAttributeOpen(true);
  };

  const handleSaveAttribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAttributeCategory || !formAttributeName.trim()) {
      toast.error('Campos obrigatórios', 'Por favor, selecione a categoria e o nome do atributo.');
      return;
    }

    setSaving(true);
    try {
      const attributeData = {
        categoria_id: formAttributeCategory.value,
        nome: formAttributeName.trim()
      };

      if (editingAttribute) {
        const { error } = await supabase
          .from('atributos')
          .update(attributeData)
          .eq('id', editingAttribute.id);
        if (error) {
          toast.error('Erro ao atualizar atributo', error.message);
        } else {
          toast.success('Atributo atualizado com sucesso!');
          setDrawerAttributeOpen(false);
          loadAtributos();
          loadFilterOptions();
        }
      } else {
        const { error } = await supabase
          .from('atributos')
          .insert(attributeData);
        if (error) {
          toast.error('Erro ao criar atributo', error.message);
        } else {
          toast.success('Novo atributo criado com sucesso!');
          setDrawerAttributeOpen(false);
          setCurrentPage(1);
          loadAtributos();
          loadFilterOptions();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
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
    const catOpt = dbCategorias.find(opt => opt.label === o.categoryName) || null;
    setFormOptionCategory(catOpt);
    const attrOpt = dbAtributos.find(opt => opt.label === o.attributeName && opt.categoryId === catOpt?.value) || null;
    setFormOptionAttribute(attrOpt);
    setFormOptionName(o.name);
    setFormOptionWeight(o.weight);
    setFormOptionWheelbases(o.wheelbases);
    setDrawerOptionOpen(true);
  };

  const handleSaveOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formOptionCategory || !formOptionAttribute || !formOptionName.trim()) {
      toast.error('Campos obrigatórios', 'Por favor, selecione a categoria, o atributo e o nome da opção.');
      return;
    }

    setSaving(true);
    try {
      const optionData = {
        atributo_id: formOptionAttribute.value,
        nome: formOptionName.trim(),
        peso: formOptionWeight.trim() || '0',
        entre_eixos: formOptionWheelbases
      };

      if (editingOption) {
        const { error } = await supabase
          .from('opcoes_atributos')
          .update(optionData)
          .eq('id', editingOption.id);
        if (error) {
          toast.error('Erro ao atualizar opção', error.message);
        } else {
          toast.success('Opção atualizada com sucesso!');
          setDrawerOptionOpen(false);
          loadOpcoes();
          loadFilterOptions();
        }
      } else {
        const { error } = await supabase
          .from('opcoes_atributos')
          .insert(optionData);
        if (error) {
          toast.error('Erro ao criar opção', error.message);
        } else {
          toast.success('Nova opção criada com sucesso!');
          setDrawerOptionOpen(false);
          setCurrentPage(1);
          loadOpcoes();
          loadFilterOptions();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Exclusão Unificada
  const handleOpenDelete = (id: string, name: string, type: 'categoria' | 'atributo' | 'opcao') => {
    setDeleteTarget({ id, name, type });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'categoria') {
        const { error } = await supabase
          .from('categorias')
          .delete()
          .eq('id', deleteTarget.id);
        if (error) {
          toast.error('Erro ao excluir categoria', error.message);
        } else {
          toast.success('Categoria excluída com sucesso!');
          loadCategorias();
          loadFilterOptions();
        }
      } else if (deleteTarget.type === 'atributo') {
        const { error } = await supabase
          .from('atributos')
          .delete()
          .eq('id', deleteTarget.id);
        if (error) {
          toast.error('Erro ao excluir atributo', error.message);
        } else {
          toast.success('Atributo excluído com sucesso!');
          loadAtributos();
          loadFilterOptions();
        }
      } else if (deleteTarget.type === 'opcao') {
        const { error } = await supabase
          .from('opcoes_atributos')
          .delete()
          .eq('id', deleteTarget.id);
        if (error) {
          toast.error('Erro ao excluir opção', error.message);
        } else {
          toast.success('Opção excluída com sucesso!');
          loadOpcoes();
          loadFilterOptions();
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
    }
  };

  return (
    <DashboardLayout
      pageTitle="Implementos"
      pageSubtitle="Organize implementos e entre-eixos compatíveis."
    >
      {/* Abas */}
      <div className="implementos-tabs-container" style={{ marginBottom: 'var(--spacing-24)' }}>
        <div className="implementos-tabs">
          <button
            type="button"
            className={`implementos-tab-btn ${activeTab === 'categorias' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('categorias');
              setCurrentPage(1);
            }}
          >
            Categorias
          </button>
          <button
            type="button"
            className={`implementos-tab-btn ${activeTab === 'atributos' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('atributos');
              setCurrentPage(1);
            }}
          >
            Atributos
          </button>
          <button
            type="button"
            className={`implementos-tab-btn ${activeTab === 'opcoes' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('opcoes');
              setCurrentPage(1);
            }}
          >
            Opções de atributos
          </button>
        </div>
      </div>

      {/* Barra de Filtros e Ações — Alinhada e Estilizada */}
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
          <>
            <div style={{ width: 280 }}>
              <Input
                type="text"
                placeholder="Buscar por categoria ou atributo..."
                value={searchCategory}
                onChange={e => setSearchCategory(e.target.value)}
                style={{ height: 38 }}
              />
            </div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)', marginLeft: 'var(--spacing-8)' }}>
              {totalCount} {totalCount === 1 ? 'categoria' : 'categorias'}
            </span>
            <div style={{ marginLeft: 'auto' }}>
              <Button
                variant="primary"
                onClick={handleOpenCreateCategory}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
              >
                <Plus size={16} weight="bold" />
                Nova categoria
              </Button>
            </div>
          </>
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
            <div style={{ width: 200 }}>
              <Select
                options={[{ value: 'Todos', label: 'Categoria (Todas)' }, ...categoryOptions]}
                value={filterAttrCategory}
                onChange={(opt) => {
                  setFilterAttrCategory(opt as OptionType);
                  setCurrentPage(1);
                }}
                placeholder="Categoria (Todas)"
              />
            </div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)', marginLeft: 'var(--spacing-8)' }}>
              {totalCount} {totalCount === 1 ? 'atributo' : 'atributos'}
            </span>
            <div style={{ marginLeft: 'auto' }}>
              <Button
                variant="primary"
                onClick={handleOpenCreateAttribute}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
              >
                <Plus size={16} weight="bold" />
                Novo atributo
              </Button>
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
            <div style={{ width: 180 }}>
              <Select
                options={[{ value: 'Todos', label: 'Categoria (Todas)' }, ...categoryOptions]}
                value={filterOptCategory}
                onChange={(opt) => {
                  setFilterOptCategory(opt as OptionType);
                  setFilterOptAttribute({ value: 'Todos', label: 'Atributo (Todos)' });
                  setCurrentPage(1);
                }}
                placeholder="Categoria (Todas)"
              />
            </div>
            <div style={{ width: 180 }}>
              <Select
                options={[
                  { value: 'Todos', label: 'Atributo (Todos)' },
                  ...dbAtributos
                    .filter((a: any) => !filterOptCategory || filterOptCategory.value === 'Todos' || a.categoryId === filterOptCategory.value)
                    .map(a => ({ value: a.value, label: a.label }))
                ]}
                value={filterOptAttribute}
                onChange={(opt) => {
                  setFilterOptAttribute(opt as OptionType);
                  setCurrentPage(1);
                }}
                placeholder="Atributo (Todos)"
              />
            </div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)', marginLeft: 'var(--spacing-8)' }}>
              {totalCount} {totalCount === 1 ? 'opção' : 'opções'}
            </span>
            <div style={{ marginLeft: 'auto' }}>
              <Button
                variant="primary"
                onClick={handleOpenCreateOption}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
              >
                <Plus size={16} weight="bold" />
                Nova opção
              </Button>
            </div>
          </>
        )}
      </div>

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
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                    Carregando categorias...
                  </td>
                </tr>
              ) : filteredCategorias.length === 0 ? (
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
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                    Carregando atributos...
                  </td>
                </tr>
              ) : filteredAtributos.length === 0 ? (
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
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                    Carregando opções...
                  </td>
                </tr>
              ) : filteredOpcoes.length === 0 ? (
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
          
          {/* Paginação */}
          <Pagination
            currentPage={currentPage}
            totalCount={totalCount}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
            itemLabel={activeTab === 'categorias' ? 'categorias' : activeTab === 'atributos' ? 'atributos' : 'opções'}
          />
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
            <Button variant="primary" onClick={handleSaveCategory} loading={saving}>
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
            <Button variant="primary" onClick={handleSaveAttribute} loading={saving}>
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
            <Button variant="primary" onClick={handleSaveOption} loading={saving}>
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
