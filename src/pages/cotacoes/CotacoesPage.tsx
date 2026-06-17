// pages/cotacoes/CotacoesPage.tsx — Módulo de Cotações TOPE
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Pencil, 
  Trash, 
  ChatCircleText, 
  Funnel, 
  PaperPlaneRight,
  Eye
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
import { Drawer } from '../../components/ui/Drawer';
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

interface Cotacao {
  id: string;
  numero: number;
  criado_em: string;
  atualizado_em: string;
  cliente_id: string | null;
  vendedor_id: string | null;
  cnpj: string;
  razao_social: string;
  prazos: number[];
  estimativa_rodagem_km: number;
  tipo_placa: 'Comum' | 'ANTT';
  descricao: string | null;
  detalhamento_ativo: boolean;
  status: 'Em avaliação' | 'Em orçamento' | 'Completo';
  vendedor: Vendedor | null;
}

interface Comentario {
  id: string;
  cotacao_id: string;
  usuario_id: string;
  criado_em: string;
  mensagem: string;
  usuario: {
    nome_completo: string;
    email: string;
  };
}

export function CotacoesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Estados locais da listagem
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filtros
  const [showFilters, setShowFilters] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterVendedor, setFilterVendedor] = useState<OptionType | null>({ value: 'Todos', label: 'Vendedor (Todos)' });
  const [filterStatus, setFilterStatus] = useState<OptionType | null>({ value: 'Todos', label: 'Status (Todos)' });

  // Opções de Vendedores para Filtro
  const [vendedorFilterOptions, setVendedorFilterOptions] = useState<OptionType[]>([
    { value: 'Todos', label: 'Vendedor (Todos)' }
  ]);

  // Exclusão (Soft Delete)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [cotacaoToDelete, setCotacaoToDelete] = useState<Cotacao | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Comentários (Drawer)
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [selectedCotacao, setSelectedCotacao] = useState<Cotacao | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Debounce da busca
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Carregar Vendedores para o Filtro
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

  // Query de Cotações
  const loadCotacoes = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('cotacoes')
        .select(`
          *,
          vendedor:usuarios(id, nome_completo, email)
        `, { count: 'exact' });

      // Ocultar excluídos
      query = query.is('excluido_em', null);

      // Busca textual por Razão Social, CNPJ ou ID sequencial
      if (debouncedSearch.trim()) {
        const term = `%${debouncedSearch.trim()}%`;
        const numericTerm = parseInt(debouncedSearch.trim(), 10);

        if (!isNaN(numericTerm)) {
          // Se for numérico, busca pelo número exato da cotação ou pelo texto
          query = query.or(`numero.eq.${numericTerm},razao_social.ilike.${term},cnpj.ilike.${term}`);
        } else {
          query = query.or(`razao_social.ilike.${term},cnpj.ilike.${term}`);
        }
      }

      // Filtro de Vendedor
      if (filterVendedor && filterVendedor.value !== 'Todos') {
        query = query.eq('vendedor_id', filterVendedor.value);
      }

      // Filtro de Status
      if (filterStatus && filterStatus.value !== 'Todos') {
        query = query.eq('status', filterStatus.value);
      }

      // Paginação
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.order('numero', { ascending: false }).range(from, to);

      const { data, error, count } = await query;

      if (error) {
        toast.error('Erro ao carregar cotações', error.message);
      } else {
        setCotacoes((data as any[]) || []);
        setTotalCount(count || 0);
      }
    } catch (err: any) {
      toast.error('Erro inesperado', err.message || 'Ocorreu um erro ao consultar as cotações.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterVendedor, filterStatus, currentPage, toast]);

  // Carregar dados iniciais e re-carregar em mudanças de filtros/paginas
  useEffect(() => {
    loadCotacoes();
  }, [loadCotacoes]);

  // Resetar paginação ao mudar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterVendedor, filterStatus]);

  // Ações de Deleção
  const handleDeleteClick = (cotacao: Cotacao) => {
    setCotacaoToDelete(cotacao);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!cotacaoToDelete) return;
    setDeleting(true);
    try {
      // Soft Delete: preenche excluido_em
      const { error } = await supabase
        .from('cotacoes')
        .update({ excluido_em: new Date().toISOString() })
        .eq('id', cotacaoToDelete.id);

      if (error) {
        toast.error('Erro ao excluir cotação', error.message);
      } else {
        toast.success('Cotação excluída com sucesso', `A cotação #${cotacaoToDelete.numero} foi arquivada.`);
        loadCotacoes();
      }
    } catch (err: any) {
      toast.error('Erro inesperado', err.message);
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
      setCotacaoToDelete(null);
    }
  };

  // Comentários: Carregar
  const loadComentarios = async (cotacaoId: string) => {
    setLoadingComments(true);
    try {
      const { data, error } = await supabase
        .from('cotacao_comentarios')
        .select(`
          *,
          usuario:usuarios(nome_completo, email)
        `)
        .eq('cotacao_id', cotacaoId)
        .order('criado_em', { ascending: true });

      if (error) {
        toast.error('Erro ao carregar comentários', error.message);
      } else {
        setComentarios((data as any[]) || []);
      }
    } catch (err: any) {
      toast.error('Erro ao buscar comentários', err.message);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleCommentsClick = (cotacao: Cotacao) => {
    setSelectedCotacao(cotacao);
    setNewCommentText('');
    setCommentDrawerOpen(true);
    loadComentarios(cotacao.id);
  };

  // Enviar Comentário
  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedCotacao || !profile) return;
    setSubmittingComment(true);
    try {
      const { error } = await supabase
        .from('cotacao_comentarios')
        .insert({
          cotacao_id: selectedCotacao.id,
          usuario_id: profile.id,
          mensagem: newCommentText.trim()
        });

      if (error) {
        toast.error('Erro ao enviar comentário', error.message);
      } else {
        setNewCommentText('');
        loadComentarios(selectedCotacao.id);
      }
    } catch (err: any) {
      toast.error('Erro ao enviar comentário', err.message);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Formatação de data
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(date);
    } catch (e) {
      return '-';
    }
  };

  // Formatação de Prazos
  const formatPrazos = (prazos: number[]) => {
    if (!prazos || prazos.length === 0) return '-';
    return prazos.map(p => `${p}m`).join(', ');
  };

  // Get Status Class
  const getStatusBadge = (status: Cotacao['status']) => {
    switch (status) {
      case 'Em avaliação':
        return <Badge variant="warning">Em avaliação</Badge>;
      case 'Em orçamento':
        return <Badge variant="info">Em orçamento</Badge>;
      case 'Completo':
        return <Badge variant="success">Completo</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  // Header Actions
  const headerActions = (
    <Button 
      variant="primary" 
      onClick={() => navigate('/painel/cotacoes/nova')}
      className="btn-primary"
    >
      <Plus size={18} style={{ marginRight: '6px' }} />
      Nova cotação
    </Button>
  );

  return (
    <DashboardLayout 
      pageTitle="Cotações" 
      pageSubtitle="Gerencie seus pedidos de cotação até a apuração do valor de locação."
      headerActions={headerActions}
    >
      {/* Bloco de Filtros */}
      {showFilters && (
        <div className="cotacoes-filters">
          <div className="cotacoes-search-wrap">
            <Input
              type="text"
              placeholder="Buscar por cliente, CNPJ ou nº da cotação..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="cotacoes-select-wrap">
            <Select
              options={vendedorFilterOptions}
              value={filterVendedor}
              onChange={setFilterVendedor}
              placeholder="Vendedor"
            />
          </div>
          <div className="cotacoes-select-wrap">
            <Select
              options={[
                { value: 'Todos', label: 'Status (Todos)' },
                { value: 'Em avaliação', label: 'Em avaliação' },
                { value: 'Em orçamento', label: 'Em orçamento' },
                { value: 'Completo', label: 'Completo' }
              ]}
              value={filterStatus}
              onChange={setFilterStatus}
              placeholder="Status"
            />
          </div>
          <div className="cotacoes-count">
            {totalCount} cotação(es)
          </div>
        </div>
      )}

      {/* Tabela de Listagem */}
      <div className="table-container">
        {loading ? (
          <div className="table-loading-container" style={{ padding: '60px', textAlign: 'center', color: 'var(--color-grey-450)' }}>
            Carregando cotações...
          </div>
        ) : cotacoes.length === 0 ? (
          <div className="table-empty-container" style={{ padding: '60px', textAlign: 'center', color: 'var(--color-grey-400)' }}>
            Nenhuma cotação encontrada.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>ID</th>
                <th style={{ width: '120px' }}>Data</th>
                <th>Cliente</th>
                <th>Vendedor</th>
                <th>Prazos</th>
                <th style={{ width: '150px' }}>Status</th>
                <th style={{ width: '140px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {cotacoes.map((cotacao) => (
                <tr key={cotacao.id}>
                  <td>
                    <span className="cotacao-primary-text">#{cotacao.numero}</span>
                  </td>
                  <td>
                    <span className="cotacao-secondary-text">{formatDate(cotacao.criado_em)}</span>
                  </td>
                  <td>
                    <div className="cotacao-cliente-cell">
                      {cotacao.razao_social ? (
                        <>
                          <span className="cotacao-primary-text" title={cotacao.razao_social}>
                            {cotacao.razao_social.length > 45 ? `${cotacao.razao_social.substring(0, 45)}...` : cotacao.razao_social}
                          </span>
                          <span className="cotacao-secondary-text">{cotacao.cnpj || 'CNPJ não informado'}</span>
                        </>
                      ) : (
                        <span className="cotacao-secondary-text" style={{ fontStyle: 'italic' }}>Sem identificação</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="cotacao-vendedor-cell">
                      {cotacao.vendedor ? (
                        <>
                          <span className="cotacao-primary-text">{cotacao.vendedor.nome_completo}</span>
                          <span className="cotacao-secondary-text">{cotacao.vendedor.email}</span>
                        </>
                      ) : (
                        <span className="cotacao-secondary-text">Vendedor não associado</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="cotacao-primary-text">{formatPrazos(cotacao.prazos)}</span>
                  </td>
                  <td>
                    {getStatusBadge(cotacao.status)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        className="btn-action"
                        onClick={() => handleCommentsClick(cotacao)}
                        title="Comentários e Histórico"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--color-grey-500)',
                          transition: 'background 0.2s',
                        }}
                      >
                        <ChatCircleText size={18} />
                      </button>
                      <button
                        className="btn-action"
                        onClick={() => navigate(`/painel/cotacoes/${cotacao.id}/editar`)}
                        title="Editar cotação"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--color-grey-500)',
                          transition: 'background 0.2s',
                        }}
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        className="btn-action"
                        onClick={() => handleDeleteClick(cotacao)}
                        title="Excluir cotação"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--color-error)',
                          transition: 'background 0.2s',
                        }}
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {!loading && totalCount > ITEMS_PER_PAGE && (
        <div style={{ marginTop: 'var(--spacing-16)' }}>
          <Pagination
            currentPage={currentPage}
            totalCount={totalCount}
            pageSize={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Modal de Confirmação de Deleção */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Exclusão"
        message={`Deseja realmente arquivar a cotação #${cotacaoToDelete?.numero}?`}
        subMessage="Esta ação não pode ser desfeita fisicamente, mas a cotação poderá ser reativada por administradores."
        confirmLabel="Sim, excluir"
        cancelLabel="Cancelar"
        loading={deleting}
      />

      {/* Drawer lateral de Comentários */}
      <Drawer
        isOpen={commentDrawerOpen}
        onClose={() => {
          setCommentDrawerOpen(false);
          setSelectedCotacao(null);
        }}
        title={`Comentários - Cotação #${selectedCotacao?.numero}`}
        subtitle={selectedCotacao?.razao_social || undefined}
        width="460px"
      >
        <div className="comentarios-drawer-body">
          {/* Lista de Comentários */}
          <div className="comentarios-list">
            {loadingComments ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-grey-400)' }}>
                Carregando comentários...
              </div>
            ) : comentarios.length === 0 ? (
              <div className="comentarios-empty">
                Nenhum comentário nesta cotação. Seja o primeiro a comentar!
              </div>
            ) : (
              comentarios.map((c) => (
                <div key={c.id} className="comentario-item">
                  <div className="comentario-meta">
                    <span className="comentario-autor">{c.usuario?.nome_completo || 'Usuário'}</span>
                    <span className="comentario-data">{formatDate(c.criado_em)} {new Date(c.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="comentario-texto">{c.mensagem}</p>
                </div>
              ))
            )}
          </div>

          {/* Enviar novo comentário */}
          {profile ? (
            <form onSubmit={handleSendComment} className="comentario-form">
              <div className="comentario-input-row">
                <Textarea
                  placeholder="Escreva sua anotação ou comentário interno..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  disabled={submittingComment}
                />
                <Button 
                  type="submit" 
                  variant="primary"
                  disabled={!newCommentText.trim() || submittingComment}
                  style={{ height: '40px', padding: '0 12px', minWidth: '40px' }}
                >
                  <PaperPlaneRight size={18} />
                </Button>
              </div>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: '12px', color: 'var(--color-grey-500)', fontSize: 'var(--font-size-xs)' }}>
              Faça login para interagir com comentários.
            </div>
          )}
        </div>
      </Drawer>
    </DashboardLayout>
  );
}
