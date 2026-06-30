// pages/configuracoes/tabs/DepreciacaoImplementos.tsx — TOPE
import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash } from '@phosphor-icons/react';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import type { Column, ActionConfig } from '../../../components/ui/DataTable';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { useToast } from '../../../components/ui/Toast';
import { DepreciacaoImplementoModal } from '../modals/DepreciacaoImplementoModal';
import type {
  DepreciacaoImplemento,
  Categoria,
  TaxaFinanciamento,
} from '../../../types/configuracoes.types';
import {
  excluirDepreciacaoImplemento,
  listarDepreciacoesImplementosPaginado,
} from '../../../services/configuracoes.service';
import '../../../styles/components/configuracoes-locacao.css';

interface DepreciacaoImplementosProps {
  categorias: Categoria[];
  taxas: TaxaFinanciamento[];
}

const formatarPercentual = (valor: number) =>
  valor.toString().replace('.', ',') + '%';

export function DepreciacaoImplementos({
  categorias,
  taxas,
}: DepreciacaoImplementosProps) {
  const toast = useToast();

  const [depreciacoes, setDepreciacoes] = useState<DepreciacaoImplemento[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 10;

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDep, setEditingDep] = useState<DepreciacaoImplemento | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingDep, setDeletingDep] = useState<DepreciacaoImplemento | null>(null);
  const [deletando, setDeletando] = useState(false);

  const carregarDepreciacoes = useCallback(async () => {
    setLoading(true);
    const { data, count, error } = await listarDepreciacoesImplementosPaginado(currentPage, ITEMS_PER_PAGE);
    if (error) {
      toast.error('Erro ao carregar', error);
      setDepreciacoes([]);
      setTotalCount(0);
    } else {
      setDepreciacoes(data);
      setTotalCount(count);
    }
    setLoading(false);
  }, [currentPage, toast]);

  useEffect(() => {
    carregarDepreciacoes();
  }, [carregarDepreciacoes]);

  const columns: Column<DepreciacaoImplemento>[] = [
    {
      key: 'categoria',
      label: 'Categoria',
      render: (_value: any, row: DepreciacaoImplemento) => row.implemento_categorias?.nome ?? '—',
    },
    {
      key: 'prazo',
      label: 'Prazo',
      render: (value: any) => `${value} meses`,
    },
    {
      key: 'tipo_uso',
      label: 'Tipo',
    },
    {
      key: 'depreciacao_anual_percentual',
      label: '% aa',
      render: (value: number) => formatarPercentual(value),
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
            <p>Taxas de depreciação anual (% a.a.) para cada categoria de implemento conforme o prazo e tipo de uso.</p>
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
        taxas={taxas}
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
