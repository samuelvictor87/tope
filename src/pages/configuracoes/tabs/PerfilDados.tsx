import React, { useState, useEffect, useRef } from 'react';
import { Camera } from '@phosphor-icons/react';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import type { OptionType } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';

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

export function PerfilDados() {
  const toast = useToast();
  const { user, profile, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formAvatar, setFormAvatar] = useState<string | null>(null);
  const [formProfile, setFormProfile] = useState<OptionType | null>(null);
  const [savingDados, setSavingDados] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormName(profile.nome_completo || '');
      setFormEmail(profile.email || '');
      setFormWhatsapp(profile.whatsapp ? maskPhone(profile.whatsapp) : '');
      setFormAvatar(profile.avatar_url);
      setFormProfile(getRoleOption(profile.perfil));
    }
  }, [profile]);

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

  return (
    <form className="config-locacao-section" onSubmit={handleSaveDados}>
      <div className="config-locacao-section-header">
        <h2>Dados do usuário</h2>
        <p>Atualize foto e os dados pessoais de perfil.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-24)', marginBottom: 'var(--spacing-24)' }}>
        {/* Seção Foto do Perfil */}
        <div className="config-avatar-section" style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: 'var(--spacing-8)' }}>
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

        {/* Campos de Input com espaçamento vertical consistente */}
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-24)' }}>
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

      {/* Ações */}
      <div className="config-locacao-footer-actions">
        <Button variant="secondary" type="button" onClick={handleCancelDados}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" loading={savingDados}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
