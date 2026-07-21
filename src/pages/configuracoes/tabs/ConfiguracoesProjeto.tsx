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
    <div className="tab-content-container">
      <div className="tab-header">
        <h3 className="tab-title">Configurações gerais do projeto e proposta</h3>
        <p className="tab-description">
          Parâmetros comerciais padronizados para criação de propostas e projetos.
        </p>
      </div>

      <div className="tab-form" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-grey-800)', marginBottom: '6px', display: 'block' }}>
              Forma de pagamento (Dias) *
            </label>
            <InputNumber
              value={formaPagamentoDias}
              onChange={(val) => setFormaPagamentoDias(val)}
              placeholder="30"
              min={0}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-grey-450)', marginTop: '4px', display: 'block' }}>
              Prazo em dias padrão para pagamento (ex: 30 dias).
            </span>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-grey-800)', marginBottom: '6px', display: 'block' }}>
              Validade da proposta (Dias) *
            </label>
            <InputNumber
              value={validadePropostaDias}
              onChange={(val) => setValidadePropostaDias(val)}
              placeholder="10"
              min={0}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-grey-450)', marginTop: '4px', display: 'block' }}>
              Validade padrão da proposta comercial (ex: 10 dias).
            </span>
          </div>

          <div>
            <Input
              label="Índice de reajuste *"
              type="text"
              value={indiceReajuste}
              onChange={(e) => setIndiceReajuste(e.target.value)}
              placeholder="IPCA / IGP-M"
              required
            />
            <span style={{ fontSize: '11px', color: 'var(--color-grey-450)', marginTop: '4px', display: 'block' }}>
              Descrição do índice de reajuste anual.
            </span>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-grey-800)', marginBottom: '6px', display: 'block' }}>
              Multa da rescisão antecipada (%) *
            </label>
            <InputNumber
              value={multaRescisao}
              onChange={(val) => setMultaRescisao(val)}
              placeholder="15"
              min={0}
              max={100}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-grey-450)', marginTop: '4px', display: 'block' }}>
              Porcentagem da multa por rescisão antecipada (ex: 15%).
            </span>
          </div>
        </div>

        <div className="tab-footer" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', marginTop: '12px' }}>
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
    </div>
  );
}
