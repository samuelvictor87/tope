// pages/usuarios/UsuariosPage.tsx — Módulo de Usuários TOPE
import React, { useState, useRef, useEffect } from 'react';
import { Plus, Pencil, Trash, Camera, Question } from '@phosphor-icons/react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { Avatar } from '../../components/ui/Avatar';
import { Drawer } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { supabase } from '../../lib/supabase';
import '../../styles/components/usuarios.css';
import '../../styles/components/table.css';

interface User {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  profile: 'Administrador' | 'Vendedor' | 'Fornecedor';
  whatsapp: string;
  avatar: string | null;
}

const PROFILE_OPTIONS: OptionType[] = [
  { value: 'Administrador', label: 'Administrador' },
  { value: 'Vendedor', label: 'Vendedor' },
  { value: 'Fornecedor', label: 'Fornecedor' }
];

const PROFILE_FILTER_OPTIONS: OptionType[] = [
  { value: 'Todos', label: 'Perfil (Todos)' },
  ...PROFILE_OPTIONS
];

export function UsuariosPage() {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [users, setUsers] = useState<User[]>([]);

  // Estados dos Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<OptionType | null>({ value: 'Todos', label: 'Perfil (Todos)' });

  // Estados do Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Modal de Confirmação de Exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);

  // Campos do Formulário
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formProfile, setFormProfile] = useState<OptionType | null>(null);
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formAvatar, setFormAvatar] = useState<string | null>(null);

  // Estados de Carregamento e Processamento
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Carregar Usuários do Supabase
  const loadUsers = async () => {
    setLoading(true);
    try {
      let query = supabase.from('usuarios').select('*');

      if (debouncedSearch.trim()) {
        const term = `%${debouncedSearch.trim()}%`;
        query = query.or(`nome_completo.ilike.${term},email.ilike.${term}`);
      }

      if (selectedProfile && selectedProfile.value !== 'Todos') {
        query = query.eq('perfil', selectedProfile.value.toLowerCase());
      }

      const { data, error } = await query.order('criado_em', { ascending: false });

      if (error) {
        toast.error('Erro ao carregar usuários', error.message);
      } else if (data) {
        const mapped = data.map((item: any) => ({
          id: item.id,
          createdAt: new Date(item.criado_em).toLocaleDateString('pt-BR'),
          name: item.nome_completo || '',
          email: item.email || '',
          profile: (item.perfil ? item.perfil.charAt(0).toUpperCase() + item.perfil.slice(1) : 'Vendedor') as 'Administrador' | 'Vendedor' | 'Fornecedor',
          whatsapp: item.whatsapp || '',
          avatar: item.avatar_url || null
        }));
        setUsers(mapped);
      }
    } catch (err) {
      console.error('Erro inesperado ao carregar usuários:', err);
    } finally {
      setLoading(false);
    }
  };

  // Debounce para busca textual
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Carregar usuários quando filtros mudam
  useEffect(() => {
    loadUsers();
  }, [selectedProfile, debouncedSearch]);

  const filteredUsers = users;

  // Abrir Criar
  const handleOpenCreateDrawer = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormProfile(null);
    setFormWhatsapp('');
    setFormAvatar(null);
    setDrawerOpen(true);
  };

  // Abrir Editar
  const handleOpenEditDrawer = (user: User) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    
    const matchedProfile = PROFILE_OPTIONS.find(o => o.value === user.profile) || null;
    setFormProfile(matchedProfile);
    
    setFormWhatsapp(user.whatsapp);
    setFormAvatar(user.avatar);
    setDrawerOpen(true);
  };

  // Simular Upload de Foto
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

  // Salvar
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim() || !formEmail.trim() || !formProfile) {
      toast.error('Campos obrigatórios', 'Por favor, preencha o Tipo de Usuário, Nome e E-mail.');
      return;
    }

    setSaving(true);
    try {
      const validatedProfile = (formProfile.value as string).toLowerCase();
      const dataUser = {
        nome_completo: formName.trim(),
        email: formEmail.trim(),
        perfil: validatedProfile,
        whatsapp: formWhatsapp.trim() || null,
        avatar_url: formAvatar || null
      };

      if (editingUser) {
        // Editar
        const { error } = await supabase
          .from('usuarios')
          .update(dataUser)
          .eq('id', editingUser.id);

        if (error) {
          toast.error('Erro ao atualizar usuário', error.message);
        } else {
          toast.success('Usuário atualizado com sucesso!');
          setDrawerOpen(false);
          loadUsers();
        }
      } else {
        // Criar novo
        const { error } = await supabase
          .from('usuarios')
          .insert([dataUser]);

        if (error) {
          toast.error('Erro ao cadastrar usuário', error.message);
        } else {
          toast.success('Novo usuário cadastrado com sucesso!');
          setDrawerOpen(false);
          loadUsers();
        }
      }
    } catch (err: any) {
      console.error('Erro ao salvar usuário:', err);
      toast.error('Erro inesperado', err.message || 'Erro ao processar salvamento.');
    } finally {
      setSaving(false);
    }
  };

  // Excluir
  const handleDeleteUser = (id: string, name: string) => {
    setUserToDelete({ id, name });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      const { error } = await supabase
        .from('usuarios')
        .delete()
        .eq('id', userToDelete.id);

      if (error) {
        toast.error('Erro ao excluir usuário', error.message);
      } else {
        toast.success('Usuário removido', `O usuário "${userToDelete.name}" foi excluído com sucesso.`);
        loadUsers();
      }
    } catch (err: any) {
      console.error('Erro ao excluir usuário:', err);
      toast.error('Erro inesperado', err.message || 'Não foi possível excluir o usuário.');
    } finally {
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
    }
  };

  // Cores de Badge de Perfil do TOPE
  const getProfileBadgeVariant = (profile: string): 'primary' | 'neutral' | 'success' | 'warning' | 'error' => {
    if (profile === 'Administrador') return 'warning'; // Tom alaranjado/amarelo
    if (profile === 'Vendedor') return 'success'; // Tom laranja da marca ou verde do CRM
    return 'primary'; // Azul para Fornecedor
  };

  return (
    <DashboardLayout
      pageTitle="Usuários"
      pageSubtitle="Gerencie seus usuários e as permissões da conta."
    >
      {/* Barra de Filtros — Sempre Visível, com largura limitada, contagem inline e botão Novo Usuário à direita */}
      <div
        className="usuarios-filters"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-12)',
          marginBottom: 'var(--spacing-24)',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ width: 280 }}>
          <Input
            type="text"
            placeholder="Nome ou e-mail..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ height: 38 }}
          />
        </div>
        <div style={{ width: 180 }}>
          <Select
            options={PROFILE_FILTER_OPTIONS}
            value={selectedProfile}
            onChange={(opt) => setSelectedProfile(opt as OptionType)}
            placeholder="Perfil"
          />
        </div>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)', marginLeft: 'var(--spacing-8)' }}>
          {filteredUsers.length} {filteredUsers.length === 1 ? 'usuário' : 'usuários'}
        </span>

        {/* Botão Novo Usuário alinhado à direita */}
        <div style={{ marginLeft: 'auto' }}>
          <Button
            variant="primary"
            onClick={handleOpenCreateDrawer}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
          >
            <Plus size={16} weight="bold" />
            Novo usuário
          </Button>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="table-container" style={{ marginBottom: 'var(--spacing-24)' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '15%' }}>Data</th>
              <th style={{ width: '30%' }}>Nome</th>
              <th style={{ width: '30%' }}>Email</th>
              <th style={{ width: '15%' }}>Perfil</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                  Carregando usuários...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                  Nenhum usuário encontrado.
                </td>
              </tr>
            ) : (
              filteredUsers.map(user => (
                <tr key={user.id}>
                  <td>
                    <span style={{ color: 'var(--color-grey-500)' }}>{user.createdAt}</span>
                  </td>
                  <td>
                    <div className="user-cell">
                      <Avatar src={user.avatar} name={user.name} size={32} />
                      <span className="user-name" style={{ fontWeight: 500 }}>{user.name}</span>
                    </div>
                  </td>
                  <td>
                    <span className="user-email" style={{ color: 'var(--color-grey-600)' }}>{user.email}</span>
                  </td>
                  <td>
                    <Badge variant={getProfileBadgeVariant(user.profile)}>
                      {user.profile}
                    </Badge>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="action-btn action-btn-edit"
                        onClick={() => handleOpenEditDrawer(user)}
                        title="Editar Usuário"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="action-btn action-btn-delete"
                        onClick={() => handleDeleteUser(user.id, user.name)}
                        title="Excluir Usuário"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer Lateral de Cadastro / Edição */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}
        subtitle={editingUser ? 'Edite os detalhes do usuário da plataforma.' : 'Forneça os detalhes para criar um usuário.'}
        width="500px"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="button" onClick={() => formRef.current?.requestSubmit()} loading={saving}>
              {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
            </Button>
          </>
        }
      >
        <form ref={formRef} onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-16)' }}>
          
          {/* Foto de Perfil */}
          <div className="form-field-full" style={{ marginTop: 'var(--spacing-4)' }}>
            <label className="input-label" style={{ marginBottom: 6, display: 'block', fontWeight: 500, fontSize: 13 }}>
              Foto do perfil
            </label>
            <div className="photo-uploader-container-crm">
              <div className="photo-uploader-avatar-crm">
                {formAvatar ? (
                  <img src={formAvatar} alt="Avatar" />
                ) : (
                  <span>{formName ? formName[0].toUpperCase() : 'U'}</span>
                )}
              </div>
              <div className="photo-uploader-content-crm">
                <button
                  type="button"
                  className="photo-uploader-btn-crm"
                  onClick={handleSimulatePhotoUpload}
                >
                  <Camera size={16} />
                  {formAvatar ? 'Remover foto' : 'Anexar foto...'}
                </button>
                <span className="photo-uploader-formats-crm">
                  Formatos aceitos: JPG, PNG. Máx 2MB.
                </span>
              </div>
            </div>
          </div>

          {/* Nome */}
          <div className="form-field-full">
            <Input
              label="Nome Completo"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="Digite o nome..."
              required
            />
          </div>

          {/* Email */}
          <div className="form-field-full">
            <Input
              label="E-mail"
              type="email"
              value={formEmail}
              onChange={e => setFormEmail(e.target.value)}
              placeholder="Digite o e-mail..."
              required
            />
          </div>

          {/* Tipo de Usuário (Perfil) com Tooltip */}
          <div className="form-field-full">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <label className="input-label input-label-required" style={{ margin: 0, fontWeight: 500, fontSize: 13 }}>
                Tipo de usuário
              </label>
              <div
                style={{ display: 'inline-flex', cursor: 'help', color: 'var(--color-grey-400)' }}
                title="Define o nível de permissão e acesso do usuário no sistema."
              >
                <Question size={14} />
              </div>
            </div>
            <Select
              options={PROFILE_OPTIONS}
              value={formProfile}
              onChange={(opt) => setFormProfile(opt as OptionType)}
              placeholder="Selecione o perfil"
            />
          </div>

          {/* WhatsApp */}
          <div className="form-field-full">
            <Input
              label="WhatsApp"
              value={formWhatsapp}
              onChange={e => setFormWhatsapp(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
        </form>
      </Drawer>

      {/* CONFIRMAÇÃO DE EXCLUSÃO */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Usuário"
        message={
          <>
            Tem certeza que deseja excluir o usuário <strong>{userToDelete?.name}</strong>?
          </>
        }
        subMessage="O usuário será removido permanentemente do sistema imediatamente após a confirmação."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
    </DashboardLayout>
  );
}
