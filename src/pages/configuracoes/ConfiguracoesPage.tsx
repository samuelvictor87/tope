// pages/configuracoes/ConfiguracoesPage.tsx — TOPE
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Tabs } from '../../components/ui/Tabs';
import { PerfilDados } from './tabs/PerfilDados';
import { PerfilSenha } from './tabs/PerfilSenha';
import '../../styles/components/configuracoes-locacao.css';

const TABS_CONFIG = [
  { key: 'dados', label: 'Dados pessoais' },
  { key: 'senha', label: 'Senha' },
];

const DEFAULT_TAB = 'dados';

export function ConfiguracoesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const abaAtiva = searchParams.get('aba') || DEFAULT_TAB;

  const handleTabChange = (key: string) => {
    setSearchParams({ aba: key });
  };

  const renderTabContent = () => {
    switch (abaAtiva) {
      case 'dados':
        return <PerfilDados />;
      case 'senha':
        return <PerfilSenha />;
      default:
        return <PerfilDados />;
    }
  };

  return (
    <DashboardLayout
      pageTitle="Configurações"
      pageSubtitle="Gerencie suas informações pessoais e de acesso."
    >
      <div className="config-locacao-page">
        <Tabs
          tabs={TABS_CONFIG}
          activeTab={abaAtiva}
          onChange={handleTabChange}
          variant="underline"
        />

        <div className="config-locacao-tab-content">
          {renderTabContent()}
        </div>
      </div>
    </DashboardLayout>
  );
}
