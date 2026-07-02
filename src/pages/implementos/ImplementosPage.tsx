// pages/implementos/ImplementosPage.tsx — Módulo de Implementos TOPE
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Pencil, Trash } from '@phosphor-icons/react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { MultiSelect } from '../../components/ui/MultiSelect';
import { Drawer } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';

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
  models: string[]; // nomes dos modelos vinculados
}

interface Modelo {
  id: string;
  createdAt: string;
  categoryName: string;
  name: string;
  valor: number | null;
}



// ─── Máscara de Moeda BRL ─────────────────────────────────────────────────────
function formatCurrency(raw: string): string {
  // Remove tudo que não for dígito
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  // Converte em centavos → reais
  const number = parseInt(digits, 10) / 100;
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseCurrency(formatted: string): number | null {
  const digits = formatted.replace(/\D/g, '');
  if (!digits) return null;
  return parseInt(digits, 10) / 100;
}

export function ImplementosPage() {
  const toast = useToast();
  
  // Abas
  const [activeTab, setActiveTab] = useState<'categorias' | 'modelos'>('categorias');


  // Estados dos Dados
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);

  // Estados de Filtros
  const [searchCategory, setSearchCategory] = useState('');
  const [debouncedCategory, setDebouncedCategory] = useState('');
  const [searchModelo, setSearchModelo] = useState('');
  const [debouncedModelo, setDebouncedModelo] = useState('');
  const [filterModeloCategory, setFilterModeloCategory] = useState<OptionType | null>({ value: 'Todos', label: 'Categoria (Todas)' });

  // Controles de Drawers
  const [drawerCategoryOpen, setDrawerCategoryOpen] = useState(false);
  const [drawerModelOpen, setDrawerModelOpen] = useState(false);

  // Entidades em Edição
  const [editingCategory, setEditingCategory] = useState<Categoria | null>(null);
  const [editingModelo, setEditingModelo] = useState<Modelo | null>(null);

  // Controles de Modais de Confirmação
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: 'categoria' | 'modelo' } | null>(null);

  // Form Fields - Categoria
  const [formCategoryName, setFormCategoryName] = useState('');
  const [formCategoryModels, setFormCategoryModels] = useState<string[]>([]);

  // Form Fields - Modelo
  const [formModelCategory, setFormModelCategory] = useState<OptionType | null>(null);
  const [formModelName, setFormModelName] = useState('');
  const [formModelValor, setFormModelValor] = useState('');



  // Estados de Carregamento e Paginação
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 10;

  const [dbCategorias, setDbCategorias] = useState<OptionType[]>([]);
  const [dbModelos, setDbModelos] = useState<(OptionType & { categoryId?: string })[]>([]);

  const loadFilterOptions = async () => {
    try {
      const { data: cats, error: err1 } = await supabase
        .from('implemento_categorias')
        .select('id, nome')
        .order('nome');
      
      if (!err1 && cats) {
        setDbCategorias(cats.map(c => ({ value: c.id, label: c.nome })));
      }

      const { data: mods, error: err2 } = await supabase
        .from('modelos')
        .select('id, nome, categoria_id')
        .order('nome');

      if (!err2 && mods) {
        setDbModelos(mods.map(a => ({ value: a.id, label: a.nome, categoryId: a.categoria_id })));
      }
    } catch (err) {
      console.error('Erro ao buscar opções de filtros:', err);
    }
  };

  const loadCategorias = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('implemento_categorias')
        .select(`
          *,
          modelos:modelos(nome)
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
          models: item.modelos ? (item.modelos as any[]).map(a => a.nome) : []
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

  const loadModelos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('modelos')
        .select(`
          *,
          categoria:implemento_categorias(nome)
        `, { count: 'exact' });

      if (debouncedModelo.trim()) {
        const term = `%${debouncedModelo.trim()}%`;
        query = query.ilike('nome', term);
      }

      if (filterModeloCategory && filterModeloCategory.value !== 'Todos') {
        query = query.eq('categoria_id', filterModeloCategory.value);
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.order('criado_em', { ascending: false }).range(from, to);

      const { data, error, count } = await query;
      if (error) {
        toast.error('Erro ao carregar modelos', error.message);
      } else if (data) {
        const mapped = data.map(item => ({
          id: item.id,
          createdAt: new Date(item.criado_em).toLocaleDateString('pt-BR'),
          categoryName: item.categoria ? (item.categoria as any).nome : '',
          name: item.nome,
          valor: item.valor ?? null,
        }));
        setModelos(mapped);
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

  // Debounce para Modelos
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedModelo(searchModelo);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchModelo]);



  // Carregar dados iniciais dos filtros
  useEffect(() => {
    loadFilterOptions();
  }, []);

  // Carrega lista ao mudar abas ou paginação/filtros/buscas
  useEffect(() => {
    if (activeTab === 'categorias') {
      loadCategorias();
    } else if (activeTab === 'modelos') {
      loadModelos();
    }
  }, [activeTab, currentPage, filterModeloCategory, debouncedCategory, debouncedModelo]);

  const filteredCategorias = categorias;
  const filteredModelos = modelos;

  // Opções para Selects e MultiSelects dinâmicos
  const categoryOptions: OptionType[] = useMemo(() => {
    return dbCategorias;
  }, [dbCategorias]);



  // Handlers Categoria (Criar/Editar/Salvar/Excluir)
  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setFormCategoryName('');
    setFormCategoryModels([]);
    setDrawerCategoryOpen(true);
  };

  const handleOpenEditCategory = (c: Categoria) => {
    setEditingCategory(c);
    setFormCategoryName(c.name);
    setFormCategoryModels(c.models);
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
          .from('implemento_categorias')
          .update({ nome: formCategoryName.trim() })
          .eq('id', editingCategory.id);
        if (error) {
          toast.error('Erro ao atualizar categoria', error.message);
          return;
        }
      } else {
        const { data, error } = await supabase
          .from('implemento_categorias')
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
          .from('modelos')
          .update({ categoria_id: null })
          .eq('categoria_id', catId);

        if (formCategoryModels.length > 0) {
          await supabase
            .from('modelos')
            .update({ categoria_id: catId })
            .in('nome', formCategoryModels);
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

  // Handlers Modelo (Criar/Editar/Salvar/Excluir)
  const handleOpenCreateModelo = () => {
    setEditingModelo(null);
    setFormModelCategory(null);
    setFormModelName('');
    setFormModelValor('');
    setDrawerModelOpen(true);
  };

  const handleOpenEditModelo = (a: Modelo) => {
    setEditingModelo(a);
    const catOpt = dbCategorias.find(o => o.label === a.categoryName) || null;
    setFormModelCategory(catOpt);
    setFormModelName(a.name);
    // Formata o valor existente como moeda ao abrir o drawer
    if (a.valor !== null && a.valor !== undefined) {
      const digits = Math.round(a.valor * 100).toString();
      setFormModelValor(formatCurrency(digits));
    } else {
      setFormModelValor('');
    }
    setDrawerModelOpen(true);
  };

  const handleSaveModelo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formModelCategory || !formModelName.trim()) {
      toast.error('Campos obrigatórios', 'Por favor, selecione a categoria e o nome do modelo.');
      return;
    }

    setSaving(true);
    try {
      const modelData = {
        categoria_id: formModelCategory.value,
        nome: formModelName.trim(),
        valor: parseCurrency(formModelValor),
      };

      if (editingModelo) {
        const { error } = await supabase
          .from('modelos')
          .update(modelData)
          .eq('id', editingModelo.id);
        if (error) {
          toast.error('Erro ao atualizar modelo', error.message);
        } else {
          toast.success('Modelo atualizado com sucesso!');
          setDrawerModelOpen(false);
          loadModelos();
          loadFilterOptions();
        }
      } else {
        const { error } = await supabase
          .from('modelos')
          .insert(modelData);
        if (error) {
          toast.error('Erro ao criar modelo', error.message);
        } else {
          toast.success('Novo modelo criado com sucesso!');
          setDrawerModelOpen(false);
          setCurrentPage(1);
          loadModelos();
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
  const handleOpenDelete = (id: string, name: string, type: 'categoria' | 'modelo') => {
    setDeleteTarget({ id, name, type });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (deleteTarget.type === 'categoria') {
        const { error } = await supabase
          .from('implemento_categorias')
          .delete()
          .eq('id', deleteTarget.id);
        if (error) {
          toast.error('Erro ao excluir categoria', error.message);
        } else {
          toast.success('Categoria excluída com sucesso!');
          loadCategorias();
          loadFilterOptions();
        }
      } else if (deleteTarget.type === 'modelo') {
        const { error } = await supabase
          .from('modelos')
          .delete()
          .eq('id', deleteTarget.id);
        if (error) {
          toast.error('Erro ao excluir modelo', error.message);
        } else {
          toast.success('Modelo excluído com sucesso!');
          loadModelos();
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
            className={`implementos-tab-btn ${activeTab === 'modelos' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('modelos');
              setCurrentPage(1);
            }}
          >
            Modelos
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
                placeholder="Buscar por categoria ou modelo..."
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

        {activeTab === 'modelos' && (
          <>
            <div style={{ width: 280 }}>
              <Input
                type="text"
                placeholder="Buscar por modelo..."
                value={searchModelo}
                onChange={e => setSearchModelo(e.target.value)}
                style={{ height: 38 }}
              />
            </div>
            <div style={{ width: 200 }}>
              <Select
                options={[{ value: 'Todos', label: 'Categoria (Todas)' }, ...categoryOptions]}
                value={filterModeloCategory}
                onChange={(opt) => {
                  setFilterModeloCategory(opt as OptionType);
                  setCurrentPage(1);
                }}
                placeholder="Categoria (Todas)"
              />
            </div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)', marginLeft: 'var(--spacing-8)' }}>
              {totalCount} {totalCount === 1 ? 'modelo' : 'modelos'}
            </span>
            <div style={{ marginLeft: 'auto' }}>
              <Button
                variant="primary"
                onClick={handleOpenCreateModelo}
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
              >
                <Plus size={16} weight="bold" />
                Novo modelo
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
                <th style={{ width: '30%' }}>Modelo</th>
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
                    <td>{c.models.join(', ') || <span style={{ color: 'var(--color-grey-400)' }}>-</span>}</td>
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

        {/* Tabela Modelos */}
        {activeTab === 'modelos' && (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '18%' }}>Data</th>
                <th style={{ width: '27%' }}>Categoria</th>
                <th style={{ width: '33%' }}>Modelo</th>
                <th style={{ width: '12%' }}>Valor</th>
                <th style={{ width: '10%', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                    Carregando modelos...
                  </td>
                </tr>
              ) : filteredModelos.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                    Nenhum modelo encontrado.
                  </td>
                </tr>
              ) : (
                filteredModelos.map(a => (
                  <tr key={a.id}>
                    <td>{a.createdAt}</td>
                    <td>{a.categoryName}</td>
                    <td style={{ fontWeight: 600, color: 'var(--color-grey-800)' }}>{a.name}</td>
                    <td style={{ color: a.valor ? 'var(--color-grey-800)' : 'var(--color-grey-400)' }}>
                      {a.valor
                        ? a.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <button
                          className="action-btn action-btn-edit"
                          onClick={() => handleOpenEditModelo(a)}
                          title="Editar"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="action-btn action-btn-delete"
                          onClick={() => handleOpenDelete(a.id, a.name, 'modelo')}
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
            itemLabel={activeTab === 'categorias' ? 'categorias' : 'modelos'}
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
                label="Modelos vinculados"
                placeholder="Selecione os modelos..."
                options={modelos.map(a => ({ value: a.name, label: a.name }))}
                value={formCategoryModels}
                onChange={setFormCategoryModels}
              />
            </div>
          </div>
        </form>
      </Drawer>

      {/* Drawer Modelo */}
      <Drawer
        isOpen={drawerModelOpen}
        onClose={() => setDrawerModelOpen(false)}
        title={editingModelo ? 'Editar modelo' : 'Novo modelo'}
        subtitle="Configure os modelos vinculados a uma categoria."
        width="580px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-12)', width: '100%' }}>
            <Button variant="secondary" onClick={() => setDrawerModelOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveModelo} loading={saving}>
              Salvar
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveModelo} className="implemento-form-sections-container">
          <div className="implemento-form-section">
            <div className="implemento-section-info">
              <h3 className="implemento-section-title">Modelo</h3>
              <p className="implemento-section-desc">Vincule o modelo a uma categoria existente.</p>
            </div>
            <div className="implemento-section-fields">
              <Select
                label="Categoria"
                placeholder="Selecione a categoria..."
                options={categoryOptions}
                value={formModelCategory}
                onChange={(opt) => setFormModelCategory(opt as OptionType)}
              />
              <Input
                label="Nome do Modelo"
                placeholder="Ex: Frigorífico, Carga Seca, Tipo de Baú"
                value={formModelName}
                onChange={e => setFormModelName(e.target.value)}
                required
              />
              <Input
                label="Valor (R$)"
                placeholder="R$ 0,00"
                value={formModelValor}
                onChange={e => setFormModelValor(formatCurrency(e.target.value))}
                type="text"
              />
            </div>
          </div>
        </form>
      </Drawer>



      {/* Modal Confirmação Exclusão */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title={`Excluir ${deleteTarget?.type === 'categoria' ? 'Categoria' : 'Modelo'}`}
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
