// pages/configuracoes/tabs/DespesasOperacionais.tsx — TOPE
import { useState, useEffect } from 'react';
import { InputNumber } from '../../../components/ui/InputNumber';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { LoadingState } from '../../../components/ui/LoadingState';
import { atualizarConfiguracoesLocacao } from '../../../services/configuracoes.service';
import type { ConfiguracaoLocacao } from '../../../types/configuracoes.types';
import '../../../styles/components/configuracoes-locacao.css';

interface DespesasOperacionaisProps {
  configuracao: ConfiguracaoLocacao | null;
  loadingConfig: boolean;
  onRefreshConfig: () => Promise<void>;
}

export function DespesasOperacionais({
  configuracao,
  loadingConfig,
  onRefreshConfig,
}: DespesasOperacionaisProps) {
  const toast = useToast();

  const [documentacao, setDocumentacao] = useState<number | string>('');
  const [ipvaDesconto, setIpvaDesconto] = useState<number | string>('');
  const [ipvaDepreciacao, setIpvaDepreciacao] = useState<number | string>('');
  const [reajusteAluguel, setReajusteAluguel] = useState<number | string>('');
  const [mesesAntes, setMesesAntes] = useState<number | string>('');
  const [mesesDepois, setMesesDepois] = useState<number | string>('');
  const [salvando, setSalvando] = useState(false);

  // Sincronizar campos com dados carregados
  useEffect(() => {
    if (configuracao) {
      setDocumentacao(configuracao.documentacao_valor);
      setIpvaDesconto(configuracao.ipva_desconto_vista_percentual * 100);
      setIpvaDepreciacao(configuracao.ipva_depreciacao_percentual * 100);
      setReajusteAluguel(configuracao.reajuste_aluguel_anual_percentual * 100);
      setMesesAntes(configuracao.meses_antes_aluguel ?? 1);
      setMesesDepois(configuracao.meses_depois_aluguel ?? 3);
    }
  }, [configuracao]);

  const handleSalvar = async () => {
    if (!configuracao?.id) return;

    const documentacaoVal = Number(documentacao);
    const ipvaDescontoVal = Number(ipvaDesconto);
    const ipvaDepreciacaoVal = Number(ipvaDepreciacao);
    const reajusteAluguelVal = Number(reajusteAluguel);
    const mesesAntesVal = Number(mesesAntes);
    const mesesDepoisVal = Number(mesesDepois);

    if (isNaN(documentacaoVal) || documentacaoVal < 0) {
      toast.error('Erro', 'Valor de documentação deve ser válido.');
      return;
    }
    if (isNaN(ipvaDescontoVal) || ipvaDescontoVal < 0) {
      toast.error('Erro', 'IPVA desconto à vista deve ser um valor válido.');
      return;
    }
    if (isNaN(ipvaDepreciacaoVal) || ipvaDepreciacaoVal < 0) {
      toast.error('Erro', 'IPVA depreciação deve ser um valor válido.');
      return;
    }
    if (isNaN(reajusteAluguelVal) || reajusteAluguelVal < 0) {
      toast.error('Erro', 'Índice de reajuste anual deve ser um valor válido.');
      return;
    }
    if (isNaN(mesesAntesVal) || mesesAntesVal < 0) {
      toast.error('Erro', 'Meses antes do aluguel deve ser um valor válido.');
      return;
    }
    if (isNaN(mesesDepoisVal) || mesesDepoisVal < 0) {
      toast.error('Erro', 'Meses depois do aluguel deve ser um valor válido.');
      return;
    }

    setSalvando(true);
    const { error } = await atualizarConfiguracoesLocacao(configuracao.id, {
      documentacao_valor: documentacaoVal,
      ipva_desconto_vista_percentual: ipvaDescontoVal / 100,
      ipva_depreciacao_percentual: ipvaDepreciacaoVal / 100,
      reajuste_aluguel_anual_percentual: reajusteAluguelVal / 100,
      meses_antes_aluguel: mesesAntesVal,
      meses_depois_aluguel: mesesDepoisVal,
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
    return <LoadingState message="Carregando despesas operacionais..." />;
  }

  return (
    <div className="config-locacao-section">
      <div className="config-locacao-section-header">
        <h2>Despesas operacionais</h2>
        <p>Parâmetros operacionais e custos de licenciamento de veículos.</p>
      </div>

      <div className="config-locacao-grid-4">
        <InputNumber
          label="Documentação (R$)"
          value={documentacao}
          onChange={(v) => setDocumentacao(v)}
          step={0.01}
          min={0}
          required
        />
        <InputNumber
          label="IPVA desconto à vista (%)"
          value={ipvaDesconto}
          onChange={(v) => setIpvaDesconto(v)}
          step={0.01}
          min={0}
          required
        />
        <InputNumber
          label="IPVA depreciação (%)"
          value={ipvaDepreciacao}
          onChange={(v) => setIpvaDepreciacao(v)}
          step={0.01}
          min={0}
          required
        />
        <InputNumber
          label="Reajuste anual aluguel (%)"
          value={reajusteAluguel}
          onChange={(v) => setReajusteAluguel(v)}
          step={0.01}
          min={0}
          required
        />
      </div>

      {/* Seção de Ciclo de Vida do Ativo (Prazos Adicionais) */}
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
          Ciclo de Vida do Ativo (Prazos Adicionais)
        </h3>
        <p style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-grey-500)',
          marginBottom: 'var(--spacing-16)'
        }}>
          Prazos em meses para preparação (antes da locação) e desmobilização/venda (após a locação).
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', maxWidth: '460px' }}>
          <InputNumber
            label="Meses antes (Preparação)"
            value={mesesAntes}
            onChange={(v) => setMesesAntes(v)}
            step={1}
            min={0}
            required
          />
          <InputNumber
            label="Meses depois (Venda)"
            value={mesesDepois}
            onChange={(v) => setMesesDepois(v)}
            step={1}
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
