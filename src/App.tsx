import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { StyleGuidePage } from './pages/styleguide/StyleGuidePage';
import { LoginPage } from './pages/login/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { UsuariosPage } from './pages/usuarios/UsuariosPage';
import { ClientesPage } from './pages/clientes/ClientesPage';
import { FornecedoresPage } from './pages/fornecedores/FornecedoresPage';
import { MeusDadosPage } from './pages/meus-dados/MeusDadosPage';
import { ImplementosPage } from './pages/implementos/ImplementosPage';
import { CaminhoesPage } from './pages/caminhoes/CaminhoesPage';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* Rota principal de Login */}
          <Route path="/" element={<LoginPage />} />

          {/* Rota do Dashboard Principal */}
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Rotas dos menus de cadastro (placeholders temporários) */}
          <Route path="/usuarios" element={<UsuariosPage />} />
          <Route path="/caminhoes" element={<CaminhoesPage />} />
          <Route path="/implementos" element={<ImplementosPage />} />
          <Route path="/fornecedores" element={<FornecedoresPage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/meus-dados" element={<MeusDadosPage />} />
          <Route path="/configuracoes" element={<MeusDadosPage />} />

          {/* Rota do Styleguide */}
          <Route path="/styleguide" element={<StyleGuidePage />} />

          {/* Redirecionamento de rotas inexistentes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
