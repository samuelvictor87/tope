// pages/configuracoes/modals/DepreciacaoCaminhaoModal.tsx — TOPE
import { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import type { OptionType } from '../../../components/ui/Select';
import { InputNumber } from '../../../components/ui/InputNumber';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { ArrowDown } from '@phosphor-icons/react';
import type {
  DepreciacaoCaminhao,
  Caminhao,
  TipoUsoDepreciacao,
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
}

export function DepreciacaoCaminhaoModal({
  isOpen,
  onClose,
  onSave,
  editingDep,
  caminhoes,
}: DepreciacaoCaminhaoModalProps) {
  const toast = useToast();
  const isEditing = !!editingDep;

  const [caminhaoId, setCaminhaoId] = useState<OptionType | null>(null);
  const [tipoUso, setTipoUso] = useState<OptionType | null>(null);
  const [anos, setAnos] = useState<(number | string)[]>(Array(10).fill(''));
  const [salvando, setSalvando] = useState(false);

  // Opções para os selects
  const caminhaoOptions: OptionType[] = caminhoes.map((c) => ({
    value: c.id,
    label: `${c.familia} — ${c.modelo} (${Array.isArray(c.transmissao) ? c.transmissao.join(', ') : c.transmissao})`,
  }));

  const tipoUsoOptions: OptionType[] = TIPOS_USO_DEPRECIACAO.map((t) => ({
    value: t,
    label: t,
  }));

  // Inicializar ou resetar
  useEffect(() => {
    if (isOpen && editingDep) {
      const caminhaoOpt = caminhaoOptions.find((o) => o.value === editingDep.caminhao_id) ?? null;
      const tipoOpt = tipoUsoOptions.find((o) => o.value === editingDep.tipo_uso) ?? null;
      setCaminhaoId(caminhaoOpt);
      setTipoUso(tipoOpt);
      setAnos([
        editingDep.ano_1 ?? '',
        editingDep.ano_2 ?? '',
        editingDep.ano_3 ?? '',
        editingDep.ano_4 ?? '',
        editingDep.ano_5 ?? '',
        editingDep.ano_6 ?? '',
        editingDep.ano_7 ?? '',
        editingDep.ano_8 ?? '',
        editingDep.ano_9 ?? '',
        editingDep.ano_10 ?? '',
      ]);
    } else if (!isOpen) {
      setCaminhaoId(null);
      setTipoUso(null);
      setAnos(Array(10).fill(''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editingDep]);

  const updateAno = (index: number, val: number | string) => {
    setAnos((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const copiarParaBaixo = (index: number) => {
    const valorParaCopiar = anos[index];
    setAnos((prev) => {
      const next = [...prev];
      for (let i = index + 1; i < 10; i++) {
        next[i] = valorParaCopiar;
      }
      return next;
    });
    toast.success('Sucesso', 'Valor copiado para os anos seguintes!');
  };

  const handleSalvar = async () => {
    if (!caminhaoId) {
      toast.error('Erro', 'Selecione um caminhão.');
      return;
    }

    if (!tipoUso) {
      toast.error('Erro', 'Selecione o tipo de uso.');
      return;
    }

    // Validar anos
    for (let i = 0; i < 10; i++) {
      const val = anos[i];
      if (val !== '') {
        const num = Number(val);
        if (isNaN(num) || num <= 0) {
          toast.error('Erro', `A depreciação do ${i + 1}º ano deve ser um valor positivo.`);
          return;
        }
      }
    }

    const payload = {
      caminhao_id: caminhaoId.value,
      tipo_uso: tipoUso.value as TipoUsoDepreciacao,
      ano_1: anos[0] === '' ? null : Number(anos[0]),
      ano_2: anos[1] === '' ? null : Number(anos[1]),
      ano_3: anos[2] === '' ? null : Number(anos[2]),
      ano_4: anos[3] === '' ? null : Number(anos[3]),
      ano_5: anos[4] === '' ? null : Number(anos[4]),
      ano_6: anos[5] === '' ? null : Number(anos[5]),
      ano_7: anos[6] === '' ? null : Number(anos[6]),
      ano_8: anos[7] === '' ? null : Number(anos[7]),
      ano_9: anos[8] === '' ? null : Number(anos[8]),
      ano_10: anos[9] === '' ? null : Number(anos[9]),
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

  const renderAnoInput = (index: number) => {
    const num = index + 1;
    return (
      <div key={index} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
        <div style={{ flex: 1 }}>
          <InputNumber
            label={`${num}º ano (% aa)`}
            value={anos[index]}
            onChange={(v) => updateAno(index, v)}
            step={0.01}
            min={0}
          />
        </div>
        {index < 9 && (
          <Button
            variant="secondary"
            onClick={() => copiarParaBaixo(index)}
            title="Copiar este valor para todos os anos seguintes"
            style={{
              padding: 0,
              height: '38px',
              width: '38px',
              minWidth: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            type="button"
          >
            <ArrowDown size={18} />
          </Button>
        )}
        {index === 9 && (
          <div style={{ width: '38px' }} /> /* Espaço reserva para manter os inputs alinhados */
        )}
      </div>
    );
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar depreciação' : 'Nova depreciação'}
      size="lg"
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Select
            label="Caminhão"
            options={caminhaoOptions}
            value={caminhaoId}
            onChange={(opt) => setCaminhaoId(opt as OptionType | null)}
            isClearable
            isSearchable
            placeholder="Selecione..."
          />
          <Select
            label="Tipo de uso"
            options={tipoUsoOptions}
            value={tipoUso}
            onChange={(opt) => setTipoUso(opt as OptionType | null)}
            isClearable
            placeholder="Selecione..."
          />
        </div>

        <div style={{ borderTop: '1px solid var(--color-neutral-200)', paddingTop: 16 }}>
          <h4 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-neutral-700)', marginBottom: 12 }}>
            Depreciação por ano (% aa)
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[0, 1, 2, 3, 4].map((index) => renderAnoInput(index))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[5, 6, 7, 8, 9].map((index) => renderAnoInput(index))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
