// pages/clientes/ClientesPage.tsx — Módulo de Clientes TOPE
import React, { useState, useMemo, useRef } from 'react';
import { Plus, Pencil, Trash, Question } from '@phosphor-icons/react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { Drawer } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import '../../styles/components/clientes.css';
import '../../styles/components/table.css';

interface Cliente {
  id: string;
  createdAt: string;
  razaoSocial: string;
  cnpj: string;
  contatoNome: string;
  contatoTelefone: string;
  contatoEmail: string;
  vendedor: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

const INITIAL_CLIENTES: Cliente[] = [
  {
    id: '1',
    createdAt: '16/05/2026',
    razaoSocial: 'GRI - GERENCIAMENTO DE RESÍDUOS INDUSTRIAIS S.A.',
    cnpj: '51.903.449/0001-09',
    contatoNome: 'Caio Formigoni',
    contatoTelefone: '(41) 99709-8736',
    contatoEmail: 'cformigoni@cetrel.com.br',
    vendedor: 'Pedro Vendedor',
    cep: '81500-000',
    endereco: 'Rua das Flores',
    numero: '100',
    complemento: 'Bloco A',
    bairro: 'Centro',
    cidade: 'Curitiba',
    estado: 'PR'
  },
  {
    id: '2',
    createdAt: '28/07/2025',
    razaoSocial: 'SUPER MENU SOLUCOES E DESENVOLVIMENTO WEB LTDA',
    cnpj: '23.965.472/0001-84',
    contatoNome: 'Pedro Duarte',
    contatoTelefone: '(85) 99168-1055',
    contatoEmail: 'pedro.duarte@camada.ai',
    vendedor: 'Daniel Vendedor',
    cep: '60120-020',
    endereco: 'Av. Dom Luís',
    numero: '500',
    complemento: 'Sala 301',
    bairro: 'Aldeota',
    cidade: 'Fortaleza',
    estado: 'CE'
  },
  {
    id: '3',
    createdAt: '25/06/2025',
    razaoSocial: 'D&C CLIENTE',
    cnpj: '49.517.995/0001-51',
    contatoNome: 'Daniel Contato',
    contatoTelefone: '(11) 91111-1111',
    contatoEmail: 'daniel@contato.com',
    vendedor: 'Daniel Vendedor',
    cep: '01310-100',
    endereco: 'Av. Paulista',
    numero: '1000',
    complemento: 'Apto 42',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    estado: 'SP'
  }
];

const VENDEDOR_FILTER_OPTIONS: OptionType[] = [
  { value: 'Todos', label: 'Vendedor (Todos)' },
  { value: 'Pedro Vendedor', label: 'Pedro Vendedor' },
  { value: 'Daniel Vendedor', label: 'Daniel Vendedor' }
];

const VENDEDOR_OPTIONS: OptionType[] = [
  { value: 'Pedro Vendedor', label: 'Pedro Vendedor' },
  { value: 'Daniel Vendedor', label: 'Daniel Vendedor' }
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

export function ClientesPage() {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [clientes, setClientes] = useState<Cliente[]>(INITIAL_CLIENTES);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState<OptionType | null>({ value: 'Todos', label: 'Vendedor (Todos)' });

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);

  // Modal de Confirmação de Exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<{ id: string; name: string } | null>(null);

  // Form Fields
  const [formCNPJ, setFormCNPJ] = useState('');
  const [formRazaoSocial, setFormRazaoSocial] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formVendedor, setFormVendedor] = useState<OptionType | null>(null);
  
  const [formCEP, setFormCEP] = useState('');
  const [formEndereco, setFormEndereco] = useState('');
  const [formNumero, setFormNumero] = useState('');
  const [formComplemento, setFormComplemento] = useState('');
  const [formBairro, setFormBairro] = useState('');
  const [formCidade, setFormCidade] = useState('');
  const [formEstado, setFormEstado] = useState('');

