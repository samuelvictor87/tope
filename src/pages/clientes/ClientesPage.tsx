// pages/clientes/ClientesPage.tsx — Módulo de Clientes TOPE
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Pencil, Trash, Question } from '@phosphor-icons/react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { Drawer } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Pagination } from '../../components/ui/Pagination';
import { supabase } from '../../lib/supabase';
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
  vendedor_id?: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

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

const validarCNPJ = (cnpj: string): boolean => {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;

  let tamanho = clean.length - 2;
  let numeros = clean.substring(0, tamanho);
  const digitos = clean.substring(tamanho);
  let soma = 0;
  let pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(0))) return false;

  tamanho = tamanho + 1;
  numeros = clean.substring(0, tamanho);
  soma = 0;
  pos = tamanho - 7;

  for (let i = tamanho; i >= 1; i--) {
    soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
  if (resultado !== parseInt(digitos.charAt(1))) return false;

  return true;
};

export function ClientesPage() {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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

  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  const isCNPJValid = useMemo(() => validarCNPJ(formCNPJ), [formCNPJ]);

  // Estados de Carregamento e Paginação
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 10;

  const [vendedorOptions, setVendedorOptions] = useState<OptionType[]>([]);
  const [vendedorFilterOptions, setVendedorFilterOptions] = useState<OptionType[]>([
    { value: 'Todos', label: 'Vendedor (Todos)' }
  ]);

  // Carregar vendedores do banco de dados
  useEffect(() => {
    async function loadVendedores() {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('id, nome_completo')
          .in('perfil', ['vendedor', 'administrador'])
          .order('nome_completo');
        
        if (error) {
          console.error('Erro ao buscar vendedores:', error);
        } else if (data) {
          const options = data.map(u => ({
            value: u.id,
            label: u.nome_completo
          }));
          setVendedorOptions(options);
          setVendedorFilterOptions([
            { value: 'Todos', label: 'Vendedor (Todos)' },
            ...options
          ]);
        }
      } catch (err) {
        console.error('Erro inesperado ao buscar vendedores:', err);
      }
    }
    loadVendedores();
  }, []);

  const loadClientes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('clientes')
        .select(`
          *,
          vendedor:usuarios(id, nome_completo)
        `, { count: 'exact' });

      if (debouncedSearch.trim()) {
        const term = `%${debouncedSearch.trim()}%`;
        query = query.or(`razao_social.ilike.${term},cnpj.ilike.${term},contato_nome.ilike.${term},contato_email.ilike.${term}`);
      }

      if (selectedVendedor && selectedVendedor.value !== 'Todos') {
        query = query.eq('vendedor_id', selectedVendedor.value);
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.order('criado_em', { ascending: false }).range(from, to);

      const { data, error, count } = await query;

      if (error) {
        toast.error('Erro ao carregar clientes', error.message);
      } else if (data) {
        const mapped = data.map(item => ({
          id: item.id,
          createdAt: new Date(item.criado_em).toLocaleDateString('pt-BR'),
          razaoSocial: item.razao_social,
          cnpj: item.cnpj,
          contatoNome: item.contato_nome || '',
          contatoTelefone: item.contato_telefone || '',
          contatoEmail: item.contato_email || '',
          vendedor: item.vendedor ? (item.vendedor as any).nome_completo : 'Sem Vendedor',
          vendedor_id: item.vendedor_id || undefined,
          cep: item.cep || '',
          endereco: item.endereco || '',
          numero: item.numero || '',
          complemento: item.complemento || '',
          bairro: item.bairro || '',
          cidade: item.cidade || '',
          estado: item.estado || ''
        }));
        setClientes(mapped);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Erro inesperado ao buscar clientes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Debounce da busca de texto para evitar requisições repetitivas no banco
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Carrega clientes quando a página, vendedor ou busca muda
  useEffect(() => {
    loadClientes();
  }, [currentPage, selectedVendedor, debouncedSearch]);

  const filteredClientes = clientes;

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

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const masked = maskCNPJ(rawVal);
    setFormCNPJ(masked);
  };

  const handleBuscarCNPJ = async () => {
    const clean = formCNPJ.replace(/\D/g, '');
    if (!validarCNPJ(clean)) {
      toast.error('CNPJ Inválido', 'O CNPJ informado não possui formato ou dígitos verificadores válidos.');
      return;
    }

    setBuscandoCNPJ(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
      
      if (res.status === 404) {
        toast.error('CNPJ não encontrado', 'Este CNPJ não foi localizado na base da Receita Federal.');
        return;
      }

      if (!res.ok) {
        toast.error('Erro na busca', 'Ocorreu um erro ao consultar o CNPJ. Tente novamente.');
        return;
      }

      const data = await res.json();
      
      if (data.razao_social) {
        setFormRazaoSocial(data.razao_social);
      }
      
      if (data.cep) {
        setFormCEP(maskCEP(data.cep));
      }
      
      if (data.logradouro) {
        setFormEndereco(data.logradouro);
      }
      
      if (data.numero) {
        setFormNumero(data.numero);
      }
      
      if (data.complemento) {
        setFormComplemento(data.complemento);
      }
      
      if (data.bairro) {
        setFormBairro(data.bairro);
      }
      
      if (data.municipio) {
        setFormCidade(data.municipio);
      }
      
      if (data.uf) {
        setFormEstado(data.uf);
      }
      
      toast.success('Cadastro e localização preenchidos com sucesso!');
    } catch (err) {
      console.error('Erro ao buscar CNPJ:', err);
      toast.error('Erro de conexão', 'Não foi possível conectar ao serviço de consulta de CNPJ.');
    } finally {
      setBuscandoCNPJ(false);
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
    
    const matchedVendedor = vendedorOptions.find(o => o.value === c.vendedor_id) || null;
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
  const handleSaveCliente = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formCNPJ || !formRazaoSocial) {
      toast.error('Campos obrigatórios', 'Por favor, preencha o CNPJ e a Razão Social.');
      return;
    }

    setSaving(true);
    try {
      const clientData = {
        cnpj: formCNPJ,
        razao_social: formRazaoSocial,
        contato_nome: formNome || null,
        contato_email: formEmail || null,
        contato_telefone: formTelefone || null,
        vendedor_id: formVendedor?.value || null,
        cep: formCEP || null,
        endereco: formEndereco || null,
        numero: formNumero || null,
        complemento: formComplemento || null,
        bairro: formBairro || null,
        cidade: formCidade || null,
        estado: formEstado || null
      };

      if (editingCliente) {
        const { error } = await supabase
          .from('clientes')
          .update(clientData)
          .eq('id', editingCliente.id);

        if (error) {
          toast.error('Erro ao atualizar cliente', error.message);
        } else {
          toast.success('Cliente atualizado com sucesso!');
          setDrawerOpen(false);
          loadClientes();
        }
      } else {
        const { error } = await supabase
          .from('clientes')
          .insert([clientData]);

        if (error) {
          toast.error('Erro ao cadastrar cliente', error.message);
        } else {
          toast.success('Novo cliente cadastrado com sucesso!');
          setDrawerOpen(false);
          setCurrentPage(1);
          loadClientes();
        }
      }
    } catch (err) {
      console.error('Erro inesperado ao salvar cliente:', err);
    } finally {
      setSaving(false);
    }
  };

  // Excluir
  const handleDeleteCliente = (id: string, name: string) => {
    setClienteToDelete({ id, name });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (clienteToDelete) {
      try {
        const { error } = await supabase
          .from('clientes')
          .delete()
          .eq('id', clienteToDelete.id);

        if (error) {
          toast.error('Erro ao remover cliente', error.message);
        } else {
          toast.success('Cliente removido com sucesso!');
          setDeleteConfirmOpen(false);
          setClienteToDelete(null);
          loadClientes();
        }
      } catch (err) {
        console.error('Erro ao deletar cliente:', err);
      }
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
            options={vendedorFilterOptions}
            value={selectedVendedor}
            onChange={(opt) => {
              setSelectedVendedor(opt as OptionType);
              setCurrentPage(1);
            }}
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
            {loading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                  Carregando clientes...
                </td>
              </tr>
            ) : filteredClientes.length === 0 ? (
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
            
            {/* Paginação */}
            <Pagination
              currentPage={currentPage}
              totalCount={totalCount}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
              itemLabel="clientes"
            />
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
            <Button variant="primary" onClick={handleSaveCliente} loading={saving}>
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
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--spacing-8)' }}>
                <div style={{ flex: 1 }}>
                  <Input
                    label="CNPJ"
                    placeholder="00.000.000/0000-00"
                    value={formCNPJ}
                    onChange={handleCNPJChange}
                    required
                  />
                </div>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleBuscarCNPJ}
                  disabled={!isCNPJValid || buscandoCNPJ}
                  loading={buscandoCNPJ}
                  style={{ height: 40, whiteSpace: 'nowrap' }}
                >
                  Buscar
                </Button>
              </div>
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
                options={vendedorOptions}
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
