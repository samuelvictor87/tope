// pages/meus-dados/MeusDadosPage.tsx — Módulo de Perfil e Configurações TOPE
import React, { useState } from 'react';
import { Camera } from '@phosphor-icons/react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
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

export function MeusDadosPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('dados');

  // Dados salvos (simulação de persistência)
  const [savedName, setSavedName] = useState('Pedro Pelosini');
  const [savedEmail, setSavedEmail] = useState('pedro@dibracam.com.br');
  const [savedWhatsapp, setSavedWhatsapp] = useState('(11) 97395-9250');
  const [savedAvatar, setSavedAvatar] = useState<string | null>(null);

  // Estados dos formulários (editação temporária)
  const [formName, setFormName] = useState(savedName);
  const [formEmail, setFormEmail] = useState(savedEmail);
  const [formWhatsapp, setFormWhatsapp] = useState(savedWhatsapp);
  const [formAvatar, setFormAvatar] = useState<string | null>(savedAvatar);
  const [formProfile, setFormProfile] = useState<OptionType | null>({ value: 'Administrador', label: 'Administrador' });

  // Estados do formulário de Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Cancelar edições da aba Meus dados
  const handleCancelDados = () => {
    setFormName(savedName);
    setFormEmail(savedEmail);
    setFormWhatsapp(savedWhatsapp);
    setFormAvatar(savedAvatar);
    setFormProfile({ value: 'Administrador', label: 'Administrador' });
    toast.info('Alterações descartadas.');
  };

  // Salvar dados da aba Meus dados
  const handleSaveDados = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim() || !formEmail.trim()) {
      toast.error('Campos obrigatórios', 'Por favor, preencha o seu nome e e-mail.');
      return;
    }

    setSavedName(formName.trim());
    setSavedEmail(formEmail.trim());
    setSavedWhatsapp(formWhatsapp.trim());
    setSavedAvatar(formAvatar);
    toast.success('Perfil atualizado com sucesso!');
  };

  // Cancelar aba de Senha
  const handleCancelSenha = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    toast.info('Edição de senha descartada.');
  };

  // Salvar senha
  const handleSaveSenha = (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Campos obrigatórios', 'Por favor, preencha todos os campos de senha.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Erro de validação', 'A nova senha e a confirmação de senha não coincidem.');
      return;
    }

    // Sucesso simulado
    toast.success('Senha alterada com sucesso!');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // Simular upload de foto de perfil
  const handleSimulatePhotoUpload = () => {
    if (formAvatar) {
      setFormAvatar(null);
      toast.info('Foto removida.');
    } else {
      const mockAvatars = [
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=100'
      ];
      const randomIdx = Math.floor(Math.random() * mockAvatars.length);
      setFormAvatar(mockAvatars[randomIdx]);
      toast.success('Foto anexada com sucesso!');
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
                      onClick={handleSimulatePhotoUpload}
                    >
                      <Camera size={18} style={{marginRight: 8, display: 'inline-block', verticalAlign: 'middle'}} />
                      {formAvatar ? 'Remover foto' : 'Alterar foto...'}
                    </Button>
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
                        { value: 'Administrador', label: 'Administrador' },
                        { value: 'Vendedor', label: 'Vendedor' },
                        { value: 'Fornecedor', label: 'Fornecedor' }
                      ]}
                      value={formProfile}
                      onChange={(opt) => setFormProfile(opt as OptionType)}
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
                <Button variant="primary" type="submit">
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

                {/* Inputs de Senha do CRM */}
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
                <Button variant="primary" type="submit">
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
