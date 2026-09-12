import { useEffect, useState } from 'react';
import { Plus, ArrowSquareOut, Trash } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { InputNumber } from '../../components/ui/InputNumber';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { Drawer } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Pagination } from '../../components/ui/Pagination';
import { Textarea } from '../../components/ui/Textarea';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  formatMoney,
  parseMoney,
  registrarMovimento,
  asObject,
} from './frotaShared';
import '../../styles/components/frota.css';
import '../../styles/components/table.css';

interface ImplementoRow {
  id: string;
  nome: string;
  valor: number | null;
  nf: string;
  observacoes: string;
  implementadoraId: string | null;
  implementadoraNome: string;
  veiculoId: string | null;
  veiculoPlaca: string;
}

function emptyForm() {
  return {
    nome: '',
    valor: 0 as number | string,
    nf: '',
    observacoes: '',
    implementadora: null as OptionType | null,
  };
}

type FormState = ReturnType<typeof emptyForm>;

export function FrotaImplementosPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<ImplementoRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [implementadoraOptions, setImplementadoraOptions] = useState<OptionType[]>([]);
  const ITEMS_PER_PAGE = 10;

  const patchForm = (partial: Partial<FormState>) => setForm(prev => ({ ...prev, ...partial }));

  const loadImplementadoras = async () => {
    const { data } = await supabase.from('frota_implementadoras').select('id, nome').order('nome');
    setImplementadoraOptions((data || []).map(row => ({ value: row.id, label: row.nome })));
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('frota_implementos')
        .select(
          `
          id, nome, valor, nf, observacoes, implementadora_id,
          implementadora:frota_implementadoras(id, nome),
          frota_acoplamentos(id, data_fim, veiculo:frota_veiculos(id, placa))
        `,
          { count: 'exact' }
        );

      if (debouncedSearch.trim()) {
        const term = `%${debouncedSearch.trim()}%`;
        query = query.or(`nome.ilike.${term},nf.ilike.${term}`);
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.order('nome', { ascending: true }).range(from, to);

      const { data, error, count } = await query;
      if (error) {
        toast.error('Erro ao carregar implementos', error.message);
      } else {
        setItems(
          (data || []).map(item => {
            const couplings = (item.frota_acoplamentos as Array<{
              id: string;
              data_fim: string | null;
              veiculo: { id: string; placa: string | null } | null;
            }>) || [];
            const ativo = couplings.find(c => !c.data_fim);
            const veiculo = asObject(ativo?.veiculo as { id: string; placa: string | null } | { id: string; placa: string | null }[] | null | undefined);
            const implementadora = asObject(item.implementadora as { id: string; nome: string } | { id: string; nome: string }[] | null);
            return {
              id: item.id,
              nome: item.nome || '',
              valor: item.valor != null ? Number(item.valor) : null,
              nf: item.nf || '',
              observacoes: item.observacoes || '',
              implementadoraId: item.implementadora_id,
              implementadoraNome: implementadora?.nome || '',
              veiculoId: veiculo?.id || null,
              veiculoPlaca: veiculo?.placa || '',
            };
          })
        );
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Erro inesperado ao buscar implementos da frota:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImplementadoras();
  }, []);

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
    setForm(emptyForm());
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error('Campo obrigatório', 'Informe o nome do implemento.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        valor: parseMoney(form.valor),
        nf: form.nf.trim() || null,
        observacoes: form.observacoes.trim() || null,
        implementadora_id: form.implementadora?.value || null,
      };
      const { data, error } = await supabase.from('frota_implementos').insert([payload]).select('id, nome').single();
      if (error || !data) {
        toast.error('Erro ao cadastrar implemento', error?.message || 'Não foi possível salvar.');
      } else {
        await registrarMovimento({
          implementoId: data.id,
          tipo: 'cadastro',
          descricao: `Cadastrou o implemento ${data.nome}`,
          criadoPor: user?.id || null,
        });
        toast.success('Implemento cadastrado.');
        setDrawerOpen(false);
        navigate(`/painel/frota/implementos/${data.id}`);
      }
    } catch (err) {
      console.error('Erro inesperado ao salvar implemento:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    try {
      const { error } = await supabase.from('frota_implementos').delete().eq('id', toDelete.id);
      if (error) {
        toast.error('Erro ao remover implemento', error.message);
      } else {
        toast.success('Implemento removido com sucesso!');
        setDeleteOpen(false);
        setToDelete(null);
        loadItems();
      }
    } catch (err) {
      console.error('Erro ao excluir implemento:', err);
    }
  };

  return (
    <DashboardLayout
      pageTitle="Implementos da frota"
      pageSubtitle="Peças físicas acopladas aos caminhões. O catálogo de cotação continua em Implementos."
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
            placeholder="Nome ou NF..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ height: 38 }}
          />
        </div>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)' }}>
          {totalCount} {totalCount === 1 ? 'implemento' : 'implementos'}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <Button
            variant="primary"
            onClick={handleOpenCreate}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
          >
            <Plus size={16} weight="bold" />
            Novo implemento
          </Button>
        </div>
      </div>

      <div className="table-container" style={{ marginBottom: 'var(--spacing-24)' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Implementadora</th>
              <th>Valor</th>
              <th>Caminhão</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                  Carregando implementos...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                  Nenhum implemento cadastrado.
                </td>
              </tr>
            ) : (
              items.map(item => (
                <tr key={item.id}>
                  <td>
                    <button
                      type="button"
                      className="frota-link-btn"
                      onClick={() => navigate(`/painel/frota/implementos/${item.id}`)}
                      style={{ textAlign: 'left' }}
                    >
                      <div className="frota-cell-placa">
                        <span className="frota-placa-text">{item.nome}</span>
                        {item.nf && <span className="frota-chassi-text">NF {item.nf}</span>}
                      </div>
                    </button>
                  </td>
                  <td>{item.implementadoraNome || '—'}</td>
                  <td>{formatMoney(item.valor)}</td>
                  <td>
                    {item.veiculoId ? (
                      <button
                        type="button"
                        className="frota-link-btn"
                        onClick={() => navigate(`/painel/frota/${item.veiculoId}`)}
                      >
                        {item.veiculoPlaca || 'Ver caminhão'}
                      </button>
                    ) : (
                      <Badge variant="neutral">Livre</Badge>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <button
                        className="action-btn action-btn-edit"
                        onClick={() => navigate(`/painel/frota/implementos/${item.id}`)}
                        title="Abrir implemento"
                      >
                        <ArrowSquareOut size={16} />
                      </button>
                      <button
                        className="action-btn action-btn-delete"
                        onClick={() => {
                          if (item.veiculoId) {
                            toast.error('Implemento acoplado', 'Desacople o implemento antes de excluir.');
                            return;
                          }
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
          itemLabel="implementos"
        />
      </div>

      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Novo implemento"
        subtitle="Nome, valor gasto e quem fez o serviço."
        width="560px"
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
        <div className="frota-form-sections-container">
          <div className="frota-form-section">
            <div className="frota-section-info">
              <h3 className="frota-section-title">Implemento</h3>
              <p className="frota-section-desc">Cada gasto vira um implemento físico</p>
            </div>
            <div className="frota-section-fields">
              <Input
                label="Nome"
                required
                placeholder="Ex: Caçamba RODOTEC"
                value={form.nome}
                onChange={e => patchForm({ nome: e.target.value })}
              />
              <Select
                label="Implementadora"
                options={implementadoraOptions}
                value={form.implementadora}
                onChange={opt => patchForm({ implementadora: (opt as OptionType) || null })}
                isClearable
                placeholder="Selecione..."
              />
              <div className="frota-input-row">
                <InputNumber
                  label="Valor"
                  currency
                  value={form.valor}
                  onChange={val => patchForm({ valor: val })}
                />
                <Input
                  label="NF"
                  placeholder="Opcional"
                  value={form.nf}
                  onChange={e => patchForm({ nf: e.target.value })}
                />
              </div>
              <Textarea
                label="Observações"
                rows={3}
                value={form.observacoes}
                onChange={e => patchForm({ observacoes: e.target.value })}
              />
            </div>
          </div>
        </div>
      </Drawer>

      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir implemento"
        message={
          <>
            Tem certeza que deseja excluir <strong>{toDelete?.name}</strong>?
          </>
        }
        subMessage="O histórico de movimentação deste implemento também será removido."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
    </DashboardLayout>
  );
}
