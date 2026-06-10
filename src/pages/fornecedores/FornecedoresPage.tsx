// pages/fornecedores/FornecedoresPage.tsx — Módulo de Fornecedores TOPE
import React, { useState, useMemo, useRef } from 'react';
import { Plus, Pencil, Trash, Question, Funnel } from '@phosphor-icons/react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { MultiSelect } from '../../components/ui/MultiSelect';
import { Drawer } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import '../../styles/components/fornecedores.css';
import '../../styles/components/table.css';

interface Fornecedor {
  id: string;
  createdAt: string;
  razaoSocial: string;
  cnpj: string;
  usuarioNome: string;
  usuarioWhatsapp: string;
  usuarioEmail: string;
  contatoNome: string;
  contatoEmail: string;
  contatoTelefone: string;
  implementos: string[];
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

const INITIAL_FORNECEDORES: Fornecedor[] = [
  {
    id: '1',
    createdAt: '26/06/2025',
    razaoSocial: 'OUTRO FORNECEDOR BAU',
    cnpj: '11.111.111/1111-11',
    usuarioNome: 'Daniel Bau',
    usuarioWhatsapp: '(11) 9 9744-4041',
    usuarioEmail: 'daniel@bau.com',
    contatoNome: 'Daniel Contato',
    contatoEmail: 'daniel@contato.com',
    contatoTelefone: '(11) 1 1111-1111',
    implementos: ['furgao-bau'],
    cep: '01310-100',
    endereco: 'Av. Paulista',
    numero: '1000',
    complemento: 'Apto 42',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    estado: 'SP'
  },
  {
    id: '2',
    createdAt: '25/08/2025',
    razaoSocial: 'D&C BAUS',
    cnpj: '49.517.995/0001-51',
    usuarioNome: 'Camila Bau',
    usuarioWhatsapp: '(11) 9 8687-6831',
    usuarioEmail: 'camila_yamamoto@yahoo.com',
    contatoNome: 'Camila Contato',
    contatoEmail: 'dkmoriya.dm@gmail.com',
    contatoTelefone: '(22) 2 2222-2222',
    implementos: ['furgao-bau'],
    cep: '01310-100',
    endereco: 'Av. Paulista',
    numero: '2000',
    complemento: 'Sala 15',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    estado: 'SP'
  }
];

const IMPLEMENTO_OPTIONS = [
  { value: 'furgao-bau', label: 'Furgão Baú' },
  { value: 'sider', label: 'Sider' },
  { value: 'grade-baixa', label: 'Grade Baixa' },
  { value: 'porta-conteiner', label: 'Porta Contêiner' },
  { value: 'basculante', label: 'Basculante' },
  { value: 'prancha', label: 'Prancha' },
  { value: 'frigorifico', label: 'Frigorífico' }
];

const FILTER_IMPLEMENTO_OPTIONS: OptionType[] = [
  { value: 'Todos', label: 'Implementos (Todos)' },
  ...IMPLEMENTO_OPTIONS
];

// Helper masks
const maskCNPJ = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 14);
  let masked = digits;
  if (digits.length > 2) masked = `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length > 5) masked = `${masked.slice(0, 6)}.${digits.slice(5)}`;
  if (digits.length > 8) masked = `${masked.slice(0, 10)}/${digits.slice(8)}`;
  if (digits.length > 12) masked = `${masked.slice(0, 15)}-${digits.slice(12)}`;
  return masked;
};

const maskCEP = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 5) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits;
};

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

export function FornecedoresPage() {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>(INITIAL_FORNECEDORES);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterImplemento, setFilterImplemento] = useState<OptionType | null>({ value: 'Todos', label: 'Implementos (Todos)' });
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);

  // Modal de Confirmação de Exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [fornecedorToDelete, setFornecedorToDelete] = useState<{ id: string; name: string } | null>(null);

  // Form Fields
  const [formCNPJ, setFormCNPJ] = useState('');
  const [formRazaoSocial, setFormRazaoSocial] = useState('');

  const [formUsuarioNome, setFormUsuarioNome] = useState('');
  const [formUsuarioEmail, setFormUsuarioEmail] = useState('');
  const [formUsuarioWhatsapp, setFormUsuarioWhatsapp] = useState('');

  const [formContatoNome, setFormContatoNome] = useState('');
  const [formContatoEmail, setFormContatoEmail] = useState('');
  const [formContatoTelefone, setFormContatoTelefone] = useState('');

  const [formImplementos, setFormImplementos] = useState<string[]>([]);
  
  const [formCEP, setFormCEP] = useState('');
  const [formEndereco, setFormEndereco] = useState('');
  const [formNumero, setFormNumero] = useState('');
  const [formComplemento, setFormComplemento] = useState('');
  const [formBairro, setFormBairro] = useState('');
  const [formCidade, setFormCidade] = useState('');
  const [formEstado, setFormEstado] = useState('');

  // Lista Filtrada
  const filteredFornecedores = useMemo(() => {
    return fornecedores.filter(f => {
      const text = searchTerm.toLowerCase();
      const cleanDigits = text.replace(/\D/g, '');
      const matchesSearch =
        f.razaoSocial.toLowerCase().includes(text) ||
        (cleanDigits !== '' && f.cnpj.replace(/\D/g, '').includes(cleanDigits)) ||
        f.usuarioNome.toLowerCase().includes(text) ||
        f.usuarioEmail.toLowerCase().includes(text) ||
        f.contatoNome.toLowerCase().includes(text) ||
        f.contatoEmail.toLowerCase().includes(text);

      const matchesImplemento =
        !filterImplemento ||
        filterImplemento.value === 'Todos' ||
        f.implementos.includes(filterImplemento.value);

      return matchesSearch && matchesImplemento;
    });
  }, [fornecedores, searchTerm, filterImplemento]);

  // Busca CEP automático
  const handleCEPChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const masked = maskCEP(rawVal);
    setFormCEP(masked);

    const clean = rawVal.replace(/\D/g, '');
    if (clean.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (data.erro) {
          toast.error('CEP não localizado', 'Revise o CEP preenchido.');
        } else {
          setFormEndereco(data.logradouro || '');
          setFormBairro(data.bairro || '');
          setFormCidade(data.localidade || '');
          setFormEstado(data.uf || '');
          toast.success('Endereço auto-preenchido com sucesso!');
        }
      } catch (err) {
        toast.error('Erro na consulta', 'Não foi possível conectar ao ViaCEP.');
      }
    }
  };

  // Simulação de preenchimento CNPJ para agilizar protótipo
  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const masked = maskCNPJ(rawVal);
    setFormCNPJ(masked);

    const clean = rawVal.replace(/\D/g, '');
    if (clean.length === 14 && !formRazaoSocial) {
      // Auto-preenche com nome simulado
      setFormRazaoSocial('FORNECEDOR DE EXEMPLO ' + clean.slice(-4) + ' LTDA');
      toast.info('Razão social simulada para o CNPJ informado!');
    }
  };

  // Abrir Criar
  const handleOpenCreateDrawer = () => {
    setEditingFornecedor(null);
    setFormCNPJ('');
    setFormRazaoSocial('');
    setFormUsuarioNome('');
    setFormUsuarioEmail('');
    setFormUsuarioWhatsapp('');
    setFormContatoNome('');
    setFormContatoEmail('');
    setFormContatoTelefone('');
    setFormImplementos([]);
    setFormCEP('');
    setFormEndereco('');
    setFormNumero('');
    setFormComplemento('');
    setFormBairro('');
    setFormCidade('');
    setFormEstado('');
    setDrawerOpen(true);
  };

  // Abrir Editar
  const handleOpenEditDrawer = (f: Fornecedor) => {
    setEditingFornecedor(f);
    setFormCNPJ(f.cnpj);
    setFormRazaoSocial(f.razaoSocial);
    setFormUsuarioNome(f.usuarioNome);
    setFormUsuarioEmail(f.usuarioEmail);
    setFormUsuarioWhatsapp(f.usuarioWhatsapp);
    setFormContatoNome(f.contatoNome);
    setFormContatoEmail(f.contatoEmail);
    setFormContatoTelefone(f.contatoTelefone);
    setFormImplementos(f.implementos);
    setFormCEP(f.cep);
    setFormEndereco(f.endereco);
    setFormNumero(f.numero);
    setFormComplemento(f.complemento);
    setFormBairro(f.bairro);
    setFormCidade(f.cidade);
    setFormEstado(f.estado);
    setDrawerOpen(true);
  };

  // Salvar
  const handleSaveFornecedor = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formCNPJ || !formRazaoSocial) {
      toast.error('Campos obrigatórios', 'Por favor, preencha o CNPJ e a Razão Social.');
      return;
    }

    if (editingFornecedor) {
      setFornecedores(prev =>
        prev.map(f =>
          f.id === editingFornecedor.id
            ? {
                ...f,
                cnpj: formCNPJ,
                razaoSocial: formRazaoSocial,
                usuarioNome: formUsuarioNome,
                usuarioEmail: formUsuarioEmail,
                usuarioWhatsapp: formUsuarioWhatsapp,
                contatoNome: formContatoNome,
                contatoEmail: formContatoEmail,
                contatoTelefone: formContatoTelefone,
                implementos: formImplementos,
                cep: formCEP,
                endereco: formEndereco,
                numero: formNumero,
                complemento: formComplemento,
                bairro: formBairro,
                cidade: formCidade,
                estado: formEstado
              }
            : f
        )
      );
      toast.success('Fornecedor atualizado com sucesso!');
    } else {
      const newFornecedor: Fornecedor = {
        id: Math.random().toString(36).slice(2),
        createdAt: new Date().toLocaleDateString('pt-BR'),
        cnpj: formCNPJ,
        razaoSocial: formRazaoSocial,
        usuarioNome: formUsuarioNome,
        usuarioEmail: formUsuarioEmail,
        usuarioWhatsapp: formUsuarioWhatsapp,
        contatoNome: formContatoNome,
        contatoEmail: formContatoEmail,
        contatoTelefone: formContatoTelefone,
        implementos: formImplementos,
        cep: formCEP,
        endereco: formEndereco,
        numero: formNumero,
        complemento: formComplemento,
        bairro: formBairro,
        cidade: formCidade,
        estado: formEstado
      };
      setFornecedores(prev => [newFornecedor, ...prev]);
      toast.success('Novo fornecedor cadastrado com sucesso!');
    }

    setDrawerOpen(false);
  };

  // Excluir
  const handleDeleteFornecedor = (id: string, name: string) => {
    setFornecedorToDelete({ id, name });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (fornecedorToDelete) {
      setFornecedores(prev => prev.filter(f => f.id !== fornecedorToDelete.id));
      toast.success('Fornecedor removido com sucesso!');
      setDeleteConfirmOpen(false);
      setFornecedorToDelete(null);
    }
  };

  return (
    <DashboardLayout
      pageTitle="Fornecedores"
    >
      {/* Seção superior de Título e Ações */}
      <div className="fornecedores-header-section">
        <div className="fornecedores-header-title-wrapper">
          <div className="fornecedores-title-row">
            <h2>Gestão dos fornecedores</h2>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)', fontWeight: 500 }}>
              {filteredFornecedores.length} {filteredFornecedores.length === 1 ? 'fornecedor' : 'fornecedores'}
            </span>
          </div>
          <p className="fornecedores-desc">Gerencie seus fornecedores e seus respectivos implementos.</p>
        </div>
        <div className="fornecedores-header-actions">
          <Button
            variant="secondary"
            onClick={() => setFiltersOpen(!filtersOpen)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
          >
            <Funnel size={16} />
            Filtros
          </Button>
          <Button
            variant="primary"
            onClick={handleOpenCreateDrawer}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
          >
            <Plus size={16} weight="bold" />
            Novo fornecedor
          </Button>
        </div>
      </div>

      {/* Barra de Filtros Colapsável */}
      {filtersOpen && (
        <div
          className="usuarios-filters"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-12)',
            marginBottom: 'var(--spacing-24)',
            flexWrap: 'wrap',
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
          <div style={{ width: 220 }}>
            <Select
              options={FILTER_IMPLEMENTO_OPTIONS}
              value={filterImplemento}
              onChange={(opt) => setFilterImplemento(opt as OptionType)}
              placeholder="Implementos (Todos)"
            />
          </div>
        </div>
      )}

      {/* Tabela de Fornecedores */}
      <div className="table-container" style={{ marginBottom: 'var(--spacing-24)' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '12%' }}>Data</th>
              <th style={{ width: '28%' }}>Razão social</th>
              <th style={{ width: '22%' }}>Login e notificações</th>
              <th style={{ width: '20%' }}>Contato</th>
              <th style={{ width: '10%' }}>Implementos</th>
              <th style={{ width: '8%', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredFornecedores.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                  Nenhum fornecedor encontrado.
                </td>
              </tr>
            ) : (
              filteredFornecedores.map(f => (
                <tr key={f.id}>
                  <td>{f.createdAt}</td>
                  <td>
                    <div className="fornecedor-cell-razao">
                      <span className="fornecedor-razao-text">{f.razaoSocial}</span>
                      <span className="fornecedor-cnpj-text">{f.cnpj}</span>
                    </div>
                  </td>
                  <td>
                    <div className="fornecedor-cell-info">
                      <span className="fornecedor-info-name">{f.usuarioNome || '-'}</span>
                      {f.usuarioWhatsapp && <span className="fornecedor-info-detail">{f.usuarioWhatsapp}</span>}
                      {f.usuarioEmail && <span className="fornecedor-info-detail">{f.usuarioEmail}</span>}
                    </div>
                  </td>
                  <td>
                    <div className="fornecedor-cell-info">
                      <span className="fornecedor-info-name">{f.contatoNome || '-'}</span>
                      {f.contatoTelefone && <span className="fornecedor-info-detail">{f.contatoTelefone}</span>}
                      {f.contatoEmail && <span className="fornecedor-info-detail">{f.contatoEmail}</span>}
                    </div>
                  </td>
                  <td>
                    <div className="fornecedor-implementos-badges">
                      {f.implementos.length === 0 ? (
                        <span style={{ color: 'var(--color-grey-400)', fontSize: 'var(--font-size-xs)' }}>-</span>
                      ) : (
                        f.implementos.map(impVal => {
                          const matched = IMPLEMENTO_OPTIONS.find(o => o.value === impVal);
                          return (
                            <Badge key={impVal} variant="neutral">
                              {matched ? matched.label : impVal}
                            </Badge>
                          );
                        })
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <button
                        className="action-btn action-btn-edit"
                        onClick={() => handleOpenEditDrawer(f)}
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="action-btn action-btn-delete"
                        onClick={() => handleDeleteFornecedor(f.id, f.razaoSocial)}
                        title="Excluir"
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

      {/* Drawer Formulário de Fornecedor */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingFornecedor ? 'Editar fornecedor' : 'Novo fornecedor'}
        subtitle="Forneça as informações cadastrais."
        width="620px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-12)', width: '100%' }}>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveFornecedor}>
              Salvar
            </Button>
          </div>
        }
      >
        <form ref={formRef} onSubmit={handleSaveFornecedor} className="fornecedor-form-sections-container">
          
          {/* Seção 1: Cadastro */}
          <div className="fornecedor-form-section">
            <div className="fornecedor-section-info">
              <h3 className="fornecedor-section-title">
                Cadastro
              </h3>
              <p className="fornecedor-section-desc">Informe o CNPJ para preencher a razão social</p>
            </div>
            <div className="fornecedor-section-fields">
              <Input
                label="CNPJ"
                placeholder="00.000.000/0000-00"
                value={formCNPJ}
                onChange={handleCNPJChange}
                required
              />
              <Input
                label="Razão social"
                placeholder="Ex: Minha Empresa S.A."
                value={formRazaoSocial}
                onChange={e => setFormRazaoSocial(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Seção 2: Usuário */}
          <div className="fornecedor-form-section">
            <div className="fornecedor-section-info">
              <h3 className="fornecedor-section-title">
                Usuário <span title="Essas informações serão utilizada para o fornecedor acessar a plataforma re ceber notificações" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}><Question size={14} style={{ color: 'var(--color-grey-400)' }} /></span>
              </h3>
              <p className="fornecedor-section-desc">Essas informações serão utilizada para o fornecedor acessar a plataforma re ceber notificações</p>
            </div>
            <div className="fornecedor-section-fields">
              <Input
                label="Nome"
                placeholder="Ex: João da Silva"
                value={formUsuarioNome}
                onChange={e => setFormUsuarioNome(e.target.value)}
              />
              <div className="input-row-equal">
                <Input
                  label="Email"
                  type="email"
                  placeholder="joao@empresa.com"
                  value={formUsuarioEmail}
                  onChange={e => setFormUsuarioEmail(e.target.value)}
                />
                <Input
                  label="Whatsapp"
                  placeholder="(00) 00000-0000"
                  value={formUsuarioWhatsapp}
                  onChange={e => setFormUsuarioWhatsapp(maskPhone(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Contato */}
          <div className="fornecedor-form-section">
            <div className="fornecedor-section-info">
              <h3 className="fornecedor-section-title">
                Contato <span title="Trata-se do contato da pessoa principal do seu fornecedor" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}><Question size={14} style={{ color: 'var(--color-grey-400)' }} /></span>
              </h3>
              <p className="fornecedor-section-desc">Trata-se do contato da pessoa principal do seu fornecedor</p>
            </div>
            <div className="fornecedor-section-fields">
              <Input
                label="Nome"
                placeholder="Ex: João da Silva"
                value={formContatoNome}
                onChange={e => setFormContatoNome(e.target.value)}
              />
              <div className="input-row-equal">
                <Input
                  label="Email"
                  type="email"
                  placeholder="joao@empresa.com"
                  value={formContatoEmail}
                  onChange={e => setFormContatoEmail(e.target.value)}
                />
                <Input
                  label="Telefone"
                  placeholder="(00) 00000-0000"
                  value={formContatoTelefone}
                  onChange={e => setFormContatoTelefone(maskPhone(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Seção 4: Implementos */}
          <div className="fornecedor-form-section">
            <div className="fornecedor-section-info">
              <h3 className="fornecedor-section-title">Implementos</h3>
              <p className="fornecedor-section-desc">Selecione os implementos vinculados a este fornecedor</p>
            </div>
            <div className="fornecedor-section-fields">
              <MultiSelect
                label="Selecione os implementos"
                options={IMPLEMENTO_OPTIONS}
                value={formImplementos}
                onChange={setFormImplementos}
                placeholder="Selecione os implementos..."
              />
            </div>
          </div>

          {/* Seção 5: Localização */}
          <div className="fornecedor-form-section">
            <div className="fornecedor-section-info">
              <h3 className="fornecedor-section-title">
                Localização <span title="Informe o CEP para liberar os campos do endereço" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}><Question size={14} style={{ color: 'var(--color-grey-400)' }} /></span>
              </h3>
              <p className="fornecedor-section-desc">Informe o CEP para liberar os campos do endereço</p>
            </div>
            <div className="fornecedor-section-fields">
              
              <div className="input-row-cep-address">
                <div className="cep-field">
                  <Input
                    label="CEP"
                    placeholder="00000-000"
                    value={formCEP}
                    onChange={handleCEPChange}
                  />
                </div>
                <div className="address-field">
                  <Input
                    label="Endereço"
                    placeholder="Rua, Avenida, etc."
                    value={formEndereco}
                    onChange={e => setFormEndereco(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-row-num-compl">
                <div className="num-field">
                  <Input
                    label="Número"
                    placeholder="123"
                    value={formNumero}
                    onChange={e => setFormNumero(e.target.value)}
                  />
                </div>
                <div className="compl-field">
                  <Input
                    label="Complemento"
                    placeholder="Ex: Bloco B, Sala 4"
                    value={formComplemento}
                    onChange={e => setFormComplemento(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-row-city-state">
                <div className="bairro-field">
                  <Input
                    label="Bairro"
                    placeholder="Centro"
                    value={formBairro}
                    onChange={e => setFormBairro(e.target.value)}
                  />
                </div>
                <div className="city-field">
                  <Input
                    label="Cidade"
                    placeholder="Ex: São Paulo"
                    value={formCidade}
                    onChange={e => setFormCidade(e.target.value)}
                  />
                </div>
                <div className="state-field">
                  <Input
                    label="Estado"
                    placeholder="SP"
                    maxLength={2}
                    value={formEstado}
                    onChange={e => setFormEstado(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

            </div>
          </div>

        </form>
      </Drawer>

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Fornecedor"
        message={
          <>
            Tem certeza que deseja excluir o fornecedor <strong>{fornecedorToDelete?.name}</strong>?
          </>
        }
        subMessage="O fornecedor será removido do sistema de locação imediatamente após a confirmação."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
    </DashboardLayout>
  );
}
