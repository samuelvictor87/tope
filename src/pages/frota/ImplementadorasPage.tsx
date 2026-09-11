import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash } from '@phosphor-icons/react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { Drawer } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Pagination } from '../../components/ui/Pagination';
import { supabase } from '../../lib/supabase';
import { mapImplementadora, maskCEP, maskCNPJ, type Implementadora } from './frotaShared';
import '../../styles/components/clientes.css';
import '../../styles/components/table.css';

function emptyForm() {
  return {
    nome: '',
    cnpj: '',
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
  };
}

type FormState = ReturnType<typeof emptyForm>;

export function ImplementadorasPage() {
  const toast = useToast();
  const [items, setItems] = useState<Implementadora[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Implementadora | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 10;

  const patchForm = (partial: Partial<FormState>) => setForm(prev => ({ ...prev, ...partial }));

  const loadItems = async () => {
    setLoading(true);
    try {
      let query = supabase.from('frota_implementadoras').select('*', { count: 'exact' });
      if (debouncedSearch.trim()) {
        const term = `%${debouncedSearch.trim()}%`;
        query = query.or(`nome.ilike.${term},cnpj.ilike.${term},cidade.ilike.${term}`);
      }
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.order('nome', { ascending: true }).range(from, to);
      const { data, error, count } = await query;
      if (error) {
        toast.error('Erro ao carregar implementadoras', error.message);
      } else {
        setItems((data || []).map(mapImplementadora));
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Erro inesperado ao buscar implementadoras:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    loadItems();
  }, [currentPage, debouncedSearch]);

  const handleOpenCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDrawerOpen(true);
  };

  const handleOpenEdit = (item: Implementadora) => {
    setEditing(item);
    setForm({
      nome: item.nome,
      cnpj: item.cnpj,
      cep: item.cep,
      endereco: item.endereco,
      numero: item.numero,
      complemento: item.complemento,
      bairro: item.bairro,
      cidade: item.cidade,
      estado: item.estado,
    });
    setDrawerOpen(true);
  };

  const handleCEPChange = async (rawVal: string) => {
    const masked = maskCEP(rawVal);
    patchForm({ cep: masked });
    const clean = rawVal.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error('CEP não localizado', 'Revise o CEP preenchido.');
      } else {
        patchForm({
          endereco: data.logradouro || '',
          bairro: data.bairro || '',
          cidade: data.localidade || '',
          estado: data.uf || '',
        });
      }
    } catch {
      toast.error('Erro na consulta', 'Não foi possível conectar ao ViaCEP.');
    }
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error('Campo obrigatório', 'Informe o nome da implementadora.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        cnpj: form.cnpj.trim() || null,
        cep: form.cep.trim() || null,
        endereco: form.endereco.trim() || null,
        numero: form.numero.trim() || null,
        complemento: form.complemento.trim() || null,
        bairro: form.bairro.trim() || null,
        cidade: form.cidade.trim() || null,
        estado: form.estado.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from('frota_implementadoras').update(payload).eq('id', editing.id);
        if (error) {
          toast.error('Erro ao atualizar implementadora', error.code === '23505' ? 'Já existe uma implementadora com este nome.' : error.message);
        } else {
          toast.success('Implementadora atualizada com sucesso!');
          setDrawerOpen(false);
          loadItems();
        }
      } else {
        const { error } = await supabase.from('frota_implementadoras').insert([payload]);
        if (error) {
          toast.error('Erro ao cadastrar implementadora', error.code === '23505' ? 'Já existe uma implementadora com este nome.' : error.message);
        } else {
          toast.success('Implementadora cadastrada com sucesso!');
          setDrawerOpen(false);
          setCurrentPage(1);
          loadItems();
        }
      }
    } catch (err) {
      console.error('Erro inesperado ao salvar implementadora:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    try {
      const { error } = await supabase.from('frota_implementadoras').delete().eq('id', toDelete.id);
      if (error) {
        toast.error('Erro ao remover implementadora', error.message);
      } else {
        toast.success('Implementadora removida com sucesso!');
        setDeleteOpen(false);
        setToDelete(null);
        loadItems();
      }
    } catch (err) {
      console.error('Erro ao excluir implementadora:', err);
    }
  };

  return (
    <DashboardLayout
      pageTitle="Implementadoras"
      pageSubtitle="Quem fabrica ou instala os implementos da frota. O nome basta para cadastrar."
    >
      <div
        className="usuarios-filters"
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
            placeholder="Nome, CNPJ ou cidade..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ height: 38 }}
          />
        </div>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)' }}>
          {totalCount} {totalCount === 1 ? 'implementadora' : 'implementadoras'}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <Button
            variant="primary"
            onClick={handleOpenCreate}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
          >
            <Plus size={16} weight="bold" />
            Nova implementadora
          </Button>
        </div>
      </div>

      <div className="table-container" style={{ marginBottom: 'var(--spacing-24)' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>CNPJ</th>
              <th>Cidade</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                  Carregando implementadoras...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                  Nenhuma implementadora encontrada.
                </td>
              </tr>
            ) : (
              items.map(item => (
                <tr key={item.id}>
                  <td>
                    <span className="cliente-razao-text">{item.nome}</span>
                  </td>
                  <td>
                    <span className="cliente-cnpj-text">{item.cnpj || '—'}</span>
                  </td>
                  <td>
                    {item.cidade ? `${item.cidade}${item.estado ? `/${item.estado}` : ''}` : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <button className="action-btn action-btn-edit" onClick={() => handleOpenEdit(item)} title="Editar">
                        <Pencil size={16} />
                      </button>
                      <button
                        className="action-btn action-btn-delete"
                        onClick={() => {
                          setToDelete({ id: item.id, name: item.nome });
                          setDeleteOpen(true);
                        }}
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
        <Pagination
          currentPage={currentPage}
          totalCount={totalCount}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
          itemLabel="implementadoras"
        />
      </div>

      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Editar implementadora' : 'Nova implementadora'}
        subtitle="O nome é obrigatório. CNPJ e endereço podem ficar em branco."
        width="640px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-12)', width: '100%' }}>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Salvar
            </Button>
          </div>
        }
      >
        <div className="cliente-form-sections-container">
          <div className="cliente-form-section">
            <div className="cliente-section-info">
              <h3 className="cliente-section-title">Identificação</h3>
              <p className="cliente-section-desc">Nome da oficina ou fabricante</p>
            </div>
            <div className="cliente-section-fields">
              <Input
                label="Nome"
                required
                placeholder="Ex: RODOTEC"
                value={form.nome}
                onChange={e => patchForm({ nome: e.target.value })}
              />
              <Input
                label="CNPJ"
                placeholder="Opcional"
                value={form.cnpj}
                onChange={e => patchForm({ cnpj: maskCNPJ(e.target.value) })}
              />
            </div>
          </div>
          <div className="cliente-form-section">
            <div className="cliente-section-info">
              <h3 className="cliente-section-title">Endereço</h3>
              <p className="cliente-section-desc">Opcional; o CEP preenche cidade e UF</p>
            </div>
            <div className="cliente-section-fields">
              <div className="input-row-cep-address">
                <div className="cep-field">
                  <Input
                    label="CEP"
                    value={form.cep}
                    onChange={e => handleCEPChange(e.target.value)}
                  />
                </div>
                <div className="address-field">
                  <Input
                    label="Endereço"
                    value={form.endereco}
                    onChange={e => patchForm({ endereco: e.target.value })}
                  />
                </div>
              </div>
              <div className="input-row-equal">
                <Input
                  label="Número"
                  value={form.numero}
                  onChange={e => patchForm({ numero: e.target.value })}
                />
                <Input
                  label="Complemento"
                  value={form.complemento}
                  onChange={e => patchForm({ complemento: e.target.value })}
                />
              </div>
              <div className="input-row-equal">
                <Input
                  label="Bairro"
                  value={form.bairro}
                  onChange={e => patchForm({ bairro: e.target.value })}
                />
                <Input
                  label="Cidade"
                  value={form.cidade}
                  onChange={e => patchForm({ cidade: e.target.value })}
                />
                <Input
                  label="UF"
                  value={form.estado}
                  onChange={e => patchForm({ estado: e.target.value.toUpperCase().slice(0, 2) })}
                />
              </div>
            </div>
          </div>
        </div>
      </Drawer>

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir implementadora"
        message={
          <>
            Tem certeza que deseja excluir <strong>{toDelete?.name}</strong>?
          </>
        }
        subMessage="Os implementos vinculados ficam sem fornecedor, mas não são apagados."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
    </DashboardLayout>
  );
}
