import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import logoTope from '../../assets/logo-tope.png';
import bgLogin from '../../assets/login-bg.jpg';
import '../../styles/components/login.css';

export function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validação mock com credenciais de referência
    if (!email || !password) {
      toast.error('Campos obrigatórios', 'Por favor, preencha todos os campos.');
      return;
    }

    setLoading(true);

    // Simular requisição de autenticação
    setTimeout(() => {
      setLoading(false);
      if (email === 'pedro@dibracam.com.br' && password === 'F]f;1aN9') {
        // Credenciais corretas -> Navega para o painel
        navigate('/dashboard');
      } else {
        toast.error('E-mail ou senha incorretos.');
      }
    }, 1000);
  };

  const handleForgotPassword = () => {
    toast.info('Recuperação de senha', 'Um link para redefinição de senha seria enviado ao seu email.');
  };

  return (
    <div className="login-page">
      {/* Painel Esquerdo — Formulário */}
      <div className="login-form-panel">
        <img src={logoTope} alt="TOPE Participações" className="login-logo" />

        <h1 className="login-title">Login</h1>
        <p className="login-subtitle">
          Bem-vindo de volta! Por favor, insira seus dados.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <Input
            label="Email"
            type="email"
            placeholder="Digite seu email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 'var(--spacing-4)',
              marginBottom: 'var(--spacing-8)',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-8)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-grey-600)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  accentColor: 'var(--color-primary)',
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                }}
              />
              Lembrar-me
            </label>

            <button
              type="button"
              className="login-forgot"
              onClick={handleForgotPassword}
            >
              Esqueci a senha
            </button>
          </div>

          <Button variant="primary" type="submit" loading={loading} full>
            Entrar
          </Button>
        </form>

        {/* Informações para desenvolvimento e testes */}
        <div className="login-dev-hint">
          <strong>Acesso para Testes:</strong>
          <span>E-mail: <code>pedro@dibracam.com.br</code></span>
          <br />
          <span>Senha: <code>F]f;1aN9</code></span>
        </div>

        <div
          style={{
            marginTop: 'auto',
            paddingTop: 'var(--spacing-32)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-grey-400)',
          }}
        >
          © locacao 2026
        </div>
      </div>

      {/* Painel Direito — Imagem Hero com Overlay Gradiente Laranja */}
      <div className="login-hero-panel">
        <img
          src={bgLogin}
          alt="Caminhões para Locação"
          className="login-hero-img"
        />
        <div className="login-hero-overlay">
          <div className="login-hero-tagline">
            Sua frota sob controle, com eficiência e inovação.
          </div>
          <div className="login-hero-sub">
            Monitore contratos, veículos, fornecedores e faturamento em uma única plataforma integrada.
          </div>
        </div>
      </div>
    </div>
  );
}
