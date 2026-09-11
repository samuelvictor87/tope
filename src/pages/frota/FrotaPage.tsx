import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { InputNumber } from '../../components/ui/InputNumber';
import { InputDate } from '../../components/ui/InputDate';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { Drawer } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Pagination } from '../../components/ui/Pagination';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  brToIso,
  displayAssetStatus,
  formatMoney,
  labelCatalogoModelo,
  loadCatalogoModelos,
  LOCADORA_OPTIONS,
  FAMILY_CATALOGO_OPTIONS,
  parseIntOrNull,
  parseMoney,
  registrarMovimento,
  snapshotModeloTexto,
  STATUS_ATIVO_BADGE,
  STATUS_ATIVO_LABELS,
  STATUS_ATIVO_OPTIONS,
  TIPO_VEICULO_OPTIONS,
  asObject,
  type CatalogoModelo,
  type StatusOperacional,
} from './frotaShared';
import '../../styles/components/frota.css';
import '../../styles/components/table.css';

interface FrotaVeiculoLista {
  id: string;
  placa: string;
  chassi: string;
  modelo_texto: string;
  caminhao_id: string | null;
  catalogo: { tipo: string; marca: string; familia: string | null; modelo: string } | null;
  status_operacional: StatusOperacional;
  implementos: string[];
  valorImplementos: number;
}

interface KpiCounts {
  ativos: number;
  com_implemento: number;
  vendidos: number;
  roubados: number;
  baixados: number;
}

const FILTER_STATUS_OPTIONS: OptionType[] = [
  { value: 'ativos', label: 'Frota ativa' },
  { value: 'com_implemento', label: 'Com implemento' },
  { value: 'vendido', label: 'Vendido' },
  { value: 'roubado', label: 'Roubado' },
  { value: 'baixado', label: 'Baixado' },
  { value: 'todos', label: 'Todos' },
];

function emptyForm() {
  return {
    placa: '',
    chassi: '',
    renavam: '',
    tipo: TIPO_VEICULO_OPTIONS[0] as OptionType | null,
    familia: null as OptionType | null,
    modelo: null as OptionType | null,
    ano_fabricacao: '',
    ano_modelo: '',
    cor: '',
    locadora: { value: 'TOPE', label: 'TOPE' } as OptionType | null,
    status_operacional: { value: 'disponivel', label: 'Disponível' } as OptionType | null,
    nf_compra: '',
    data_emissao_nf: '',
    valor_compra: 0 as number | string,
  };
}

type FormState = ReturnType<typeof emptyForm>;

