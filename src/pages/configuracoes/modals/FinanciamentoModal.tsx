// pages/configuracoes/modals/FinanciamentoModal.tsx — TOPE
import { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import type { OptionType } from '../../../components/ui/Select';
import { InputNumber } from '../../../components/ui/InputNumber';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import type { TaxaFinanciamento, PrazoContrato } from '../../../types/configuracoes.types';
import { PRAZOS_CONTRATO } from '../../../types/configuracoes.types';
import {
  criarTaxaFinanciamento,
  atualizarTaxaFinanciamento,
} from '../../../services/configuracoes.service';

interface FinanciamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  editingTaxa: TaxaFinanciamento | null;
}

export function FinanciamentoModal({
  isOpen,
  onClose,
  onSave,
  editingTaxa,
}: FinanciamentoModalProps) {
  const toast = useToast();
  const isEditing = !!editingTaxa;

  const [prazo, setPrazo] = useState<OptionType | null>(null);
  const [juros, setJuros] = useState<number | string>('');
  const [salvando, setSalvando] = useState(false);

  // Opções para o select
  const prazoOptions: OptionType[] = PRAZOS_CONTRATO.map((p) => ({
    value: p,
    label: `${p} meses`,
  }));

  // Inicializar ou resetar quando abre/fecha
  useEffect(() => {
    if (isOpen && editingTaxa) {
      const prazoOpt = prazoOptions.find((o) => o.value === editingTaxa.prazo) ?? null;
      setPrazo(prazoOpt);
      setJuros(editingTaxa.juros_mensal_percentual);
    } else if (!isOpen) {
      setPrazo(null);
      setJuros('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingTaxa]);

  const handleSalvar = async () => {
    const jurosVal = Number(juros);

    if (!prazo) {
      toast.error('Erro', 'Selecione um prazo.');
      return;
    }
    if (juros === '' || isNaN(jurosVal) || jurosVal <= 0) {
      toast.error('Erro', 'Os juros devem ser um valor positivo.');
      return;
    }

    setSalvando(true);

    if (isEditing) {
      const { error } = await atualizarTaxaFinanciamento(editingTaxa.id, {
        juros_mensal_percentual: jurosVal,
      });
      setSalvando(false);

      if (error) {
        toast.error('Erro', error);
      } else {
        toast.success('Alterações salvas com sucesso!');
        await onSave();
      }
    } else {
      const { error } = await criarTaxaFinanciamento({
        prazo: prazo.value as PrazoContrato,
        juros_mensal_percentual: jurosVal,
      });
      setSalvando(false);

      if (error) {
        toast.error('Erro', error);
      } else {
        toast.success('Alterações salvas com sucesso!');
        await onSave();
      }
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar financiamento' : 'Novo financiamento'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSalvar} loading={salvando}>
            Salvar
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Select
          label="Prazo"
          options={prazoOptions}
          value={prazo}
          onChange={(opt) => setPrazo(opt as OptionType | null)}
          isClearable
          placeholder="Selecione o prazo..."
          isDisabled={isEditing}
        />
        <InputNumber
          label="Juros mensal (%)"
          value={juros}
          onChange={(v) => setJuros(v)}
          step={0.01}
          min={0}
          required
        />
      </div>
    </Modal>
  );
}
