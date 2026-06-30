// hooks/useConfiguracoesLocacao.ts — TOPE
import { useState, useEffect, useCallback } from 'react';
import type {
  ConfiguracaoLocacao,
  TaxaFinanciamento,
  Caminhao,
  Categoria,
} from '../types/configuracoes.types';
import {
  buscarConfiguracoesLocacao,
  listarTaxasFinanciamento,
  listarCaminhoes,
  listarCategorias,
} from '../services/configuracoes.service';

interface UseConfiguracoesLocacaoReturn {
  // Dados
  configuracao: ConfiguracaoLocacao | null;
  taxas: TaxaFinanciamento[];
  caminhoes: Caminhao[];
  categorias: Categoria[];

  // Loading states
  loadingConfig: boolean;
  loadingTaxas: boolean;

  // Refresh functions
  refreshConfig: () => Promise<void>;
  refreshTaxas: () => Promise<void>;
}

export function useConfiguracoesLocacao(): UseConfiguracoesLocacaoReturn {
  const [configuracao, setConfiguracao] = useState<ConfiguracaoLocacao | null>(null);
  const [taxas, setTaxas] = useState<TaxaFinanciamento[]>([]);
  const [caminhoes, setCaminhoes] = useState<Caminhao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingTaxas, setLoadingTaxas] = useState(true);

  const refreshConfig = useCallback(async () => {
    setLoadingConfig(true);
    const data = await buscarConfiguracoesLocacao();
    setConfiguracao(data);
    setLoadingConfig(false);
  }, []);

  const refreshTaxas = useCallback(async () => {
    setLoadingTaxas(true);
    const data = await listarTaxasFinanciamento();
    setTaxas(data);
    setLoadingTaxas(false);
  }, []);

  useEffect(() => {
    refreshConfig();
    refreshTaxas();

    // Carregar dados de referência (selects)
    listarCaminhoes().then(setCaminhoes);
    listarCategorias().then(setCategorias);
  }, [refreshConfig, refreshTaxas]);

  return {
    configuracao,
    taxas,
    caminhoes,
    categorias,
    loadingConfig,
    loadingTaxas,
    refreshConfig,
    refreshTaxas,
  };
}
