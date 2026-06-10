// pages/usuarios/UsuariosPage.tsx — Módulo de Usuários TOPE
import React, { useState, useMemo, useRef } from 'react';
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

const INITIAL_USERS: User[] = [
  {
    id: '1',
    createdAt: '16/05/2026',
    name: 'Vitor Tosi',
    email: 'vitortosi@dibracam.com.br',
    profile: 'Vendedor',
    whatsapp: '11982967908',
    avatar: null
  },
  {
    id: '2',
    createdAt: '04/08/2025',
    name: 'Pedro Pelosini',
    email: 'pedro@dibracam.com.br',
    profile: 'Administrador',
    whatsapp: '11973959250',
    avatar: null
  },
  {
    id: '3',
    createdAt: '04/08/2025',
    name: 'Pedro Vendedor',
    email: 'pedro_pelosini@icloud.com',
    profile: 'Vendedor',
    whatsapp: '',
    avatar: null
  },
  {
    id: '4',
    createdAt: '26/08/2025',
    name: 'Daniel Bau',
    email: 'daniel@bau.com',
    profile: 'Fornecedor',
    whatsapp: '',
    avatar: null
  },
  {
    id: '5',
    createdAt: '25/06/2025',
    name: 'Daniel Vendedor',
    email: 'daniel@vendedor.com',
    profile: 'Vendedor',
    whatsapp: '',
    avatar: null
  },
  {
    id: '6',
    createdAt: '25/06/2025',
    name: 'Camila Bau',
    email: 'camila_iamamoto@yahoo.com',
    profile: 'Fornecedor',
    whatsapp: '',
    avatar: null
  },
  {
    id: '7',
    createdAt: '25/06/2025',
    name: 'Pedro Duarte',
    email: 'pedro.duarte@camada.ai',
    profile: 'Administrador',
    whatsapp: '',
    avatar: null
  }
];

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
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);

  // Estados dos Filtros
  const [searchTerm, setSearchTerm] = useState('');
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

  // Filtragem Dinâmica
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesProfile =
        !selectedProfile ||
        selectedProfile.value === 'Todos' ||
        user.profile === selectedProfile.value;

      return matchesSearch && matchesProfile;
    });
  }, [users, searchTerm, selectedProfile]);

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
  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim() || !formEmail.trim() || !formProfile) {
      toast.error('Campos obrigatórios', 'Por favor, preencha o Tipo de Usuário, Nome e E-mail.');
      return;
    }

    const validatedProfile = formProfile.value as 'Administrador' | 'Vendedor' | 'Fornecedor';

    if (editingUser) {
      // Edição
      setUsers(prev =>
        prev.map(u =>
          u.id === editingUser.id
            ? {
                ...u,
                name: formName.trim(),
                email: formEmail.trim(),
                profile: validatedProfile,
                whatsapp: formWhatsapp.trim(),
                avatar: formAvatar
              }
            : u
        )
      );
      toast.success('Usuário atualizado com sucesso!');
    } else {
      // Criação
      const newUser: User = {
        id: Math.random().toString(36).slice(2),
        createdAt: new Date().toLocaleDateString('pt-BR'),
        name: formName.trim(),
        email: formEmail.trim(),
        profile: validatedProfile,
        whatsapp: formWhatsapp.trim(),
        avatar: formAvatar
      };
      setUsers(prev => [newUser, ...prev]);
      toast.success('Novo usuário cadastrado com sucesso!');
    }

    setDrawerOpen(false);
  };

  // Excluir
  const handleDeleteUser = (id: string, name: string) => {
    setUserToDelete({ id, name });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      setUsers(prev => prev.filter(u => u.id !== userToDelete.id));
      toast.success('Usuário removido', `O usuário "${userToDelete.name}" foi excluído.`);
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
            {filteredUsers.length === 0 ? (
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
            <Button variant="primary" type="button" onClick={() => formRef.current?.requestSubmit()}>
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

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Inativar Usuário"
        message={
          <>
            Tem certeza que deseja inativar o usuário <strong>{userToDelete?.name}</strong>?
          </>
        }
        subMessage="O usuário perderá o acesso ao sistema imediatamente após a confirmação."
        confirmLabel="Inativar"
        cancelLabel="Cancelar"
      />
    </DashboardLayout>
  );
}
