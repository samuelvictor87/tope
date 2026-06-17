// pages/fornecedores/FornecedoresPage.tsx — Módulo de Fornecedores TOPE
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash, Question } from '@phosphor-icons/react';
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
import { Pagination } from '../../components/ui/Pagination';
import { supabase } from '../../lib/supabase';
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

export function FornecedoresPage() {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterImplemento, setFilterImplemento] = useState<OptionType | null>({ value: 'Todos', label: 'Implementos (Todos)' });

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

  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  const isCNPJValid = useMemo(() => validarCNPJ(formCNPJ), [formCNPJ]);

  // Estados de Carregamento e Paginação
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 10;

  const loadFornecedores = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('fornecedores')
        .select('*', { count: 'exact' });

      if (debouncedSearch.trim()) {
        const term = `%${debouncedSearch.trim()}%`;
        query = query.or(`razao_social.ilike.${term},cnpj.ilike.${term},usuario_nome.ilike.${term},usuario_email.ilike.${term},contato_nome.ilike.${term},contato_email.ilike.${term}`);
      }

      if (filterImplemento && filterImplemento.value !== 'Todos') {
        query = query.contains('implementos', [filterImplemento.value]);
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.order('criado_em', { ascending: false }).range(from, to);

      const { data, error, count } = await query;

      if (error) {
        toast.error('Erro ao carregar fornecedores', error.message);
      } else if (data) {
        const mapped = data.map(item => ({
          id: item.id,
          createdAt: new Date(item.criado_em).toLocaleDateString('pt-BR'),
          razaoSocial: item.razao_social,
          cnpj: item.cnpj,
          usuarioNome: item.usuario_nome || '',
          usuarioWhatsapp: item.usuario_whatsapp || '',
          usuarioEmail: item.usuario_email || '',
          contatoNome: item.contato_nome || '',
          contatoEmail: item.contato_email || '',
          contatoTelefone: item.contato_telefone || '',
          implementos: item.implementos || [],
          cep: item.cep || '',
          endereco: item.endereco || '',
          numero: item.numero || '',
          complemento: item.complemento || '',
          bairro: item.bairro || '',
          cidade: item.cidade || '',
          estado: item.estado || ''
        }));
        setFornecedores(mapped);
        setTotalCount(count || 0);
      }
    } catch (err) {
      console.error('Erro inesperado ao buscar fornecedores:', err);
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

  // Carrega fornecedores quando a página, busca ou filtro muda
  useEffect(() => {
    loadFornecedores();
  }, [currentPage, filterImplemento, debouncedSearch]);

  const filteredFornecedores = fornecedores;

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
  const handleSaveFornecedor = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formCNPJ || !formRazaoSocial) {
      toast.error('Campos obrigatórios', 'Por favor, preencha o CNPJ e a Razão Social.');
      return;
    }

    setSaving(true);
    try {
      const dataFornecedor = {
        cnpj: formCNPJ,
        razao_social: formRazaoSocial,
        usuario_nome: formUsuarioNome || null,
        usuario_email: formUsuarioEmail || null,
        usuario_whatsapp: formUsuarioWhatsapp || null,
        contato_nome: formContatoNome || null,
        contato_email: formContatoEmail || null,
        contato_telefone: formContatoTelefone || null,
        implementos: formImplementos || [],
        cep: formCEP || null,
        endereco: formEndereco || null,
        numero: formNumero || null,
        complemento: formComplemento || null,
        bairro: formBairro || null,
        cidade: formCidade || null,
        estado: formEstado || null
      };

      if (editingFornecedor) {
        const { error } = await supabase
          .from('fornecedores')
          .update(dataFornecedor)
          .eq('id', editingFornecedor.id);

        if (error) {
          toast.error('Erro ao atualizar fornecedor', error.message);
        } else {
          toast.success('Fornecedor updated com sucesso!');
          setDrawerOpen(false);
          loadFornecedores();
        }
      } else {
        const { error } = await supabase
          .from('fornecedores')
          .insert([dataFornecedor]);

        if (error) {
          toast.error('Erro ao cadastrar fornecedor', error.message);
        } else {
          toast.success('Novo fornecedor cadastrado com sucesso!');
          setDrawerOpen(false);
          setCurrentPage(1);
          loadFornecedores();
        }
      }
    } catch (err) {
      console.error('Erro inesperado ao salvar fornecedor:', err);
    } finally {
      setSaving(false);
    }
  };

  // Excluir
  const handleDeleteFornecedor = (id: string, name: string) => {
    setFornecedorToDelete({ id, name });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (fornecedorToDelete) {
      try {
        const { error } = await supabase
          .from('fornecedores')
          .delete()
          .eq('id', fornecedorToDelete.id);

        if (error) {
          toast.error('Erro ao remover fornecedor', error.message);
        } else {
          toast.success('Fornecedor removido com sucesso!');
          setDeleteConfirmOpen(false);
          setFornecedorToDelete(null);
          loadFornecedores();
        }
      } catch (err) {
        console.error('Erro ao deletar fornecedor:', err);
      }
    }
  };

  return (
    <DashboardLayout
      pageTitle="Fornecedores"
      pageSubtitle="Gerencie seus fornecedores e seus respectivos implementos."
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
        <div style={{ width: 220 }}>
          <Select
            options={FILTER_IMPLEMENTO_OPTIONS}
            value={filterImplemento}
            onChange={(opt) => {
              setFilterImplemento(opt as OptionType);
              setCurrentPage(1);
            }}
            placeholder="Implementos (Todos)"
          />
        </div>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)', marginLeft: 'var(--spacing-8)' }}>
          {totalCount} {totalCount === 1 ? 'fornecedor' : 'fornecedores'}
        </span>

        {/* Botão Novo Fornecedor alinhado à direita */}
        <div style={{ marginLeft: 'auto' }}>
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
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                  Carregando fornecedores...
                </td>
              </tr>
            ) : filteredFornecedores.length === 0 ? (
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
            
            {/* Paginação */}
            <Pagination
              currentPage={currentPage}
              totalCount={totalCount}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
              itemLabel="fornecedores"
            />
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
            <Button variant="primary" onClick={handleSaveFornecedor} loading={saving}>
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
                Cadastro <span title="Informe o CNPJ para preencher a razão social" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}><Question size={14} style={{ color: 'var(--color-grey-400)' }} /></span>
              </h3>
              <p className="fornecedor-section-desc">Informe o CNPJ para preencher a razão social</p>
            </div>
            <div className="fornecedor-section-fields">
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
