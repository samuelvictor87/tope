// pages/configuracoes/tabs/TaxasImpostos.tsx — TOPE
import { useState, useEffect } from 'react';
import { InputNumber } from '../../../components/ui/InputNumber';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { LoadingState } from '../../../components/ui/LoadingState';
import { atualizarConfiguracoesLocacao } from '../../../services/configuracoes.service';
import type { ConfiguracaoLocacao } from '../../../types/configuracoes.types';
import '../../../styles/components/configuracoes-locacao.css';

interface TaxasImpostosProps {
  configuracao: ConfiguracaoLocacao | null;
  loadingConfig: boolean;
  onRefreshConfig: () => Promise<void>;
}

export function TaxasImpostos({
  configuracao,
  loadingConfig,
  onRefreshConfig,
}: TaxasImpostosProps) {
  const toast = useToast();

  const [comissao, setComissao] = useState<number | string>('');
  const [imposto, setImposto] = useState<number | string>('');
  const [salvando, setSalvando] = useState(false);

  // Sincronizar campos com dados carregados
  useEffect(() => {
    if (configuracao) {
      setComissao(configuracao.comissao_venda_percentual);
      setImposto(configuracao.imposto_venda_percentual);
    }
  }, [configuracao]);

  const handleSalvar = async () => {
    if (!configuracao?.id) return;

    const comissaoVal = Number(comissao);
    const impostoVal = Number(imposto);

    if (isNaN(comissaoVal) || comissaoVal < 0) {
      toast.error('Erro', 'Comissão deve ser um valor válido.');
      return;
    }
    if (isNaN(impostoVal) || impostoVal < 0) {
      toast.error('Erro', 'Imposto de venda deve ser um valor válido.');
      return;
    }

    setSalvando(true);
    const { error } = await atualizarConfiguracoesLocacao(configuracao.id, {
      comissao_venda_percentual: comissaoVal,
      imposto_venda_percentual: impostoVal,
    });
    setSalvando(false);

    if (error) {
      toast.error('Erro', error);
    } else {
      toast.success('Alterações salvas com sucesso!');
      await onRefreshConfig();
    }
  };

  if (loadingConfig) {
    return <LoadingState message="Carregando taxas e impostos..." />;
  }

  return (
    <div className="config-locacao-section">
      <div className="config-locacao-section-header">
        <h2>Venda – após encerramento do contrato</h2>
        <p>Taxas de corretagem e encargos aplicados na venda pós-locação.</p>
      </div>

      <div className="config-locacao-grid-2">
        <InputNumber
          label="Comissão (%)"
          value={comissao}
          onChange={(v) => setComissao(v)}
          step={0.01}
          min={0}
          required
        />
        <InputNumber
          label="Imposto de venda (%)"
          value={imposto}
          onChange={(v) => setImposto(v)}
          step={0.01}
          min={0}
          required
        />
      </div>

      <div className="config-locacao-footer-actions">
        <Button variant="primary" onClick={handleSalvar} loading={salvando}>
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