  // Filas filtradas
  const filteredClientes = useMemo(() => {
    return clientes.filter(c => {
      const text = searchTerm.toLowerCase();
      const cleanDigits = text.replace(/\D/g, '');
      const matchesSearch =
        c.razaoSocial.toLowerCase().includes(text) ||
        (cleanDigits !== '' && c.cnpj.replace(/\D/g, '').includes(cleanDigits)) ||
        c.contatoEmail.toLowerCase().includes(text) ||
        c.contatoNome.toLowerCase().includes(text);

      const matchesVendedor =
        !selectedVendedor ||
        selectedVendedor.value === 'Todos' ||
        c.vendedor === selectedVendedor.value;

      return matchesSearch && matchesVendedor;
    });
  }, [clientes, searchTerm, selectedVendedor]);

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
      setFormRazaoSocial('EMPRESA DE EXEMPLO ' + clean.slice(-4) + ' LTDA');
      toast.info('Razão social simulada para o CNPJ informado!');
    }
  };

  // Abrir Criar
  const handleOpenCreateDrawer = () => {
    setEditingCliente(null);
    setFormCNPJ('');
    setFormRazaoSocial('');
    setFormNome('');
    setFormEmail('');
    setFormTelefone('');
    setFormVendedor(null);
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
  const handleOpenEditDrawer = (c: Cliente) => {
    setEditingCliente(c);
    setFormCNPJ(c.cnpj);
    setFormRazaoSocial(c.razaoSocial);
    setFormNome(c.contatoNome);
    setFormEmail(c.contatoEmail);
    setFormTelefone(c.contatoTelefone);
    
    const matchedVendedor = VENDEDOR_OPTIONS.find(o => o.value === c.vendedor) || null;
    setFormVendedor(matchedVendedor);

    setFormCEP(c.cep);
    setFormEndereco(c.endereco);
    setFormNumero(c.numero);
    setFormComplemento(c.complemento);
    setFormBairro(c.bairro);
    setFormCidade(c.cidade);
    setFormEstado(c.estado);
    setDrawerOpen(true);
  };

  // Salvar
  const handleSaveCliente = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formCNPJ || !formRazaoSocial) {
      toast.error('Campos obrigatórios', 'Por favor, preencha o CNPJ e a Razão Social.');
      return;
    }

    const seller = formVendedor?.value || 'Sem Vendedor';

    if (editingCliente) {
      setClientes(prev =>
        prev.map(c =>
          c.id === editingCliente.id
            ? {
                ...c,
                cnpj: formCNPJ,
                razaoSocial: formRazaoSocial,
                contatoNome: formNome,
                contatoEmail: formEmail,
                contatoTelefone: formTelefone,
                vendedor: seller,
                cep: formCEP,
                endereco: formEndereco,
                numero: formNumero,
                complemento: formComplemento,
                bairro: formBairro,
                cidade: formCidade,
                estado: formEstado
              }
            : c
        )
      );
      toast.success('Cliente atualizado com sucesso!');
    } else {
      const newCliente: Cliente = {
        id: Math.random().toString(36).slice(2),
        createdAt: new Date().toLocaleDateString('pt-BR'),
        cnpj: formCNPJ,
        razaoSocial: formRazaoSocial,
        contatoNome: formNome,
        contatoEmail: formEmail,
        contatoTelefone: formTelefone,
        vendedor: seller,
        cep: formCEP,
        endereco: formEndereco,
        numero: formNumero,
        complemento: formComplemento,
        bairro: formBairro,
        cidade: formCidade,
        estado: formEstado
      };
      setClientes(prev => [newCliente, ...prev]);
      toast.success('Novo cliente cadastrado com sucesso!');
    }

    setDrawerOpen(false);
  };

  // Excluir
  const handleDeleteCliente = (id: string, name: string) => {
    setClienteToDelete({ id, name });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (clienteToDelete) {
      setClientes(prev => prev.filter(c => c.id !== clienteToDelete.id));
      toast.success('Cliente removido com sucesso!');
      setDeleteConfirmOpen(false);
      setClienteToDelete(null);
    }
  };

  return (
    <DashboardLayout
      pageTitle="Clientes"
      pageSubtitle="Gerencie seus clientes e seus respectivos vendedores."
    >
      {/* Barra de Filtros — Alinhada e Estilizada */}
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
            placeholder="Nome, e-mail, razão ou CNPJ..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ height: 38 }}
          />
        </div>
        <div style={{ width: 180 }}>
          <Select
            options={VENDEDOR_FILTER_OPTIONS}
            value={selectedVendedor}
            onChange={(opt) => setSelectedVendedor(opt as OptionType)}
            placeholder="Vendedor"
          />
        </div>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)', marginLeft: 'var(--spacing-8)' }}>
          {filteredClientes.length} {filteredClientes.length === 1 ? 'cliente' : 'clientes'}
        </span>

        {/* Botão Novo Cliente alinhado à direita */}
        <div style={{ marginLeft: 'auto' }}>
          <Button
            variant="primary"
            onClick={handleOpenCreateDrawer}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
          >
            <Plus size={16} weight="bold" />
            Novo cliente
          </Button>
        </div>
      </div>

      {/* Tabela de Clientes */}
      <div className="table-container" style={{ marginBottom: 'var(--spacing-24)' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '12%' }}>Data</th>
              <th style={{ width: '38%' }}>Razão social / CNPJ</th>
              <th style={{ width: '25%' }}>Contato</th>
              <th style={{ width: '15%' }}>Vendedor</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredClientes.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                  Nenhum cliente encontrado.
                </td>
              </tr>
            ) : (
              filteredClientes.map(c => (
                <tr key={c.id}>
                  <td>{c.createdAt}</td>
                  <td>
                    <div className="cliente-cell-razao">
                      <span className="cliente-razao-text">{c.razaoSocial}</span>
                      <span className="cliente-cnpj-text">{c.cnpj}</span>
                    </div>
                  </td>
                  <td>
                    <div className="cliente-cell-contato">
                      <span className="cliente-contato-name">{c.contatoNome || '-'}</span>
                      {c.contatoTelefone && <span className="cliente-contato-detail">{c.contatoTelefone}</span>}
                      {c.contatoEmail && <span className="cliente-contato-detail">{c.contatoEmail}</span>}
                    </div>
                  </td>
                  <td>{c.vendedor}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      <button
                        className="action-btn action-btn-edit"
                        onClick={() => handleOpenEditDrawer(c)}
                        title="Editar"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="action-btn action-btn-delete"
                        onClick={() => handleDeleteCliente(c.id, c.razaoSocial)}
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

      {/* Drawer Formulário Novo/Edição de Cliente */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingCliente ? 'Editar cliente' : 'Novo cliente'}
        subtitle="Forneça as informações cadastrais e de localização."
        width="620px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-12)', width: '100%' }}>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveCliente}>
              Salvar
            </Button>
          </div>
        }
      >
        <form ref={formRef} onSubmit={handleSaveCliente} className="cliente-form-sections-container">
          
          {/* Seção 1: Cadastro */}
          <div className="cliente-form-section">
            <div className="cliente-section-info">
              <h3 className="cliente-section-title">
                Cadastro <span title="Informe o CNPJ para preencher a razão social" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}><Question size={14} style={{ color: 'var(--color-grey-400)' }} /></span>
              </h3>
              <p className="cliente-section-desc">Informe o CNPJ para preencher a razão social</p>
            </div>
            <div className="cliente-section-fields">
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

          {/* Seção 2: Contato */}
          <div className="cliente-form-section">
            <div className="cliente-section-info">
              <h3 className="cliente-section-title">
                Contato <span title="Trata-se do contato da pessoa principal do seu cliente" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}><Question size={14} style={{ color: 'var(--color-grey-400)' }} /></span>
              </h3>
              <p className="cliente-section-desc">Dados do contato da pessoa principal do seu cliente</p>
            </div>
            <div className="cliente-section-fields">
              <Input
                label="Nome"
                placeholder="Ex: João da Silva"
                value={formNome}
                onChange={e => setFormNome(e.target.value)}
              />
              <div className="input-row-equal">
                <Input
                  label="E-mail"
                  type="email"
                  placeholder="joao@empresa.com"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                />
                <Input
                  label="Telefone (WhatsApp)"
                  placeholder="(00) 00000-0000"
                  value={formTelefone}
                  onChange={e => setFormTelefone(maskPhone(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Vendedor */}
          <div className="cliente-form-section">
            <div className="cliente-section-info">
              <h3 className="cliente-section-title">Vendedor</h3>
              <p className="cliente-section-desc">Selecione o vendedor responsável pelo cliente</p>
            </div>
            <div className="cliente-section-fields">
              <Select
                label="Responsável"
                options={VENDEDOR_OPTIONS}
                value={formVendedor}
                onChange={(opt) => setFormVendedor(opt as OptionType)}
                placeholder="Selecione o vendedor..."
              />
            </div>
          </div>

          {/* Seção 4: Localização */}
          <div className="cliente-form-section">
            <div className="cliente-section-info">
              <h3 className="cliente-section-title">
                Localização <span title="Informe o CEP para liberar os campos do endereço" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}><Question size={14} style={{ color: 'var(--color-grey-400)' }} /></span>
              </h3>
              <p className="cliente-section-desc">Informe o CEP para preenchimento de endereço</p>
            </div>
            <div className="cliente-section-fields">
              
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
        title="Excluir Cliente"
        message={
          <>
            Tem certeza que deseja excluir o cliente <strong>{clienteToDelete?.name}</strong>?
          </>
        }
        subMessage="O cliente será removido do sistema de locação imediatamente após a confirmação."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
    </DashboardLayout>
  );
}
