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
  const [impostoIR, setImpostoIR] = useState<number | string>('');
  const [impostoAdicionalIR, setImpostoAdicionalIR] = useState<number | string>('');
  const [impostoCSLL, setImpostoCSLL] = useState<number | string>('');
  const [salvando, setSalvando] = useState(false);

  // Sincronizar campos com dados carregados
  useEffect(() => {
    if (configuracao) {
      setComissao(configuracao.comissao_venda_percentual);
      setImpostoIR(configuracao.imposto_venda_ir_percentual * 100);
      setImpostoAdicionalIR(configuracao.imposto_venda_adicional_ir_percentual * 100);
      setImpostoCSLL(configuracao.imposto_venda_csll_percentual * 100);
    }
  }, [configuracao]);

  const handleSalvar = async () => {
    if (!configuracao?.id) return;

    const comissaoVal = Number(comissao);
    const impostoIRVal = Number(impostoIR);
    const impostoAdicionalIRVal = Number(impostoAdicionalIR);
    const impostoCSLLVal = Number(impostoCSLL);

    if (isNaN(comissaoVal) || comissaoVal < 0) {
      toast.error('Erro', 'Comissão deve ser um valor válido.');
      return;
    }
    if (isNaN(impostoIRVal) || impostoIRVal < 0) {
      toast.error('Erro', 'Imposto sobre a venda — IR deve ser um valor válido.');
      return;
    }
    if (isNaN(impostoAdicionalIRVal) || impostoAdicionalIRVal < 0) {
      toast.error('Erro', 'Imposto sobre a venda — Adicional ao IR deve ser um valor válido.');
      return;
    }
    if (isNaN(impostoCSLLVal) || impostoCSLLVal < 0) {
      toast.error('Erro', 'Imposto sobre a venda — CSLL deve ser um valor válido.');
      return;
    }

    setSalvando(true);
    const { error } = await atualizarConfiguracoesLocacao(configuracao.id, {
      comissao_venda_percentual: comissaoVal,
      imposto_venda_ir_percentual: impostoIRVal / 100,
      imposto_venda_adicional_ir_percentual: impostoAdicionalIRVal / 100,
      imposto_venda_csll_percentual: impostoCSLLVal / 100,
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

      {/* Seção da Comissão */}
      <div style={{ marginBottom: 'var(--spacing-24)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '24px' }}>
          <InputNumber
            label="Comissão (%)"
            value={comissao}
            onChange={(v) => setComissao(v)}
            step={0.01}
            min={0}
            required
          />
        </div>
      </div>

      {/* Seção de Impostos sobre a Venda */}
      <div style={{ 
        borderTop: '1px solid var(--color-grey-100)', 
        paddingTop: 'var(--spacing-20)', 
        marginTop: 'var(--spacing-20)' 
      }}>
        <h3 style={{ 
          fontSize: 'var(--font-size-sm)', 
          fontWeight: 600, 
          color: 'var(--color-grey-800)', 
          marginBottom: '4px' 
        }}>
          Imposto sobre a venda (Tributação sobre o lucro)
        </h3>
        <p style={{ 
          fontSize: 'var(--font-size-xs)', 
          color: 'var(--color-grey-500)', 
          marginBottom: 'var(--spacing-16)' 
        }}>
          Alíquotas incidentes sobre o lucro obtido na venda pós-locação.
        </p>

        <div className="config-locacao-grid-3">
          <InputNumber
            label="IR (%)"
            value={impostoIR}
            onChange={(v) => setImpostoIR(v)}
            step={0.01}
            min={0}
            required
          />
          <InputNumber
            label="Adicional ao IR (%)"
            value={impostoAdicionalIR}
            onChange={(v) => setImpostoAdicionalIR(v)}
            step={0.01}
            min={0}
            required
          />
          <InputNumber
            label="CSLL (%)"
            value={impostoCSLL}
            onChange={(v) => setImpostoCSLL(v)}
            step={0.01}
            min={0}
            required
          />
        </div>
      </div>

      <div className="config-locacao-footer-actions">
        <Button variant="primary" onClick={handleSalvar} loading={salvando}>
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