export function FrotaPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [veiculos, setVeiculos] = useState<FrotaVeiculoLista[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OptionType>(FILTER_STATUS_OPTIONS[0]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [kpis, setKpis] = useState<KpiCounts>({
    ativos: 0,
    com_implemento: 0,
    vendidos: 0,
    roubados: 0,
    baixados: 0,
  });
  const [catalogo, setCatalogo] = useState<CatalogoModelo[]>([]);
  const ITEMS_PER_PAGE = 10;

  const patchForm = (partial: Partial<FormState>) => setForm(prev => ({ ...prev, ...partial }));

  const loadKpis = async () => {
    try {
      const base = () => supabase.from('frota_veiculos').select('id', { count: 'exact', head: true });
      const [ativosRes, vendidosRes, roubadosRes, baixadosRes, couplingsRes] = await Promise.all([
        base().not('status_operacional', 'in', '("vendido","roubado","baixado")'),
        base().eq('status_operacional', 'vendido'),
        base().eq('status_operacional', 'roubado'),
        base().eq('status_operacional', 'baixado'),
        supabase.from('frota_acoplamentos').select('veiculo_id').is('data_fim', null),
      ]);
      const uniqueCoupled = new Set((couplingsRes.data || []).map(row => row.veiculo_id)).size;
      setKpis({
        ativos: ativosRes.count || 0,
        com_implemento: uniqueCoupled,
        vendidos: vendidosRes.count || 0,
        roubados: roubadosRes.count || 0,
        baixados: baixadosRes.count || 0,
      });
    } catch (err) {
      console.error('Erro ao carregar indicadores da frota:', err);
    }
  };

  const loadVeiculos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('frota_veiculos')
        .select(
          `
          id, placa, chassi, modelo_texto, status_operacional, caminhao_id,
          caminhao:caminhoes ( tipo, marca, familia, modelo ),
          frota_acoplamentos (
            data_fim,
            implemento:frota_implementos ( id, nome, valor )
          )
        `,
          { count: 'exact' }
        );

      const filterVal = statusFilter.value;
      if (filterVal === 'ativos') {
        query = query.not('status_operacional', 'in', '("vendido","roubado","baixado")');
      } else if (filterVal === 'com_implemento') {
        const { data: coupled } = await supabase.from('frota_acoplamentos').select('veiculo_id').is('data_fim', null);
        const ids = [...new Set((coupled || []).map(row => row.veiculo_id))];
        if (ids.length === 0) {
          setVeiculos([]);
          setTotalCount(0);
          setLoading(false);
          return;
        }
        query = query.in('id', ids);
      } else if (filterVal !== 'todos') {
        query = query.eq('status_operacional', filterVal);
      }

      if (debouncedSearch.trim()) {
        const term = `%${debouncedSearch.trim()}%`;
        query = query.or(`placa.ilike.${term},chassi.ilike.${term},modelo_texto.ilike.${term}`);
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.order('placa', { ascending: true, nullsFirst: false }).range(from, to);

      const { data, error, count } = await query;
      if (error) {
        toast.error('Erro ao carregar a frota', error.message);
      } else {
        setVeiculos(
          (data || []).map(item => {
            const couplings = (item.frota_acoplamentos as Array<{
              data_fim: string | null;
              implemento: { id: string; nome: string; valor: number | null } | null;
            }>) || [];
            const ativos = couplings
              .filter(c => !c.data_fim)
              .map(c => asObject(c.implemento))
              .filter((impl): impl is { id: string; nome: string; valor: number | null } => !!impl);
            const catalogoJoin = asObject(item.caminhao as {
              tipo: string; marca: string; familia: string | null; modelo: string;
            } | Array<{ tipo: string; marca: string; familia: string | null; modelo: string }> | null);
            return {
              id: item.id,
              placa: item.placa || '',
              chassi: item.chassi || '',
              modelo_texto: item.modelo_texto || '',
              caminhao_id: item.caminhao_id || null,
              catalogo: catalogoJoin,
              status_operacional: item.status_operacional as StatusOperacional,
              implementos: ativos.map(impl => impl.nome),
              valorImplementos: ativos.reduce((sum, impl) => sum + Number(impl.valor || 0), 0),
            };
          })
        );
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Erro inesperado ao buscar frota:', err);
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
    loadVeiculos();
  }, [currentPage, statusFilter, debouncedSearch]);

  useEffect(() => {
    loadKpis();
    loadCatalogoModelos().then(setCatalogo);
  }, []);

  const applyKpiFilter = (value: string) => {
    const opt = FILTER_STATUS_OPTIONS.find(o => o.value === value);
    if (opt) {
      setStatusFilter(opt);
      setCurrentPage(1);
    }
  };

  const handleOpenCreate = () => {
    setForm(emptyForm());
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.placa.trim() && !form.chassi.trim()) {
      toast.error('Campos obrigatórios', 'Informe a placa ou o chassi do caminhão.');
      return;
    }
    if (!form.status_operacional) {
      toast.error('Campos obrigatórios', 'Selecione o status do ativo.');
      return;
    }

    if (!form.modelo) {
      toast.error('Campos obrigatórios', 'Selecione o modelo no catálogo.');
      return;
    }

    const modeloCat = catalogo.find(c => c.id === form.modelo?.value);
    if (!modeloCat) {
      toast.error('Modelo inválido', 'Selecione um modelo cadastrado.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        placa: form.placa.trim() || null,
        chassi: form.chassi.trim() || null,
        renavam: form.renavam.trim() || null,
        caminhao_id: modeloCat.id,
        marca: modeloCat.marca,
        modelo_texto: snapshotModeloTexto(modeloCat.marca, modeloCat.modelo),
        ano_fabricacao: parseIntOrNull(form.ano_fabricacao),
        ano_modelo: parseIntOrNull(form.ano_modelo),
        cor: form.cor.trim() || null,
        locadora: form.locadora?.value || null,
        status_operacional: form.status_operacional.value,
        nf_compra: form.nf_compra.trim() || null,
        data_emissao_nf: brToIso(form.data_emissao_nf),
        valor_compra: parseMoney(form.valor_compra),
      };

      const { data, error } = await supabase.from('frota_veiculos').insert([payload]).select('id, placa').single();
      if (error || !data) {
        toast.error('Erro ao cadastrar caminhão', error?.message || 'Não foi possível salvar.');
      } else {
        await registrarMovimento({
          veiculoId: data.id,
          tipo: 'cadastro',
          descricao: `Cadastrou o caminhão ${data.placa || form.chassi || 'sem identificação'}`,
          criadoPor: user?.id || null,
        });
        toast.success('Caminhão cadastrado com sucesso!');
        setDrawerOpen(false);
        setCurrentPage(1);
        loadVeiculos();
        loadKpis();
      }
    } catch (err) {
      console.error('Erro inesperado ao salvar frota:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!toDelete) return;
    try {
      const { error } = await supabase.from('frota_veiculos').delete().eq('id', toDelete.id);
      if (error) {
        toast.error('Erro ao remover caminhão', error.message);
      } else {
        toast.success('Caminhão removido com sucesso!');
        setDeleteOpen(false);
        setToDelete(null);
        loadVeiculos();
        loadKpis();
      }
    } catch (err) {
      console.error('Erro ao excluir caminhão da frota:', err);
    }
  };

  return (
    <DashboardLayout
      pageTitle="Caminhões"
      pageSubtitle="Ativos da frota: identificação, compra do casco, implementos e documentos."
    >
      <div className="frota-kpi-row">
        <button
          type="button"
          className={`frota-kpi ${statusFilter.value === 'ativos' ? 'frota-kpi-active' : ''}`}
          onClick={() => applyKpiFilter('ativos')}
        >
          <p className="frota-kpi-label">Ativos</p>
          <p className="frota-kpi-value">{kpis.ativos}</p>
        </button>
        <button
          type="button"
          className={`frota-kpi ${statusFilter.value === 'com_implemento' ? 'frota-kpi-active' : ''}`}
          onClick={() => applyKpiFilter('com_implemento')}
        >
          <p className="frota-kpi-label">Com implemento</p>
          <p className="frota-kpi-value">{kpis.com_implemento}</p>
        </button>
        <button
          type="button"
          className={`frota-kpi ${statusFilter.value === 'vendido' ? 'frota-kpi-active' : ''}`}
          onClick={() => applyKpiFilter('vendido')}
        >
          <p className="frota-kpi-label">Vendidos</p>
          <p className="frota-kpi-value">{kpis.vendidos}</p>
        </button>
        <button
          type="button"
          className={`frota-kpi ${statusFilter.value === 'roubado' ? 'frota-kpi-active' : ''}`}
          onClick={() => applyKpiFilter('roubado')}
        >
          <p className="frota-kpi-label">Roubados</p>
          <p className="frota-kpi-value">{kpis.roubados}</p>
        </button>
        <button
          type="button"
          className={`frota-kpi ${statusFilter.value === 'baixado' ? 'frota-kpi-active' : ''}`}
          onClick={() => applyKpiFilter('baixado')}
        >
          <p className="frota-kpi-label">Baixados</p>
          <p className="frota-kpi-value">{kpis.baixados}</p>
        </button>
      </div>

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
            placeholder="Placa, chassi ou modelo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ height: 38 }}
          />
        </div>
        <div style={{ width: 220 }}>
          <Select
            options={FILTER_STATUS_OPTIONS}
            value={statusFilter}
            onChange={opt => {
              setStatusFilter(opt as OptionType);
              setCurrentPage(1);
            }}
            placeholder="Status"
          />
        </div>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)' }}>
          {totalCount} {totalCount === 1 ? 'caminhão' : 'caminhões'}
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <Button
            variant="primary"
            onClick={handleOpenCreate}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
          >
            <Plus size={16} weight="bold" />
            Novo caminhão
          </Button>
        </div>
      </div>

      <div className="table-container" style={{ marginBottom: 'var(--spacing-24)' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Placa</th>
              <th>Modelo</th>
              <th>Implementos</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                  Carregando caminhões...
                </td>
              </tr>
            ) : veiculos.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                  Nenhum caminhão encontrado.
                </td>
              </tr>
            ) : (
              veiculos.map(v => {
                const status = displayAssetStatus(v.status_operacional);
                return (
                  <tr
                    key={v.id}
                    className="table-row-clickable"
                    onClick={() => navigate(`/painel/frota/${v.id}`)}
                  >
                    <td>
                      <div className="frota-cell-placa">
                        <span className="frota-placa-text">{v.placa || '—'}</span>
                        {v.chassi && <span className="frota-chassi-text">{v.chassi}</span>}
                      </div>
                    </td>
                    <td>
                      {v.catalogo ? (
                        <span className="frota-placa-text">{labelCatalogoModelo(v.catalogo)}</span>
                      ) : (
                        <div className="frota-cell-placa">
                          <span>{v.modelo_texto || '—'}</span>
                          <Badge variant="warning">Equipamento</Badge>
                        </div>
                      )}
                    </td>
                    <td>
                      {v.implementos.length > 0 ? (
                        <div className="frota-cell-placa">
                          <span>{v.implementos.join(' · ')}</span>
                          <span className="frota-chassi-text">{formatMoney(v.valorImplementos)}</span>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <Badge variant={STATUS_ATIVO_BADGE[status]}>{STATUS_ATIVO_LABELS[status]}</Badge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <button
                          className="action-btn action-btn-edit"
                          onClick={e => {
                            e.stopPropagation();
                            navigate(`/painel/frota/${v.id}`);
                          }}
                          title="Abrir"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="action-btn action-btn-delete"
                          onClick={e => {
                            e.stopPropagation();
                            setToDelete({ id: v.id, name: v.placa || v.chassi || 'sem identificação' });
                            setDeleteOpen(true);
                          }}
                          title="Excluir"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Pagination
          currentPage={currentPage}
          totalCount={totalCount}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
          itemLabel="caminhões"
        />
      </div>

      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Novo caminhão"
        subtitle="Cadastro do casco. Cliente e contrato não ficam no caminhão."
        width="720px"
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
              <h3 className="frota-section-title">Identificação</h3>
              <p className="frota-section-desc">Placa, chassi e dados cadastrais do veículo</p>
            </div>
            <div className="frota-section-fields">
              <div className="frota-input-row">
                <Input
                  label="Placa"
                  placeholder="ABC1D23"
                  value={form.placa}
                  onChange={e => patchForm({ placa: e.target.value.toUpperCase() })}
                />
                <Input
                  label="Chassi"
                  placeholder="Número do chassi"
                  value={form.chassi}
                  onChange={e => patchForm({ chassi: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="frota-input-row">
                <Input
                  label="RENAVAM"
                  value={form.renavam}
                  onChange={e => patchForm({ renavam: e.target.value })}
                />
                <Select
                  label="Tipo"
                  options={TIPO_VEICULO_OPTIONS}
                  value={form.tipo}
                  onChange={opt => patchForm({
                    tipo: opt as OptionType,
                    familia: null,
                    modelo: null,
                  })}
                />
              </div>
              <div className="frota-input-row">
                <Select
                  label="Família"
                  options={[
                    { value: '', label: 'Todas' },
                    ...FAMILY_CATALOGO_OPTIONS.filter(f =>
                      catalogo.some(c => c.tipo === form.tipo?.value && c.familia === f.value)
                    ),
                  ]}
                  value={form.familia}
                  onChange={opt => patchForm({ familia: (opt as OptionType) || null, modelo: null })}
                  isClearable
                  placeholder="Opcional"
                />
                <Select
                  label="Modelo"
                  options={catalogo
                    .filter(c =>
                      c.tipo === form.tipo?.value &&
                      (!form.familia?.value || c.familia === form.familia.value)
                    )
                    .map(c => ({ value: c.id, label: labelCatalogoModelo(c) }))}
                  value={form.modelo}
                  onChange={opt => patchForm({ modelo: (opt as OptionType) || null })}
                  placeholder="Selecione o modelo..."
                />
              </div>
              <div className="frota-input-row">
                <Input
                  label="Ano fabricação"
                  value={form.ano_fabricacao}
                  onChange={e => patchForm({ ano_fabricacao: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                />
                <Input
                  label="Ano modelo"
                  value={form.ano_modelo}
                  onChange={e => patchForm({ ano_modelo: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                />
                <Input
                  label="Cor"
                  value={form.cor}
                  onChange={e => patchForm({ cor: e.target.value })}
                />
              </div>
              <div className="frota-input-row">
                <Select
                  label="Locadora"
                  options={LOCADORA_OPTIONS}
                  value={form.locadora}
                  onChange={opt => patchForm({ locadora: opt as OptionType })}
                  placeholder="Selecione..."
                />
                <Select
                  label="Status do ativo"
                  options={STATUS_ATIVO_OPTIONS}
                  value={form.status_operacional}
                  onChange={opt => patchForm({ status_operacional: opt as OptionType })}
                />
              </div>
            </div>
          </div>

          <div className="frota-form-section">
            <div className="frota-section-info">
              <h3 className="frota-section-title">Compra do casco</h3>
              <p className="frota-section-desc">Nota fiscal e valor de aquisição do chassi</p>
            </div>
            <div className="frota-section-fields">
              <div className="frota-input-row">
                <Input
                  label="NF de compra"
                  value={form.nf_compra}
                  onChange={e => patchForm({ nf_compra: e.target.value })}
                />
                <InputDate
                  label="Emissão da NF"
                  value={form.data_emissao_nf}
                  onChange={val => patchForm({ data_emissao_nf: typeof val === 'string' ? val : '' })}
                />
                <InputNumber
                  label="Valor de compra"
                  currency
                  value={form.valor_compra}
                  onChange={val => patchForm({ valor_compra: val })}
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
        title="Excluir caminhão"
        message={
          <>
            Tem certeza que deseja excluir o caminhão <strong>{toDelete?.name}</strong>?
          </>
        }
        subMessage="Acoplamentos, documentos e o histórico deste caminhão também serão removidos."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
    </DashboardLayout>
  );
}
