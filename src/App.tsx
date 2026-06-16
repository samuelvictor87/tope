import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { StyleGuidePage } from './pages/styleguide/StyleGuidePage';
import { LoginPage } from './pages/login/LoginPage';
import { UsuariosPage } from './pages/usuarios/UsuariosPage';
import { ClientesPage } from './pages/clientes/ClientesPage';
import { FornecedoresPage } from './pages/fornecedores/FornecedoresPage';
import { MeusDadosPage } from './pages/meus-dados/MeusDadosPage';
import { ImplementosPage } from './pages/implementos/ImplementosPage';
import { CaminhoesPage } from './pages/caminhoes/CaminhoesPage';

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
            <Route path="/configuracoes" element={<Navigate to="/painel/meus-dados" replace />} />

            {/* Rotas protegidas sob o painel */}
            <Route path="/painel/usuarios" element={<ProtectedRoute><UsuariosPage /></ProtectedRoute>} />
            <Route path="/painel/caminhoes" element={<ProtectedRoute><CaminhoesPage /></ProtectedRoute>} />
            <Route path="/painel/implementos" element={<ProtectedRoute><ImplementosPage /></ProtectedRoute>} />
            <Route path="/painel/fornecedores" element={<ProtectedRoute><FornecedoresPage /></ProtectedRoute>} />
            <Route path="/painel/clientes" element={<ProtectedRoute><ClientesPage /></ProtectedRoute>} />
            <Route path="/painel/meus-dados" element={<ProtectedRoute><MeusDadosPage /></ProtectedRoute>} />

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
