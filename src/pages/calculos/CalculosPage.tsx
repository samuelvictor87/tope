// pages/calculos/CalculosPage.tsx — TOPE
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Tabs } from '../../components/ui/Tabs';
import { LoadingState } from '../../components/ui/LoadingState';
import { useConfiguracoesLocacao } from '../../hooks/useConfiguracoesLocacao';
import { InvestimentosFinanciamento } from '../configuracoes/tabs/InvestimentosFinanciamento';
import { TaxasImpostos } from '../configuracoes/tabs/TaxasImpostos';
import { DepreciacaoCaminhoes } from '../configuracoes/tabs/DepreciacaoCaminhoes';
import { DepreciacaoImplementos } from '../configuracoes/tabs/DepreciacaoImplementos';
import { DespesasOperacionais } from '../configuracoes/tabs/DespesasOperacionais';
import { ConfiguracoesProjeto } from '../configuracoes/tabs/ConfiguracoesProjeto';
import '../../styles/components/configuracoes-locacao.css';

const TABS_CONFIG = [
  { key: 'investimentos-financiamento', label: 'Financiamento' },
  { key: 'taxas-impostos', label: 'Taxas e impostos' },
  { key: 'depreciacao-caminhoes', label: 'Depreciação caminhões' },
  { key: 'depreciacao-implementos', label: 'Depreciação implementos' },
  { key: 'despesas-operacionais', label: 'Despesas operacionais' },
  { key: 'configuracoes-projeto', label: 'Configurações do projeto' },
];

const DEFAULT_TAB = 'investimentos-financiamento';

export function CalculosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const abaAtiva = searchParams.get('aba') || DEFAULT_TAB;

  const {
    configuracao,
    taxas,
    caminhoes,
    categorias,
    loadingConfig,
    loadingTaxas,
    refreshConfig,
    refreshTaxas,
  } = useConfiguracoesLocacao();

  const handleTabChange = (key: string) => {
    setSearchParams({ aba: key });
  };

  const renderTabContent = () => {
    switch (abaAtiva) {
      case 'investimentos-financiamento':
        return (
          <InvestimentosFinanciamento
            taxas={taxas}
            loadingTaxas={loadingTaxas}
            onRefreshTaxas={refreshTaxas}
          />
        );

      case 'taxas-impostos':
        return (
          <TaxasImpostos
            configuracao={configuracao}
            loadingConfig={loadingConfig}
            onRefreshConfig={refreshConfig}
          />
        );

      case 'depreciacao-caminhoes':
        return (
          <DepreciacaoCaminhoes
            caminhoes={caminhoes}
          />
        );

      case 'depreciacao-implementos':
        return (
          <DepreciacaoImplementos
            categorias={categorias}
          />
        );

      case 'despesas-operacionais':
        return (
          <DespesasOperacionais
            configuracao={configuracao}
            loadingConfig={loadingConfig}
            onRefreshConfig={refreshConfig}
          />
        );

      case 'configuracoes-projeto':
        return (
          <ConfiguracoesProjeto
            configuracao={configuracao}
            loadingConfig={loadingConfig}
            onRefreshConfig={refreshConfig}
          />
        );

      default:
        return <LoadingState message="Carregando..." />;
    }
  };

  return (
    <DashboardLayout
      pageTitle="Cálculos"
      pageSubtitle="Defina os parâmetros e regras para o cálculo de locação."
    >
      <div className="config-locacao-page">
        {/* Abas horizontais para as seções de cálculos */}
        <Tabs
          tabs={TABS_CONFIG}
          activeTab={abaAtiva}
          onChange={handleTabChange}
          variant="underline"
        />

        {/* Conteúdo da aba ativa */}
        <div className="config-locacao-tab-content">
          {renderTabContent()}
        </div>
      </div>
    </DashboardLayout>
  );
}
