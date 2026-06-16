import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Truck,
  Wrench,
  UsersThree,
  User,
  Users,
  Gear,
  SignOut
} from '@phosphor-icons/react';
import { useAuth } from '../../contexts/AuthContext';
import logoTope from '../../assets/logo-tope.png';
import '../../styles/components/sidebar.css';
import '../../styles/components/header.css';

interface DashboardLayoutProps {
  children?: React.ReactNode;
  pageTitle?: string;
  pageSubtitle?: string;
  headerActions?: React.ReactNode;
}

export function DashboardLayout({
  children,
  pageTitle = 'Painel',
  pageSubtitle,
  headerActions,
}: DashboardLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const menuItems = [
    { path: '/painel/caminhoes', label: 'Caminhões', icon: <Truck size={20} /> },
    { path: '/painel/implementos', label: 'Implementos', icon: <Wrench size={20} /> },
    { path: '/painel/fornecedores', label: 'Fornecedores', icon: <UsersThree size={20} /> },
    { path: '/painel/clientes', label: 'Clientes', icon: <Users size={20} /> },
    { path: '/painel/usuarios', label: 'Usuários', icon: <User size={20} /> },
    { path: '/painel/meus-dados', label: 'Meus dados', icon: <Gear size={20} /> },
  ];

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Error logging out:', err);
    } finally {
      navigate('/login');
    }
  };

  const displayName = profile?.nome_completo || user?.email?.split('@')[0] || 'Usuário';
  const displayRole = profile?.perfil
    ? profile.perfil.charAt(0).toUpperCase() + profile.perfil.slice(1)
    : 'Usuário';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--color-bg-base)' }}>
      {/* Barra Lateral (Sidebar) */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src={logoTope} alt="TOPE" />
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-item ${isActive ? 'sidebar-item-active' : ''}`}
              >
                <span className="sidebar-item-icon">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Rodapé da Sidebar com Usuário Dinâmico */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                avatarLetter
              )}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name" title={displayName}>{displayName}</div>
              <div className="sidebar-user-role">{displayRole}</div>
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.7)',
                cursor: 'pointer',
                padding: 'var(--spacing-4)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Sair"
            >
              <SignOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <div
        style={{
          flex: 1,
          marginLeft: 'var(--sidebar-width)',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
        }}
      >
        {/* Header */}
        <header
          style={{
            height: '64px',
            backgroundColor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-grey-200)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 var(--spacing-24)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <h1 style={{ fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
              {pageTitle}
            </h1>
            {pageSubtitle && (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-grey-500)', margin: 0 }}>
                {pageSubtitle}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-16)' }}>
            {headerActions}
            <Link
              to="/styleguide"
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-primary)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Ir para Styleguide
            </Link>
          </div>
        </header>

        {/* Main Content Area */}
        <main style={{ flex: 1, padding: 'var(--spacing-24)', overflowY: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
