// pages/configuracoes/tabs/DepreciacaoImplementos.tsx — TOPE
import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash, MagnifyingGlass } from '@phosphor-icons/react';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import type { Column, ActionConfig } from '../../../components/ui/DataTable';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { useToast } from '../../../components/ui/Toast';
import { DepreciacaoImplementoModal } from '../modals/DepreciacaoImplementoModal';
import type {
  DepreciacaoImplemento,
  Categoria,
} from '../../../types/configuracoes.types';
import {
  excluirDepreciacaoImplemento,
  listarDepreciacoesImplementosPaginado,
} from '../../../services/configuracoes.service';
import '../../../styles/components/configuracoes-locacao.css';

interface DepreciacaoImplementosProps {
  categorias: Categoria[];
}

const formatarPercentual = (valor: number | null | undefined) => {
  if (valor === null || valor === undefined) return '—';
  return valor.toString().replace('.', ',') + '%';
};

export function DepreciacaoImplementos({
  categorias,
}: DepreciacaoImplementosProps) {
  const toast = useToast();

  const [depreciacoes, setDepreciacoes] = useState<DepreciacaoImplemento[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 10;

  // Estados de Filtros e Busca
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [tipoUso, setTipoUso] = useState('');

  // Estados de Ordenação
  const [sortBy, setSortBy] = useState<string>('categoria');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDep, setEditingDep] = useState<DepreciacaoImplemento | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingDep, setDeletingDep] = useState<DepreciacaoImplemento | null>(null);
  const [deletando, setDeletando] = useState(false);

  // Efeito de Debounce para busca
  useEffect(() => {
    const handler = setTimeout(() => {
      setBuscaDebounced(busca);
      setCurrentPage(1); // Reseta a página ao buscar
    }, 300);

    return () => clearTimeout(handler);
  }, [busca]);

  const carregarDepreciacoes = useCallback(async () => {
    setLoading(true);
    const { data, count, error } = await listarDepreciacoesImplementosPaginado(currentPage, ITEMS_PER_PAGE, {
      busca: buscaDebounced || undefined,
      tipoUso: tipoUso || undefined,
      ordenacao: {
        coluna: sortBy,
        direcao: sortDirection,
      },
    });
    if (error) {
      toast.error('Erro ao carregar', error);
      setDepreciacoes([]);
      setTotalCount(0);
    } else {
      setDepreciacoes(data);
      setTotalCount(count);
    }
    setLoading(false);
  }, [currentPage, buscaDebounced, tipoUso, sortBy, sortDirection, toast]);

  useEffect(() => {
    carregarDepreciacoes();
  }, [carregarDepreciacoes]);

  const columns: Column<DepreciacaoImplemento>[] = [
    {
      key: 'categoria',
      label: 'Categoria',
      sortable: true,
      render: (_value: any, row: DepreciacaoImplemento) => row.implemento_categorias?.nome ?? '—',
    },
    {
      key: 'tipo_uso',
      label: 'Tipo',
      sortable: true,
    },
    {
      key: 'ano_1',
      label: 'Depreciação (Ano 1 → 10)',
      sortable: true,
      render: (_value: any, row: DepreciacaoImplemento) => {
        const ano1 = formatarPercentual(row.ano_1);
        const ano10 = formatarPercentual(row.ano_10);
        return `${ano1} → ${ano10}`;
      },
    },
  ];

  const actions: ActionConfig<DepreciacaoImplemento>[] = [
    {
      icon: <Pencil size={16} />,
      label: 'Editar',
      onClick: (row) => {
        setEditingDep(row);
        setModalOpen(true);
      },
    },
    {
      icon: <Trash size={16} />,
      label: 'Excluir',
      onClick: (row) => {
        setDeletingDep(row);
        setConfirmOpen(true);
      },
    },
  ];

  const handleExcluir = async () => {
    if (!deletingDep) return;
    setDeletando(true);
    const { error } = await excluirDepreciacaoImplemento(deletingDep.id);
    setDeletando(false);

    if (error) {
      toast.error('Erro', error);
    } else {
      toast.success('Alterações salvas com sucesso!');
      setConfirmOpen(false);
      setDeletingDep(null);
      await carregarDepreciacoes();
    }
  };

  const handleModalSave = async () => {
    setModalOpen(false);
    setEditingDep(null);
    await carregarDepreciacoes();
  };

  return (
    <>
      <div className="config-locacao-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-24)' }}>
          <div className="config-locacao-section-header" style={{ marginBottom: 0 }}>
            <h2>Depreciação de implementos</h2>
            <p>Taxas de depreciação anual (% a.a.) para cada categoria de implemento conforme o tipo de uso.</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingDep(null);
              setModalOpen(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} weight="bold" />
            Nova depreciação
          </Button>
        </div>

        {/* Barra de Filtros */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          alignItems: 'flex-end', 
          marginBottom: 'var(--spacing-20)', 
          flexWrap: 'wrap'
        }}>
          <div style={{ width: '320px' }}>
            <Input
              placeholder="Buscar por categoria..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              icon={<MagnifyingGlass size={18} />}
            />
          </div>
          
          <div style={{ width: '220px' }}>
            <Select
              options={[
                { value: '', label: 'Todos os tipos de uso' },
                { value: 'Leve/Moderado', label: 'Leve/Moderado' },
                { value: 'Severo', label: 'Severo' },
              ]}
              value={
                tipoUso 
                  ? { value: tipoUso, label: tipoUso }
                  : { value: '', label: 'Todos os tipos de uso' }
              }
              onChange={(option: any) => {
                setTipoUso(option?.value ?? '');
                setCurrentPage(1);
              }}
              isSearchable={true}
              isClearable={false}
              placeholder="Tipo de uso..."
            />
          </div>
        </div>

        <DataTable<DepreciacaoImplemento>
          columns={columns}
          data={depreciacoes}
          loading={loading}
          actions={actions}
          emptyMessage="Nenhuma depreciação de implemento cadastrada"
          currentPage={currentPage}
          totalCount={totalCount}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
          itemLabel="depreciações"
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={(key, direction) => {
            setSortBy(key);
            setSortDirection(direction);
            setCurrentPage(1);
          }}
        />
      </div>

      <DepreciacaoImplementoModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingDep(null);
        }}
        onSave={handleModalSave}
        editingDep={editingDep}
        categorias={categorias}
      />

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setDeletingDep(null);
        }}
        onConfirm={handleExcluir}
        title="Excluir depreciação"
        message={`Deseja realmente excluir a depreciação de "${deletingDep?.implemento_categorias?.nome ?? ''}"?`}
        subMessage="Esta ação não poderá ser desfeita."
        confirmLabel="Excluir"
        loading={deletando}
      />
    </>
  );
}
