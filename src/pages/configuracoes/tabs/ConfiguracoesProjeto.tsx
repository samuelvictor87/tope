// pages/configuracoes/tabs/ConfiguracoesProjeto.tsx — TOPE
import { useState, useEffect } from 'react';
import { Input } from '../../../components/ui/Input';
import { InputNumber } from '../../../components/ui/InputNumber';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { LoadingState } from '../../../components/ui/LoadingState';
import { atualizarConfiguracoesLocacao } from '../../../services/configuracoes.service';
import type { ConfiguracaoLocacao } from '../../../types/configuracoes.types';
import '../../../styles/components/configuracoes-locacao.css';

interface ConfiguracoesProjetoProps {
  configuracao: ConfiguracaoLocacao | null;
  loadingConfig: boolean;
  onRefreshConfig: () => Promise<void>;
}

export function ConfiguracoesProjeto({
  configuracao,
  loadingConfig,
  onRefreshConfig,
}: ConfiguracoesProjetoProps) {
  const toast = useToast();

  const [formaPagamentoDias, setFormaPagamentoDias] = useState<number | string>(30);
  const [validadePropostaDias, setValidadePropostaDias] = useState<number | string>(10);
  const [indiceReajuste, setIndiceReajuste] = useState<string>('IPCA / IGP-M');
  const [multaRescisao, setMultaRescisao] = useState<number | string>(15);
  const [salvando, setSalvando] = useState(false);

  // Sincronizar campos com dados carregados do banco
  useEffect(() => {
    if (configuracao) {
      setFormaPagamentoDias(configuracao.forma_pagamento_dias_default ?? 30);
      setValidadePropostaDias(configuracao.validade_proposta_dias_default ?? 10);
      setIndiceReajuste(configuracao.indice_reajuste_default || 'IPCA / IGP-M');
      setMultaRescisao(
        configuracao.multa_rescisao_antecipada_percentual_default !== undefined
          ? configuracao.multa_rescisao_antecipada_percentual_default * 100
          : 15
      );
    }
  }, [configuracao]);

  const handleSalvar = async () => {
    if (!configuracao?.id) return;

    const formaPagamentoVal = Number(formaPagamentoDias);
    const validadePropostaVal = Number(validadePropostaDias);
    const multaRescisaoVal = Number(multaRescisao);

    if (isNaN(formaPagamentoVal) || formaPagamentoVal < 0) {
      toast.error('Erro', 'Forma de pagamento (em dias) deve ser um valor válido.');
      return;
    }
    if (isNaN(validadePropostaVal) || validadePropostaVal < 0) {
      toast.error('Erro', 'Validade da proposta (em dias) deve ser um valor válido.');
      return;
    }
    if (!indiceReajuste.trim()) {
      toast.error('Erro', 'Informe o índice de reajuste (ex: IPCA / IGP-M).');
      return;
    }
    if (isNaN(multaRescisaoVal) || multaRescisaoVal < 0) {
      toast.error('Erro', 'Multa de rescisão antecipada deve ser um valor válido.');
      return;
    }

    setSalvando(true);
    const { error } = await atualizarConfiguracoesLocacao(configuracao.id, {
      forma_pagamento_dias_default: formaPagamentoVal,
      validade_proposta_dias_default: validadePropostaVal,
      indice_reajuste_default: indiceReajuste.trim(),
      multa_rescisao_antecipada_percentual_default: multaRescisaoVal / 100,
    });
    setSalvando(false);

    if (error) {
      toast.error('Erro', error);
    } else {
      toast.success('Sucesso', 'Configurações do projeto atualizadas com sucesso.');
      await onRefreshConfig();
    }
  };

  if (loadingConfig && !configuracao) {
    return <LoadingState message="Carregando configurações..." />;
  }

  return (
    <div className="config-locacao-section">
      <div className="config-locacao-section-header">
        <h2>Configurações do projeto</h2>
        <p>Parâmetros comerciais padronizados para criação de propostas e projetos.</p>
      </div>

      <div className="config-locacao-grid-4">
        <InputNumber
          label="Forma de pagamento (Dias)"
          value={formaPagamentoDias}
          onChange={(v) => setFormaPagamentoDias(v)}
          step={1}
          min={0}
          required
        />
        <InputNumber
          label="Validade da proposta (Dias)"
          value={validadePropostaDias}
          onChange={(v) => setValidadePropostaDias(v)}
          step={1}
          min={0}
          required
        />
        <Input
          label="Índice de reajuste"
          type="text"
          value={indiceReajuste}
          onChange={(e) => setIndiceReajuste(e.target.value)}
          placeholder="IPCA / IGP-M"
          required
        />
        <InputNumber
          label="Multa rescisão antecipada (%)"
          value={multaRescisao}
          onChange={(v) => setMultaRescisao(v)}
          step={0.01}
          min={0}
          required
        />
      </div>

      <div className="config-locacao-footer-actions">
        <Button
          variant="primary"
          onClick={handleSalvar}
          loading={salvando}
          disabled={salvando}
        >
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}
