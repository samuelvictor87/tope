// pages/configuracoes/tabs/InvestimentosFinanciamento.tsx — TOPE
import { useState } from 'react';
import { Plus, Pencil, Trash } from '@phosphor-icons/react';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import type { Column, ActionConfig } from '../../../components/ui/DataTable';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { useToast } from '../../../components/ui/Toast';
import { FinanciamentoModal } from '../modals/FinanciamentoModal';
import type { TaxaFinanciamento } from '../../../types/configuracoes.types';
import { excluirTaxaFinanciamento } from '../../../services/configuracoes.service';

interface InvestimentosFinanciamentoProps {
  taxas: TaxaFinanciamento[];
  loadingTaxas: boolean;
  onRefreshTaxas: () => Promise<void>;
}

const formatarPercentual = (valor: number) =>
  valor.toString().replace('.', ',') + '%';

export function InvestimentosFinanciamento({
  taxas,
  loadingTaxas,
  onRefreshTaxas,
}: InvestimentosFinanciamentoProps) {
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTaxa, setEditingTaxa] = useState<TaxaFinanciamento | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingTaxa, setDeletingTaxa] = useState<TaxaFinanciamento | null>(null);
  const [deletando, setDeletando] = useState(false);

  const columns: Column<TaxaFinanciamento>[] = [
    {
      key: 'prazo',
      label: 'Prazo',
      render: (value: any) => `${value} meses`,
    },
    {
      key: 'juros_mensal_percentual',
      label: 'Juros mensal',
      render: (value: number) => formatarPercentual(value),
    },
  ];

  const actions: ActionConfig<TaxaFinanciamento>[] = [
    {
      icon: <Pencil size={16} />,
      label: 'Editar',
      onClick: (row) => {
        setEditingTaxa(row);
        setModalOpen(true);
      },
    },
    {
      icon: <Trash size={16} />,
      label: 'Excluir',
      onClick: (row) => {
        setDeletingTaxa(row);
        setConfirmOpen(true);
      },
    },
  ];

  const handleExcluirTaxa = async () => {
    if (!deletingTaxa) return;
    setDeletando(true);
    const { error } = await excluirTaxaFinanciamento(deletingTaxa.id);
    setDeletando(false);

    if (error) {
      toast.error('Erro ao excluir prazo de financiamento', error);
    } else {
      toast.success('Alterações salvas com sucesso!');
      setConfirmOpen(false);
      setDeletingTaxa(null);
      await onRefreshTaxas();
    }
  };

  const handleModalSave = async () => {
    setModalOpen(false);
    setEditingTaxa(null);
    await onRefreshTaxas();
  };

  return (
    <>
      <div className="config-locacao-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--spacing-24)' }}>
          <div className="config-locacao-section-header" style={{ marginBottom: 0 }}>
            <h2>Financiamento</h2>
            <p>Taxa de juros mensal por prazo de financiamento.</p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingTaxa(null);
              setModalOpen(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} weight="bold" />
            Novo financiamento
          </Button>
        </div>

        <DataTable<TaxaFinanciamento>
          columns={columns}
          data={taxas}
          loading={loadingTaxas}
          actions={actions}
          emptyMessage="Nenhuma taxa de financiamento cadastrada"
          currentPage={1}
          totalCount={taxas.length}
          itemsPerPage={100}
          onPageChange={() => {}}
          itemLabel="financiamentos"
        />
      </div>

      <FinanciamentoModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTaxa(null);
        }}
        onSave={handleModalSave}
        editingTaxa={editingTaxa}
      />

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
          setDeletingTaxa(null);
        }}
        onConfirm={handleExcluirTaxa}
        title="Confirmar exclusão"
        message={`Tem certeza que deseja excluir o financiamento de ${deletingTaxa?.prazo} meses?`}
        subMessage="Esta ação removerá permanentemente as taxas cadastradas para este prazo."
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        loading={deletando}
      />
    </>
  );
}
