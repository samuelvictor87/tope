import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { StyleGuidePage } from './pages/styleguide/StyleGuidePage';
import { LoginPage } from './pages/login/LoginPage';
import { UsuariosPage } from './pages/usuarios/UsuariosPage';
import { ClientesPage } from './pages/clientes/ClientesPage';
import { FornecedoresPage } from './pages/fornecedores/FornecedoresPage';
import { ImplementosPage } from './pages/implementos/ImplementosPage';
import { CaminhoesPage } from './pages/caminhoes/CaminhoesPage';
import { ConfiguracoesPage } from './pages/configuracoes/ConfiguracoesPage';
import { NovaCotacaoPage } from './pages/cotacoes/NovaCotacaoPage';
import { CalculosPage } from './pages/calculos/CalculosPage';
import { ProjetosPage } from './pages/projetos/ProjetosPage';
import { ProjetoDetalhesPage } from './pages/projetos/ProjetoDetalhesPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Rota principal redireciona para login */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            
            {/* Rota de Login */}
            <Route path="/login" element={<LoginPage />} />

            {/* Rotas legadas para compatibilidade/redirecionamento */}
            <Route path="/dashboard" element={<Navigate to="/painel/usuarios" replace />} />
            <Route path="/usuarios" element={<Navigate to="/painel/usuarios" replace />} />
            <Route path="/caminhoes" element={<Navigate to="/painel/caminhoes" replace />} />
            <Route path="/implementos" element={<Navigate to="/painel/implementos" replace />} />
            <Route path="/fornecedores" element={<Navigate to="/painel/fornecedores" replace />} />
            <Route path="/clientes" element={<Navigate to="/painel/clientes" replace />} />
            <Route path="/meus-dados" element={<Navigate to="/painel/meus-dados" replace />} />
            <Route path="/configuracoes" element={<Navigate to="/painel/configuracoes" replace />} />

            {/* Rotas protegidas sob o painel */}
            <Route path="/painel/usuarios" element={<ProtectedRoute><UsuariosPage /></ProtectedRoute>} />
            <Route path="/painel/caminhoes" element={<ProtectedRoute><CaminhoesPage /></ProtectedRoute>} />
            <Route path="/painel/implementos" element={<ProtectedRoute><ImplementosPage /></ProtectedRoute>} />
            <Route path="/painel/fornecedores" element={<ProtectedRoute><FornecedoresPage /></ProtectedRoute>} />
            <Route path="/painel/clientes" element={<ProtectedRoute><ClientesPage /></ProtectedRoute>} />
            <Route path="/painel/configuracoes" element={<ProtectedRoute><ConfiguracoesPage /></ProtectedRoute>} />
            <Route path="/painel/meus-dados" element={<Navigate to="/painel/configuracoes?aba=dados" replace />} />
            <Route path="/painel/calculos" element={<ProtectedRoute><CalculosPage /></ProtectedRoute>} />
            <Route path="/painel/projetos" element={<ProtectedRoute><ProjetosPage /></ProtectedRoute>} />
            <Route path="/painel/projetos/:id" element={<ProtectedRoute><ProjetoDetalhesPage /></ProtectedRoute>} />
            <Route path="/painel/cotacoes/nova" element={<ProtectedRoute><NovaCotacaoPage /></ProtectedRoute>} />
            <Route path="/painel/cotacoes/:id/editar" element={<ProtectedRoute><NovaCotacaoPage /></ProtectedRoute>} />

            {/* Rota do Styleguide */}
            <Route path="/styleguide" element={<StyleGuidePage />} />

            {/* Redirecionamento de rotas inexistentes */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
