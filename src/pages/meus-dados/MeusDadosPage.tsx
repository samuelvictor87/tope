// pages/meus-dados/MeusDadosPage.tsx — Módulo de Perfil e Configurações TOPE
import React, { useState, useEffect } from 'react';
import { Camera } from '@phosphor-icons/react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import '../../styles/components/configuracoes.css';

const TABS = [
  { key: 'dados', label: 'Meus dados' },
  { key: 'senha', label: 'Senha' }
];

const maskPhone = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
};

const getRoleOption = (perfil?: string): OptionType => {
  if (!perfil) return { value: 'vendedor', label: 'Vendedor' };
  const label = perfil.charAt(0).toUpperCase() + perfil.slice(1);
  return { value: perfil, label };
};

export function MeusDadosPage() {
  const toast = useToast();
  const { user, profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('dados');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Estados dos formulários (editação temporária)
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formAvatar, setFormAvatar] = useState<string | null>(null);
  const [formProfile, setFormProfile] = useState<OptionType | null>(null);
  const [savingDados, setSavingDados] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Erro de tamanho', 'A imagem deve ter no máximo 2MB.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Erro de tipo', 'Por favor, selecione um arquivo de imagem.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setFormAvatar(base64String);
      toast.success('Foto anexada com sucesso!');
    };
    reader.readAsDataURL(file);
  };

  // Estados do formulário de Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingSenha, setSavingSenha] = useState(false);

  // Inicializa dados do formulário a partir do perfil carregado
  useEffect(() => {
    if (profile) {
      setFormName(profile.nome_completo || '');
      setFormEmail(profile.email || '');
      setFormWhatsapp(profile.whatsapp ? maskPhone(profile.whatsapp) : '');
      setFormAvatar(profile.avatar_url);
      setFormProfile(getRoleOption(profile.perfil));
    }
  }, [profile]);

  // Cancelar edições da aba Meus dados
  const handleCancelDados = () => {
    if (profile) {
      setFormName(profile.nome_completo || '');
      setFormEmail(profile.email || '');
      setFormWhatsapp(profile.whatsapp ? maskPhone(profile.whatsapp) : '');
      setFormAvatar(profile.avatar_url);
      setFormProfile(getRoleOption(profile.perfil));
    }
    toast.info('Alterações descartadas.');
  };

  // Salvar dados da aba Meus dados
  const handleSaveDados = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (!formName.trim()) {
      toast.error('Campos obrigatórios', 'Por favor, preencha o seu nome.');
      return;
    }

    setSavingDados(true);

    try {
      const { error } = await supabase
        .from('usuarios')
        .update({
          nome_completo: formName.trim(),
          whatsapp: formWhatsapp.trim() || null,
          avatar_url: formAvatar,
        })
        .eq('usuario_id', user.id);

      if (error) {
        toast.error('Erro ao salvar', 'Não foi possível atualizar seus dados.');
      } else {
        await refreshProfile();
        toast.success('Perfil atualizado com sucesso!');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error('Erro ao salvar', 'Ocorreu um erro ao atualizar o perfil.');
    } finally {
      setSavingDados(false);
    }
  };

  // Cancelar aba de Senha
  const handleCancelSenha = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    toast.info('Edição de senha descartada.');
  };

  // Salvar senha
  const handleSaveSenha = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Campos obrigatórios', 'Por favor, preencha todos os campos de senha.');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Erro de validação', 'A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Erro de validação', 'A nova senha e a confirmação de senha não coincidem.');
      return;
    }

    setSavingSenha(true);

    try {
      // 1. Validar a senha atual autenticando o usuário silenciosamente via REST API direta do GoTrue
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email!,
          password: currentPassword,
        }),
      });

      if (!response.ok) {
        toast.error('Erro de validação', 'A senha atual informada está incorreta.');
        setSavingSenha(false);
        return;
      }

      // 2. Senha atual válida, proceder com a atualização de senha no Supabase Auth global
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        toast.error('Erro', 'Não foi possível atualizar a senha.');
      } else {
        toast.success('Senha alterada com sucesso!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      console.error('Error updating password:', err);
      toast.error('Erro', 'Ocorreu um erro inesperado ao alterar a senha.');
    } finally {
      setSavingSenha(false);
    }
  };



  return (
    <DashboardLayout
      pageTitle="Meus dados"
      pageSubtitle="Preferências do sistema"
    >
      <div className="configuracoes-page">
        
        {/* Abas de Navegação */}
        <div className="config-header">
          <div className="config-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`config-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo das Configurações */}
        <div className="config-content">
          {activeTab === 'dados' ? (
            <form className="config-form" onSubmit={handleSaveDados}>
              <div className="config-section">
                <div className="config-section-header">
                  <h2>Dados do usuário</h2>
                  <p>Atualize foto e os dados pessoais aqui.</p>
                </div>

                {/* Seção Foto do Perfil */}
                <div className="config-avatar-section" style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
                  <div className="avatar-preview" style={{width: 80, height: 80, borderRadius: '50%', backgroundColor: 'var(--color-grey-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', border: '1px solid var(--color-grey-300)'}}>
                    {formAvatar ? (
                      <img src={formAvatar} alt="Avatar" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                    ) : (
                      <span style={{fontSize: 28, color: 'var(--color-grey-500)', fontWeight: 600}}>
                        {formName ? formName[0].toUpperCase() : 'U'}
                      </span>
                    )}
                  </div>
                  <div className="avatar-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        if (formAvatar) {
                          setFormAvatar(null);
                          toast.info('Foto removida.');
                        } else {
                          fileInputRef.current?.click();
                        }
                      }}
                    >
                      <Camera size={18} style={{marginRight: 8, display: 'inline-block', verticalAlign: 'middle'}} />
                      {formAvatar ? 'Remover foto' : 'Alterar foto...'}
                    </Button>
                    {formAvatar && (
                      <Button
                        type="button"
                        variant="secondary"
                        style={{ marginLeft: 8 }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Alterar foto...
                      </Button>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      style={{ display: 'none' }}
                    />
                    <p style={{fontSize: 12, color: 'var(--color-grey-500)', marginTop: 8}}>
                      Formatos aceitos: JPG, PNG. Máx 2MB.
                    </p>
                  </div>
                </div>

                {/* Grid de Campos do TOPE */}
                <div className="config-grid">
                  <Input
                    label="Nome Completo"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Seu nome completo"
                    required
                  />
                  <Input
                    label="E-mail"
                    type="email"
                    value={formEmail}
                    onChange={() => {}}
                    placeholder="seu.email@empresa.com"
                    required
                    disabled
                    readOnly
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <Input
                      label="WhatsApp"
                      value={formWhatsapp}
                      onChange={e => setFormWhatsapp(maskPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                    />
                    <Select
                      label="Tipo de usuário"
                      options={[
                        { value: 'administrador', label: 'Administrador' },
                        { value: 'vendedor', label: 'Vendedor' },
                        { value: 'fornecedor', label: 'Fornecedor' }
                      ]}
                      value={formProfile}
                      onChange={() => {}}
                      isDisabled
                    />
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="config-footer-actions" style={{ marginTop: '20px', borderTop: '1px solid var(--color-grey-100)', paddingTop: '20px' }}>
                <Button variant="secondary" type="button" onClick={handleCancelDados}>
                  Cancelar
                </Button>
                <Button variant="primary" type="submit" loading={savingDados}>
                  Salvar
                </Button>
              </div>
            </form>
          ) : (
            <form className="config-form" onSubmit={handleSaveSenha}>
              <div className="config-section">
                <div className="config-section-header">
                  <h2>Senha</h2>
                  <p>Por favor, insira sua senha atual para alterar sua senha.</p>
                </div>

                {/* Inputs de Senha */}
                <div className="config-password-fields" style={{ maxWidth: 480 }}>
                  <div className="password-row">
                    <label htmlFor="cfg_senha_atual">Senha atual</label>
                    <Input
                      id="cfg_senha_atual"
                      type="password"
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="Sua senha atual"
                      required
                    />
                  </div>
                  <div className="password-row">
                    <label htmlFor="cfg_senha_nova">Nova senha</label>
                    <Input
                      id="cfg_senha_nova"
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Sua nova senha"
                      required
                    />
                  </div>
                  <div className="password-row">
                    <label htmlFor="cfg_senha_confirm">Confirmar nova senha</label>
                    <Input
                      id="cfg_senha_confirm"
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Confirme sua nova senha"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="config-footer-actions" style={{ marginTop: '20px', borderTop: '1px solid var(--color-grey-100)', paddingTop: '20px' }}>
                <Button variant="secondary" type="button" onClick={handleCancelSenha}>
                  Cancelar
                </Button>
                <Button variant="primary" type="submit" loading={savingSenha}>
                  Salvar
                </Button>
              </div>
            </form>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
