// pages/projetos/ProjetosPage.tsx — Módulo de Projetos TOPE
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Trash, 
  Eye,
  CheckCircle,
  Warning,
  ArrowRight
} from '@phosphor-icons/react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useToast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Pagination } from '../../components/ui/Pagination';
import { Textarea } from '../../components/ui/Textarea';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import '../../styles/components/cotacoes.css';
import '../../styles/components/table.css';

// Interfaces
interface Vendedor {
  id: string;
  nome_completo: string;
  email: string;
}

interface Cliente {
  id: string;
  cnpj: string;
  razao_social: string;
}

interface Projeto {
  id: string;
  numero: number;
  cliente_id: string | null;
  cnpj: string;
  razao_social: string;
  nome: string;
  descricao: string | null;
  vendedor_id: string | null;
  status: 'Em andamento' | 'Aprovado' | 'Reprovado';
  criado_em: string;
  atualizado_em: string;
  vendedor: Vendedor | null;
  cotacoes?: Array<{
    id: string;
    ativo: boolean;
    cotacao_itens?: Array<{
      id: string;
      quantidade: number;
      cotacao_item_valores?: Array<{
        prazo: number;
        preco_aluguel: number;
      }>;
    }>;
  }>;
}

export function ProjetosPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  // Estados locais
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterVendedor, setFilterVendedor] = useState<OptionType | null>({ value: 'Todos', label: 'Vendedor (Todos)' });
  const [filterStatus, setFilterStatus] = useState<OptionType | null>({ value: 'Todos', label: 'Status (Todos)' });

  // Opções de Vendedores
  const [vendedorFilterOptions, setVendedorFilterOptions] = useState<OptionType[]>([
    { value: 'Todos', label: 'Vendedor (Todos)' }
  ]);
  const [vendedorFormOptions, setVendedorFormOptions] = useState<OptionType[]>([]);

  // Criação de Projeto (Modal)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formCNPJ, setFormCNPJ] = useState('');
  const [formRazaoSocial, setFormRazaoSocial] = useState('');
  const [formNomeProjeto, setFormNomeProjeto] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formVendedor, setFormVendedor] = useState<OptionType | null>(null);
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);
  const [isClienteCadastrado, setIsClienteCadastrado] = useState(false);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Exclusão
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [projetoToDelete, setProjetoToDelete] = useState<Projeto | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce da busca
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Carregar Vendedores
  useEffect(() => {
    async function loadVendedores() {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('id, nome_completo, email')
          .in('perfil', ['vendedor', 'administrador'])
          .order('nome_completo');
        
        if (error) throw error;

        if (data) {
          const mapped = data.map((v: any) => ({
            value: v.id,
            label: v.nome_completo
          }));
          setVendedorFilterOptions([
            { value: 'Todos', label: 'Vendedor (Todos)' },
            ...mapped
          ]);
          setVendedorFormOptions(mapped);
          
          // Se for vendedor logado, preenche por padrão no form
          if (profile?.perfil === 'vendedor') {
            const match = mapped.find((m: any) => m.value === profile.id);
            if (match) setFormVendedor(match);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar vendedores:', err);
      }
    }
    loadVendedores();
  }, [profile, vendedorFormOptions.length]);

  // Carregar Projetos
  const loadProjetos = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('projetos')
        .select(`
          *,
          vendedor:usuarios(id, nome_completo, email),
          cotacoes(id, ativo, cotacao_itens(id, quantidade, cotacao_item_valores(prazo, preco_aluguel)))
        `, { count: 'exact' });

      // Filtros
      if (filterStatus && filterStatus.value !== 'Todos') {
        query = query.eq('status', filterStatus.value);
      }
      if (filterVendedor && filterVendedor.value !== 'Todos') {
        query = query.eq('vendedor_id', filterVendedor.value);
      }
      
      // Busca por CNPJ, Razão Social ou Nome do Projeto
      if (debouncedSearch.trim()) {
        const term = `%${debouncedSearch.trim()}%`;
        query = query.or(`cnpj.ilike.${term},razao_social.ilike.${term},nome.ilike.${term}`);
      }

      // Paginação
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await query
        .order('numero', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setProjetos(data || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      toast.error('Erro ao carregar projetos', err.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, filterVendedor, filterStatus, toast]);

  useEffect(() => {
    loadProjetos();
  }, [loadProjetos]);

  // soft delete do projeto
  const handleConfirmDelete = async () => {
    if (!projetoToDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('projetos')
        .delete()
        .eq('id', projetoToDelete.id);

      if (error) throw error;

      toast.success('Projeto removido', 'O projeto e todas as suas cotações foram removidos.');
      setDeleteConfirmOpen(false);
      setProjetoToDelete(null);
      loadProjetos();
    } catch (err: any) {
      toast.error('Erro ao excluir projeto', err.message || 'Erro inesperado.');
    } finally {
      setDeleting(false);
    }
  };

  // Helper CNPJ
  const maskCNPJ = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .substring(0, 18);
  };

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormCNPJ(maskCNPJ(e.target.value));
  };

  // Buscar CNPJ via Receita / Banco de Dados local
  const handleCNPJBlur = async () => {
    const clean = formCNPJ.replace(/\D/g, '');
    if (clean.length !== 14) return;

    setBuscandoCNPJ(true);
    try {
      // 1. Verificar base local
      const { data: client } = await supabase
        .from('clientes')
        .select('id, cnpj, razao_social, vendedor_id')
        .eq('cnpj', formCNPJ)
        .maybeSingle();

      if (client) {
        setClienteId(client.id);
        setFormRazaoSocial(client.razao_social);
        setIsClienteCadastrado(true);
        if (client.vendedor_id) {
          const match = vendedorFormOptions.find(o => o.value === client.vendedor_id);
          if (match) setFormVendedor(match);
        }
        toast.success('Cliente cadastrado localizado com sucesso!');
      } else {
        setIsClienteCadastrado(false);
        setClienteId(null);
        // 2. API externa
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
        if (res.ok) {
          const apiData = await res.json();
          if (apiData.razao_social) {
            setFormRazaoSocial(apiData.razao_social);
            toast.success('Empresa localizada via Receita Federal!');
          }
        } else {
          toast.warning('Aviso de cadastro', 'Cliente não cadastrado. Insira a Razão Social manualmente.');
        }
      }
    } catch (err) {
      console.error('Erro ao buscar CNPJ:', err);
    } finally {
      setBuscandoCNPJ(false);
    }
  };

  // Criar Projeto e Cotação v1
  const handleCreateProjeto = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formCNPJ.trim() || !formRazaoSocial.trim() || !formNomeProjeto.trim()) {
      toast.error('Campos obrigatórios', 'Por favor, preencha o CNPJ, Razão Social e Nome do Projeto.');
      return;
    }

    setSubmitting(true);
    try {
      let currentClienteId = clienteId;

      // Se o cliente não existir localmente, cadastrar primeiro
      if (!currentClienteId) {
        const { data: newClient, error: clientErr } = await supabase
          .from('clientes')
          .insert({ cnpj: formCNPJ, razao_social: formRazaoSocial, vendedor_id: formVendedor?.value || null })
          .select('id')
          .single();
        if (clientErr || !newClient) throw new Error(`Erro ao cadastrar cliente: ${clientErr?.message}`);
        currentClienteId = newClient.id;
      }

      // 1. Criar o Projeto
      const { data: newProj, error: projErr } = await supabase
        .from('projetos')
        .insert({
          cnpj: formCNPJ,
          razao_social: formRazaoSocial,
          cliente_id: currentClienteId,
          nome: formNomeProjeto.trim(),
          descricao: formDescricao.trim() || null,
          vendedor_id: formVendedor?.value || null,
          status: 'Em andamento',
          criado_por: user?.id || null
        })
        .select('id')
        .single();

      if (projErr || !newProj) throw projErr || new Error('Não foi possível registrar o novo projeto.');

      // 2. Criar a Cotação v1 vinculada a este projeto
      const { data: newCot, error: cotErr } = await supabase
        .from('cotacoes')
        .insert({
          projeto_id: newProj.id,
          cliente_id: currentClienteId,
          vendedor_id: formVendedor?.value || null,
          cnpj: formCNPJ,
          razao_social: formRazaoSocial,
          prazos: [60],
          estimativa_rodagem_km: 5000,
          tipo_placa: 'Comum',
          status: 'Em avaliação',
          versao: 1,
          ativo: true,
          criado_por: user?.id || null
        })
        .select('id')
        .single();

      if (cotErr || !newCot) throw cotErr || new Error('Não foi possível iniciar a cotação v1 do projeto.');

      toast.success('Projeto criado com sucesso!', 'Iniciando a primeira cotação (v1)...');
      setCreateModalOpen(false);
      
      // Limpar form
      setFormCNPJ('');
      setFormRazaoSocial('');
      setFormNomeProjeto('');
      setFormDescricao('');
      
      // Redireciona para edição da Cotação v1
      navigate(`/painel/cotacoes/${newCot.id}/editar`);
    } catch (err: any) {
      toast.error('Erro ao criar projeto', err.message || 'Erro inesperado.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper de badges de status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Aprovado':
        return <Badge variant="success">Aprovado</Badge>;
      case 'Reprovado':
        return <Badge variant="danger">Reprovado</Badge>;
      default:
        return <Badge variant="warning">Em andamento</Badge>;
    }
  };

  return (
    <DashboardLayout
      pageTitle="Projetos"
      pageSubtitle="Gerencie as oportunidades e propostas corporativas de aluguel."
    >
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
            placeholder="Buscar por nome do projeto, cliente ou CNPJ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ height: 38 }}
          />
        </div>
        <div style={{ width: 200 }}>
          <Select
            options={vendedorFilterOptions}
            value={filterVendedor}
            onChange={(opt) => setFilterVendedor(opt as OptionType | null)}
            placeholder="Vendedor"
          />
        </div>
        <div style={{ width: 200 }}>
          <Select
            options={[
              { value: 'Todos', label: 'Status (Todos)' },
              { value: 'Em andamento', label: 'Em andamento' },
              { value: 'Aprovado', label: 'Aprovado' },
              { value: 'Reprovado', label: 'Reprovado' }
            ]}
            value={filterStatus}
            onChange={(opt) => setFilterStatus(opt as OptionType | null)}
            placeholder="Status"
          />
        </div>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-grey-500)', marginLeft: 'var(--spacing-8)' }}>
          {totalCount} {totalCount === 1 ? 'projeto' : 'projetos'}
        </span>

        {/* Botão Novo Projeto alinhado à direita */}
        <div style={{ marginLeft: 'auto' }}>
          <Button
            variant="primary"
            onClick={() => setCreateModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, height: 38 }}
          >
            <Plus size={16} weight="bold" />
            Novo Projeto
          </Button>
        </div>
      </div>

        {/* Listagem */}
        {loading && projetos.length === 0 ? (
          <div className="loading-state">
            <span style={{ fontSize: '14px', color: 'var(--color-grey-500)' }}>Carregando projetos...</span>
          </div>
        ) : projetos.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px', textAlign: 'center', backgroundColor: '#fff', borderRadius: 'var(--radius-lg)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-grey-800)', margin: '0 0 8px 0' }}>
              Nenhum projeto encontrado
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-grey-500)', margin: '0 0 20px 0' }}>
              Crie o seu primeiro projeto para iniciar uma negociação de locação de veículos.
            </p>
            <Button onClick={() => setCreateModalOpen(true)} variant="outline">
              Criar Novo Projeto
            </Button>
          </div>
        ) : (
          <div className="table-container" style={{ marginBottom: 'var(--spacing-24)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '80px', textAlign: 'center' }}>PROJETO</th>
                  <th>NOME DO PROJETO</th>
                  <th>CLIENTE</th>
                  <th>ALUGUEL MENSAL</th>
                  <th>VENDEDOR</th>
                  <th style={{ width: '140px', textAlign: 'center' }}>STATUS</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>ATUALIZADO</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {projetos.map(proj => {
                  const projetoCotacoes = (proj.cotacoes || []) as any[];
                  const cotacaoAtiva = projetoCotacoes.find(c => c.ativo) || projetoCotacoes[0];

                  const itensExibicao: Array<{
                    descricao: string;
                    quantidade: number;
                    valores: { [prazo: number]: number };
                  }> = [];

                  if (cotacaoAtiva && cotacaoAtiva.cotacao_itens) {
                    cotacaoAtiva.cotacao_itens.forEach((item: any) => {
                      const valores: { [prazo: number]: number } = {};
                      if (item.cotacao_item_valores) {
                        item.cotacao_item_valores.forEach((val: any) => {
                          valores[val.prazo] = Number(val.preco_aluguel) || 0;
                        });
                      }
                      itensExibicao.push({
                        descricao: item.descricao || 'Sem descrição',
                        quantidade: item.quantidade || 1,
                        valores,
                      });
                    });
                  }

                  return (
                    <tr key={proj.id}>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--color-grey-800)' }}>
                        #{proj.numero}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--color-grey-900)' }}>{proj.nome}</span>
                          {proj.descricao && (
                            <span style={{ fontSize: '11px', color: 'var(--color-grey-500)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {proj.descricao}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-grey-800)' }}>{proj.razao_social}</span>
                          <span style={{ fontSize: '11px', color: 'var(--color-grey-450)' }}>{proj.cnpj}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {itensExibicao.length > 0 ? (
                            itensExibicao.map((item, i) => (
                              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: i < itensExibicao.length - 1 ? '1px dashed #f1f5f9' : 'none', paddingBottom: i < itensExibicao.length - 1 ? '4px' : 0 }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-grey-750)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                                  {item.quantidade}x {item.descricao}
                                </span>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {Object.entries(item.valores)
                                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                                    .map(([prazo, valor]) => (
                                      <span
                                        key={prazo}
                                        style={{
                                          fontSize: '10px',
                                          fontWeight: 600,
                                          color: 'var(--color-primary)',
                                          backgroundColor: 'rgba(249,115,22,0.05)',
                                          padding: '1px 4px',
                                          borderRadius: '3px',
                                          border: '1px solid rgba(249,115,22,0.1)',
                                          whiteSpace: 'nowrap'
                                        }}
                                      >
                                        {prazo}m: {valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      </span>
                                    ))}
                                </div>
                              </div>
                            ))
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--color-grey-400)', fontStyle: 'italic' }}>
                              Não calculado
                            </span>
                          )}
                        </div>
                      </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-grey-800)' }}>
                          {proj.vendedor ? proj.vendedor.nome_completo : 'Sem vendedor'}
                        </span>
                        {proj.vendedor && (
                          <span style={{ fontSize: '10px', color: 'var(--color-grey-400)' }}>{proj.vendedor.email}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {getStatusBadge(proj.status)}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '12px', color: 'var(--color-grey-500)' }}>
                      {new Date(proj.atualizado_em).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => navigate(`/painel/projetos/${proj.id}`)}
                          title="Ver detalhes do projeto"
                          style={{ borderColor: 'rgba(249,115,22,0.2)', color: 'var(--color-primary)' }}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="action-btn action-btn-delete"
                          onClick={() => {
                            setProjetoToDelete(proj);
                            setDeleteConfirmOpen(true);
                          }}
                          title="Remover projeto e cotações"
                        >
                          <Trash size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

            {totalCount > ITEMS_PER_PAGE && (
              <Pagination
                currentPage={currentPage}
                totalCount={totalCount}
                pageSize={ITEMS_PER_PAGE}
                onPageChange={(page) => setCurrentPage(page)}
              />
            )}
          </div>
        )}

        {/* Modal de Criação de Projeto */}
        {createModalOpen && (
          <div className="modal-overlay" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
            <div className="modal" style={{ width: '100%', maxWidth: '580px', padding: '24px', backgroundColor: '#fff', borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-grey-900)', margin: 0 }}>
                  Novo Projeto Comercial
                </h3>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--color-grey-400)', fontWeight: 'bold' }}
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateProjeto} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '16px' }}>
                  <div>
                    <Input
                      label="CNPJ do Cliente"
                      placeholder="00.000.000/0000-00"
                      value={formCNPJ}
                      onChange={handleCNPJChange}
                      onBlur={handleCNPJBlur}
                      disabled={buscandoCNPJ || submitting}
                      required
                    />
                    {buscandoCNPJ && <span style={{ fontSize: '11px', color: 'var(--color-primary)' }}>Buscando Receita...</span>}
                  </div>
                  <div>
                    <Input
                      label="Razão Social"
                      placeholder="Razão Social ou Nome do Cliente"
                      value={formRazaoSocial}
                      onChange={(e) => setFormRazaoSocial(e.target.value)}
                      disabled={isClienteCadastrado || submitting}
                      required
                    />
                    {isClienteCadastrado && (
                      <div className="cnpj-status-success" style={{ display: 'flex', gap: '4px', alignItems: 'center', fontSize: '11px', color: '#16a34a', marginTop: '4px' }}>
                        <CheckCircle size={14} weight="fill" />
                        Cliente cadastrado. Razão Social travada.
                      </div>
                    )}
                  </div>
                </div>

                <Input
                  label="Nome do Projeto / Proposta"
                  placeholder="Ex: Frota de Distribuição Região Sul"
                  value={formNomeProjeto}
                  onChange={(e) => setFormNomeProjeto(e.target.value)}
                  disabled={submitting}
                  required
                />

                <Select
                  label="Vendedor Responsável"
                  options={vendedorFormOptions}
                  value={formVendedor}
                  onChange={(opt) => setFormVendedor(opt as OptionType | null)}
                  placeholder="Selecione o vendedor..."
                />

                <Textarea
                  label="Descrição / Observações Gerais"
                  placeholder="Escreva detalhes gerais sobre a negociação..."
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  disabled={submitting}
                  rows={3}
                />

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCreateModalOpen(false)}
                    disabled={submitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={submitting}
                  >
                    <span>Criar Projeto e v1</span>
                    <ArrowRight size={16} style={{ marginLeft: '6px' }} />
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Exclusão */}
        <ConfirmModal
          isOpen={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Excluir Projeto?"
          description={`Tem certeza que deseja remover o projeto "${projetoToDelete?.nome}"? Isso irá deletar todas as rodadas e planilhas vinculadas permanentemente.`}
          confirmText="Excluir tudo"
          cancelText="Cancelar"
          loading={deleting}
        />
    </DashboardLayout>
  );
}
