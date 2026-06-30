import React, { useState } from 'react';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';

export function PerfilSenha() {
  const toast = useToast();
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingSenha, setSavingSenha] = useState(false);

  const handleCancelSenha = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    toast.info('Edição de senha descartada.');
  };

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
    <form className="config-locacao-section" onSubmit={handleSaveSenha}>
      <div className="config-locacao-section-header">
        <h2>Senha</h2>
        <p>Por favor, insira sua senha atual para alterar sua senha.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-24)', maxWidth: 480, marginBottom: 'var(--spacing-24)' }}>
        <Input
          id="cfg_senha_atual"
          label="Senha atual"
          type="password"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
          placeholder="Sua senha atual"
          required
        />
        <Input
          id="cfg_senha_nova"
          label="Nova senha"
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          placeholder="Sua nova senha"
          required
        />
        <Input
          id="cfg_senha_confirm"
          label="Confirmar nova senha"
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Confirme sua nova senha"
          required
        />
      </div>

      {/* Ações */}
      <div className="config-locacao-footer-actions">
        <Button variant="secondary" type="button" onClick={handleCancelSenha}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" loading={savingSenha}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
