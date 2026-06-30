// pages/configuracoes/modals/DepreciacaoCaminhaoModal.tsx — TOPE
import { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import type { OptionType } from '../../../components/ui/Select';
import { InputNumber } from '../../../components/ui/InputNumber';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import type {
  DepreciacaoCaminhao,
  Caminhao,
  TaxaFinanciamento,
  TipoUsoDepreciacao,
  PrazoContrato,
} from '../../../types/configuracoes.types';
import { TIPOS_USO_DEPRECIACAO } from '../../../types/configuracoes.types';
import {
  criarDepreciacaoCaminhao,
  atualizarDepreciacaoCaminhao,
} from '../../../services/configuracoes.service';

interface DepreciacaoCaminhaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  editingDep: DepreciacaoCaminhao | null;
  caminhoes: Caminhao[];
  taxas: TaxaFinanciamento[];
}

export function DepreciacaoCaminhaoModal({
  isOpen,
  onClose,
  onSave,
  editingDep,
  caminhoes,
  taxas,
}: DepreciacaoCaminhaoModalProps) {
  const toast = useToast();
  const isEditing = !!editingDep;

  const [caminhaoId, setCaminhaoId] = useState<OptionType | null>(null);
  const [prazo, setPrazo] = useState<OptionType | null>(null);
  const [tipoUso, setTipoUso] = useState<OptionType | null>(null);
  const [depreciacao, setDepreciacao] = useState<number | string>('');
  const [salvando, setSalvando] = useState(false);

  // Opções para os selects
  const caminhaoOptions: OptionType[] = caminhoes.map((c) => ({
    value: c.id,
    label: `${c.familia} — ${c.modelo} (${Array.isArray(c.transmissao) ? c.transmissao.join(', ') : c.transmissao})`,
  }));

  const prazoOptions: OptionType[] = taxas.map((t) => ({
    value: t.prazo.toString(),
    label: `${t.prazo} meses`,
  }));

  const tipoUsoOptions: OptionType[] = TIPOS_USO_DEPRECIACAO.map((t) => ({
    value: t,
    label: t,
  }));

  // Inicializar ou resetar
  useEffect(() => {
    if (isOpen && editingDep) {
      const caminhaoOpt = caminhaoOptions.find((o) => o.value === editingDep.caminhao_id) ?? null;
      const prazoOpt = prazoOptions.find((o) => o.value === editingDep.prazo.toString()) ?? null;
      const tipoOpt = tipoUsoOptions.find((o) => o.value === editingDep.tipo_uso) ?? null;
      setCaminhaoId(caminhaoOpt);
      setPrazo(prazoOpt);
      setTipoUso(tipoOpt);
      setDepreciacao(editingDep.depreciacao_anual_percentual);
    } else if (!isOpen) {
      setCaminhaoId(null);
      setPrazo(null);
      setTipoUso(null);
      setDepreciacao('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingDep]);

  const handleSalvar = async () => {
    if (!caminhaoId) {
      toast.error('Erro', 'Selecione um caminhão.');
      return;
    }
    if (!prazo) {
      toast.error('Erro', 'Selecione um prazo.');
      return;
    }
    if (!tipoUso) {
      toast.error('Erro', 'Selecione o tipo de uso.');
      return;
    }
    const depVal = Number(depreciacao);
    if (depreciacao === '' || isNaN(depVal) || depVal <= 0) {
      toast.error('Erro', 'A depreciação anual deve ser um valor positivo.');
      return;
    }

    const payload = {
      caminhao_id: caminhaoId.value,
      prazo: prazo.value as PrazoContrato,
      tipo_uso: tipoUso.value as TipoUsoDepreciacao,
      depreciacao_anual_percentual: depVal,
    };

    setSalvando(true);

    if (isEditing) {
      const { error } = await atualizarDepreciacaoCaminhao(editingDep.id, payload);
      setSalvando(false);

      if (error) {
        toast.error('Erro', error);
      } else {
        toast.success('Alterações salvas com sucesso!');
        await onSave();
      }
    } else {
      const { error } = await criarDepreciacaoCaminhao(payload);
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
      title={isEditing ? 'Editar depreciação' : 'Nova depreciação'}
      size="md"
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
          label="Caminhão"
          options={caminhaoOptions}
          value={caminhaoId}
          onChange={(opt) => setCaminhaoId(opt as OptionType | null)}
          isClearable
          isSearchable
          placeholder="Selecione o caminhão..."
        />
        <Select
          label="Prazo"
          options={prazoOptions}
          value={prazo}
          onChange={(opt) => setPrazo(opt as OptionType | null)}
          isClearable
          placeholder="Selecione o prazo..."
        />
        <Select
          label="Tipo de uso"
          options={tipoUsoOptions}
          value={tipoUso}
          onChange={(opt) => setTipoUso(opt as OptionType | null)}
          isClearable
          placeholder="Selecione o tipo..."
        />
        <InputNumber
          label="Depreciação anual (% aa)"
          value={depreciacao}
          onChange={(v) => setDepreciacao(v)}
          step={0.01}
          min={0}
          required
        />
      </div>
    </Modal>
  );
}
