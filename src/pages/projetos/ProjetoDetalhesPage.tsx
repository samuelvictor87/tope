// pages/projetos/ProjetoDetalhesPage.tsx — Detalhes do Projeto e Timeline de Cotações TOPE
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Plus,
  Eye,
  Pencil,
  Clock,
  CheckCircle,
  XCircle,
  DownloadSimple,
  FileText
} from '@phosphor-icons/react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import '../../styles/components/cotacoes.css';

interface Vendedor {
  id: string;
  nome_completo: string;
  email: string;
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
}

interface ItemValor {
  id: string;
  cotacao_item_id: string;
  prazo: number;
  preco_aluguel: number;
  vpl: number;
  tir: number;
  planilha_url: string | null;
  planilha_nome: string | null;
  planilha_path: string | null;
  calculado_em: string | null;
}

interface CotacaoItem {
  id: string;
  descricao: string;
  quantidade: number;
  valores: ItemValor[];
}

interface CotacaoVersao {
  id: string;
  versao: number;
  ativo: boolean;
  status: string;
  criado_em: string;
  prazos: number[];
  estimativa_rodagem_km: number;
  itens: CotacaoItem[];
}

export function ProjetoDetalhesPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  // Estados locais
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [versoes, setVersoes] = useState<CotacaoVersao[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloning, setCloning] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Estados para edição do projeto
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [formNome, setFormNome] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formVendedor, setFormVendedor] = useState<OptionType | null>(null);
  const [vendedorOptions, setVendedorOptions] = useState<OptionType[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Carregar opções de Vendedores
  useEffect(() => {
    async function loadVendedores() {
      try {
        const { data } = await supabase
          .from('usuarios')
          .select('id, nome_completo')
          .in('perfil', ['vendedor', 'administrador'])
          .order('nome_completo');
        if (data) {
          setVendedorOptions(data.map((v: any) => ({ value: v.id, label: v.nome_completo })));
        }
      } catch (err) {
        console.error('Erro ao buscar vendedores:', err);
      }
    }
    loadVendedores();
  }, []);

  const handleOpenEditModal = () => {
    if (!projeto) return;
    setFormNome(projeto.nome || '');
    setFormDescricao(projeto.descricao || '');
    if (projeto.vendedor) {
      setFormVendedor({ value: projeto.vendedor.id, label: projeto.vendedor.nome_completo });
    } else if (projeto.vendedor_id) {
      const match = vendedorOptions.find(o => o.value === projeto.vendedor_id);
      setFormVendedor(match || null);
    } else {
      setFormVendedor(null);
    }
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projeto) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('projetos')
        .update({
          nome: formNome,
          vendedor_id: formVendedor ? String(formVendedor.value) : null,
          descricao: formDescricao || null,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', projeto.id);

      if (error) throw error;

      toast.success('Projeto atualizado com sucesso!');
      setEditModalOpen(false);
      await loadProjetoDados();
    } catch (err) {
      console.error('Erro ao atualizar projeto:', err);
      toast.error('Erro ao atualizar dados do projeto.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Carregar dados do Projeto e suas Cotações
  const loadProjetoDados = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      // 1. Buscar projeto
      const { data: projData, error: projErr } = await supabase
        .from('projetos')
        .select('*, vendedor:usuarios(id, nome_completo, email)')
        .eq('id', id)
        .single();

      if (projErr || !projData) throw projErr || new Error('Projeto não encontrado.');
      setProjeto(projData);

      // 2. Buscar cotações do projeto
      const { data: cotData, error: cotErr } = await supabase
        .from('cotacoes')
        .select('*')
        .eq('projeto_id', id)
        .order('versao', { ascending: false });

      if (cotErr) throw cotErr;

      const mappedVersoes: CotacaoVersao[] = [];

      if (cotData && cotData.length > 0) {
        for (const cot of cotData) {
          // Buscar itens e valores de cada cotação
          const { data: itsData } = await supabase
            .from('cotacao_itens')
            .select('*')
            .eq('cotacao_id', cot.id)
            .order('criado_em');

          const mappedItens: CotacaoItem[] = [];

          if (itsData && itsData.length > 0) {
            // Buscar valores dos itens de uma vez
            const itemIds = itsData.map(i => i.id);
            const { data: valsData } = await supabase
              .from('cotacao_item_valores')
              .select('*')
              .in('cotacao_item_id', itemIds);

            for (const item of itsData) {
              const itemVals = (valsData || []).filter(v => v.cotacao_item_id === item.id);
              mappedItens.push({
                id: item.id,
                descricao: item.descricao,
                quantidade: item.quantidade,
                valores: itemVals
              });
            }
          }

          mappedVersoes.push({
            id: cot.id,
            versao: cot.versao,
            ativo: cot.ativo,
            status: cot.status,
            criado_em: cot.criado_em,
            prazos: cot.prazos || [],
            estimativa_rodagem_km: cot.estimativa_rodagem_km || 0,
            itens: mappedItens
          });
        }
      }

      setVersoes(mappedVersoes);
    } catch (err: any) {
      toast.error('Erro ao carregar detalhes', err.message || 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadProjetoDados();
  }, [loadProjetoDados]);

  // Alterar Status do Projeto
  const handleUpdateStatus = async (newStatus: 'Em andamento' | 'Aprovado' | 'Reprovado') => {
    if (!projeto) return;
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('projetos')
        .update({ status: newStatus, atualizado_em: new Date().toISOString() })
        .eq('id', projeto.id);

      if (error) throw error;

      toast.success('Status atualizado', `O projeto foi marcado como "${newStatus}".`);
      loadProjetoDados();
    } catch (err: any) {
      toast.error('Erro ao atualizar status', err.message || 'Erro inesperado.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Criar Nova Rodada (Clonar a cotação ativa atual)
  const handleCriarNovaRodada = async () => {
    const ativa = versoes.find(v => v.ativo);
    if (!ativa || !projeto) {
      toast.error('Cotação ativa ausente', 'Não foi possível localizar a versão ativa para clonar.');
      return;
    }

    setCloning(true);
    try {
      // 1. Buscar a cotação ativa no Supabase para garantir os dados mais recentes
      const { data: cotOriginal, error: getCotErr } = await supabase
        .from('cotacoes')
        .select('*')
        .eq('id', ativa.id)
        .single();

      if (getCotErr || !cotOriginal) throw getCotErr || new Error('Não foi possível carregar a cotação ativa original.');

      // 2. Criar a nova cotação incrementando a versão
      const novaVersaoNum = cotOriginal.versao + 1;
      const { data: newCot, error: insCotErr } = await supabase
        .from('cotacoes')
        .insert({
          projeto_id: projeto.id,
          cliente_id: cotOriginal.cliente_id,
          vendedor_id: cotOriginal.vendedor_id,
          cnpj: cotOriginal.cnpj,
          razao_social: cotOriginal.razao_social,
          prazos: cotOriginal.prazos,
          estimativa_rodagem_km: cotOriginal.estimativa_rodagem_km,
          tipo_placa: cotOriginal.tipo_placa,
          descricao: cotOriginal.descricao,
          detalhamento_ativo: cotOriginal.detalhamento_ativo,
          status: 'Em avaliação',
          versao: novaVersaoNum,
          ativo: true,
          criado_por: user?.id || null,
          // Taxas globais
          comissao_venda_percentual: cotOriginal.comissao_venda_percentual,
          imposto_venda_ir_percentual: cotOriginal.imposto_venda_ir_percentual,
          imposto_venda_adicional_ir_percentual: cotOriginal.imposto_venda_adicional_ir_percentual,
          imposto_venda_csll_percentual: cotOriginal.imposto_venda_csll_percentual,
          depreciacao_contabil_percentual: cotOriginal.depreciacao_contabil_percentual,
          documentacao_valor: cotOriginal.documentacao_valor,
          ipva_desconto_vista_percentual: cotOriginal.ipva_desconto_vista_percentual,
          ipva_depreciacao_percentual: cotOriginal.ipva_depreciacao_percentual,
          reajuste_aluguel_anual_percentual: cotOriginal.reajuste_aluguel_anual_percentual,
          tma_anual_percentual: cotOriginal.tma_anual_percentual,
          meses_antes_aluguel: cotOriginal.meses_antes_aluguel,
          meses_depois_aluguel: cotOriginal.meses_depois_aluguel
        })
        .select('id')
        .single();

      if (insCotErr || !newCot) throw insCotErr || new Error('Erro ao registrar a nova rodada de cotação.');

      // 3. Buscar os itens da cotação original
      const { data: itensOriginais, error: getItensErr } = await supabase
        .from('cotacao_itens')
        .select('*')
        .eq('cotacao_id', cotOriginal.id);

      if (getItensErr) throw getItensErr;

      if (itensOriginais && itensOriginais.length > 0) {
        for (const item of itensOriginais) {
          // Criar novo item de cotação
          const { data: newItem, error: insItemErr } = await supabase
            .from('cotacao_itens')
            .insert({
              cotacao_id: newCot.id,
              quantidade: item.quantidade,
              descricao: item.descricao,
              implementos: item.implementos,
              caminhao_id: item.caminhao_id,
              caminhao_entre_eixo: item.caminhao_entre_eixo,
              caminhao_tipo_uso: item.caminhao_tipo_uso,
              caminhao_valor: item.caminhao_valor,
              implemento_tipo_uso: item.implemento_tipo_uso,
              implemento_valor: item.implemento_valor,
              caminhao_depreciacao_id: item.caminhao_depreciacao_id,
              implemento_depreciacao_id: item.implemento_depreciacao_id
            })
            .select('id')
            .single();

          if (insItemErr || !newItem) throw insItemErr || new Error('Erro ao duplicar item de cotação.');

          // Buscar e duplicar os valores calculados (e planilhas de validação!)
          const { data: valsOriginais } = await supabase
            .from('cotacao_item_valores')
            .select('*')
            .eq('cotacao_item_id', item.id);

          if (valsOriginais && valsOriginais.length > 0) {
            const valsPayload = valsOriginais.map(v => ({
              cotacao_item_id: newItem.id,
              prazo: v.prazo,
              preco_aluguel: v.preco_aluguel,
              vpl: v.vpl,
              tir: v.tir,
              planilha_url: v.planilha_url,
              planilha_nome: v.planilha_nome,
              planilha_path: v.planilha_path,
              calculado_em: v.calculado_em
            }));

            const { error: insValsErr } = await supabase
              .from('cotacao_item_valores')
              .insert(valsPayload);

            if (insValsErr) throw insValsErr;
          }
        }
      }

      // 4. Desativar a cotação ativa antiga
      const { error: updOldErr } = await supabase
        .from('cotacoes')
        .update({ ativo: false })
        .eq('id', cotOriginal.id);

      if (updOldErr) throw updOldErr;

      // 5. Atualizar atualizado_em do projeto
      await supabase
        .from('projetos')
        .update({ atualizado_em: new Date().toISOString() })
        .eq('id', projeto.id);

      toast.success(`Rodada v${novaVersaoNum} criada!`, 'As taxas, caminhões e anexos foram copiados com sucesso.');
      
      // Envia o usuário direto para a edição da nova versão ativa (v2)
      navigate(`/painel/cotacoes/${newCot.id}/editar`);
    } catch (err: any) {
      toast.error('Erro ao criar rodada', err.message || 'Erro inesperado.');
    } finally {
      setCloning(false);
    }
  };

  // Renderizar a listagem de valores por item em formato amigável (unitário por veículo)
  const renderResumoValores = (versao: CotacaoVersao) => {
    if (!versao.itens || versao.itens.length === 0) {
      return <span style={{ fontSize: '11px', color: 'var(--color-grey-450)' }}>Cálculos não realizados</span>;
    }

    const formatCurrency = (val: number) => {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
        {versao.itens.map((item, idx) => {
          const valoresItem: { [prazo: number]: number } = {};
          item.valores.forEach(v => {
            valoresItem[v.prazo] = v.preco_aluguel;
          });

          return (
            <div key={item.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderBottom: idx < versao.itens.length - 1 ? '1px dashed #e2e8f0' : 'none', paddingBottom: idx < versao.itens.length - 1 ? '6px' : 0 }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-grey-800)' }}>
                {item.quantidade}x {item.descricao}
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {Object.entries(valoresItem)
                  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                  .map(([prazo, valor]) => (
                    <span 
                      key={prazo} 
                      style={{ 
                        fontSize: '11px', 
                        fontWeight: 600, 
                        padding: '2px 8px', 
                        borderRadius: '4px',
                        backgroundColor: valor > 0 ? 'rgba(249, 115, 22, 0.05)' : '#f1f5f9',
                        border: valor > 0 ? '1px solid rgba(249, 115, 22, 0.15)' : '1px solid #e2e8f0',
                        color: valor > 0 ? 'var(--color-primary)' : 'var(--color-grey-500)' 
                      }}
                    >
                      {prazo}m: {valor > 0 ? formatCurrency(valor) : 'Não calculado'}
                    </span>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Obter todas as planilhas de validação vinculadas a uma rodada
  const obterPlanilhasRodada = (versao: CotacaoVersao) => {
    const list: { prazo: number; nome: string; url: string }[] = [];
    versao.itens.forEach(item => {
      item.valores.forEach(v => {
        if (v.planilha_url && v.planilha_nome) {
          list.push({
            prazo: v.prazo,
            nome: v.planilha_nome,
            url: v.planilha_url
          });
        }
      });
    });
    return list;
  };

  if (loading) {
    return (
      <DashboardLayout pageTitle="Carregando..." pageSubtitle="Buscando detalhes do projeto.">
        <div className="loading-state">
          <span style={{ fontSize: '14px', color: 'var(--color-grey-500)' }}>Buscando dados no servidor...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (!projeto) {
    return (
      <DashboardLayout pageTitle="Projeto não encontrado" pageSubtitle="O projeto solicitado não foi localizado.">
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <Button onClick={() => navigate('/painel/projetos')} variant="secondary">
            Voltar para Projetos
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      pageTitle={`Projeto #${projeto.numero}`}
      pageSubtitle={projeto.nome}
      headerActions={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button onClick={() => navigate('/painel/projetos')} variant="secondary">
            <ArrowLeft size={18} style={{ marginRight: '6px' }} />
            Voltar
          </Button>
          {projeto.status === 'Em andamento' && (
            <Button onClick={handleCriarNovaRodada} variant="primary" loading={cloning}>
              <Plus size={18} style={{ marginRight: '6px' }} />
              Criar Nova Rodada
            </Button>
          )}
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.2fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Painel Lateral: Dados Gerais do Projeto */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="cotacao-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--color-grey-900)' }}>
                Identificação do Negócio
              </h4>
              <button
                type="button"
                onClick={handleOpenEditModal}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <Pencil size={14} />
                Editar
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-grey-400)', fontWeight: 600, textTransform: 'uppercase' }}>Razão Social</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-grey-800)' }}>{projeto.razao_social}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-grey-400)', fontWeight: 600, textTransform: 'uppercase' }}>CNPJ</span>
              <span style={{ fontSize: '13px', color: 'var(--color-grey-600)' }}>{projeto.cnpj}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-grey-400)', fontWeight: 600, textTransform: 'uppercase' }}>Vendedor Responsável</span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-grey-800)' }}>
                {projeto.vendedor ? projeto.vendedor.nome_completo : 'Sem vendedor'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-grey-400)', fontWeight: 600, textTransform: 'uppercase' }}>Descrição / Observações</span>
              <p style={{ fontSize: '12px', color: 'var(--color-grey-600)', margin: 0, lineHeight: '1.4' }}>
                {projeto.descricao || <span style={{ fontStyle: 'italic', color: 'var(--color-grey-400)' }}>Nenhuma observação informada.</span>}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #f1f5f9', paddingTop: '14px', marginTop: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-grey-400)', fontWeight: 600, textTransform: 'uppercase' }}>Status do Projeto</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {projeto.status === 'Aprovado' && <Badge variant="success">✓ Aprovado</Badge>}
                {projeto.status === 'Reprovado' && <Badge variant="error">✗ Reprovado</Badge>}
                {projeto.status === 'Em andamento' && <Badge variant="warning">Em andamento</Badge>}
              </div>
            </div>
          </div>

          {/* Card de Controle Comercial (Aprovação/Reprovação) */}
          <div className="cotacao-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--color-grey-900)' }}>
              Decisão Comercial
            </h4>
            <p style={{ fontSize: '11px', color: 'var(--color-grey-500)', margin: '0 0 4px 0', lineHeight: '1.3' }}>
              Mude o status do negócio dependendo da resposta do cliente para arquivar ou fechar a proposta.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <Button 
                onClick={() => handleUpdateStatus('Aprovado')} 
                variant="secondary" 
                disabled={updatingStatus || projeto.status === 'Aprovado'}
                style={{ justifyContent: 'flex-start', color: '#16a34a', borderColor: 'rgba(22,163,74,0.3)', backgroundColor: projeto.status === 'Aprovado' ? 'rgba(22,163,74,0.04)' : '#fff' }}
              >
                <CheckCircle size={16} style={{ marginRight: '8px' }} />
                Aprovar Negócio (Proposta Fechada)
              </Button>
              <Button 
                onClick={() => handleUpdateStatus('Reprovado')} 
                variant="secondary"
                disabled={updatingStatus || projeto.status === 'Reprovado'}
                style={{ justifyContent: 'flex-start', color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)', backgroundColor: projeto.status === 'Reprovado' ? 'rgba(220,38,38,0.04)' : '#fff' }}
              >
                <XCircle size={16} style={{ marginRight: '8px' }} />
                Reprovar Negócio (Perdido)
              </Button>
              {projeto.status !== 'Em andamento' && (
                <Button 
                  onClick={() => handleUpdateStatus('Em andamento')} 
                  variant="secondary"
                  disabled={updatingStatus}
                  style={{ justifyContent: 'flex-start', color: 'var(--color-grey-600)', borderColor: '#e2e8f0' }}
                >
                  <Clock size={16} style={{ marginRight: '8px' }} />
                  Reabrir Negociação
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Linha do Tempo (Timeline) de Cotações / Rodadas */}
        <div className="cotacao-card" style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 700, color: 'var(--color-grey-900)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={20} />
            Evolução das Rodadas (Linha do Tempo)
          </h3>

          {versoes.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-grey-450)' }}>
              Nenhuma rodada de cotação registrada neste projeto.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', borderLeft: '2px solid #e2e8f0', marginLeft: '12px', paddingLeft: '24px', gap: '28px', marginTop: '10px' }}>
              
              {versoes.map((ver) => {
                const planilhas = obterPlanilhasRodada(ver);
                
                return (
                  <div key={ver.id} style={{ position: 'relative' }}>
                    {/* Marcador na linha do tempo */}
                    <div 
                      style={{ 
                        position: 'absolute', 
                        left: '-33px', 
                        top: '4px',
                        width: '16px', 
                        height: '16px', 
                        borderRadius: '50%', 
                        backgroundColor: ver.ativo ? 'var(--color-primary)' : '#cbd5e1',
                        border: ver.ativo ? '4px solid #ffedd5' : '4px solid #f1f5f9',
                        boxSizing: 'border-box',
                        zIndex: 10
                      }} 
                    />

                    {/* Conteúdo da Rodada */}
                    <div 
                      style={{ 
                        padding: '16px', 
                        borderRadius: 'var(--radius-lg)', 
                        backgroundColor: ver.ativo ? '#fff' : '#f8fafc',
                        border: ver.ativo ? '1px solid rgba(249,115,22,0.3)' : '1px solid #e2e8f0',
                        boxShadow: ver.ativo ? '0 10px 15px -3px rgba(249,115,22,0.04), 0 4px 6px -2px rgba(249,115,22,0.02)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: ver.ativo ? 'var(--color-grey-900)' : 'var(--color-grey-600)' }}>
                              Cotação Rodada v{ver.versao}
                            </span>
                            {ver.ativo ? (
                              <Badge variant="warning">Versão Ativa</Badge>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--color-grey-400)', fontWeight: 500, backgroundColor: '#e2e8f0', padding: '1px 6px', borderRadius: '4px' }}>
                                Histórico
                              </span>
                            )}
                          </div>
                          
                          <div style={{ fontSize: '11px', color: 'var(--color-grey-400)', marginTop: '4px', display: 'flex', gap: '10px' }}>
                            <span>Criado em: {new Date(ver.criado_em).toLocaleString('pt-BR')}</span>
                            <span>•</span>
                            <span>{ver.itens.reduce((acc, i) => acc + i.quantidade, 0)} veículo(s)</span>
                          </div>
                        </div>

                        {/* Ações da Rodada */}
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {ver.ativo && projeto.status === 'Em andamento' ? (
                            <Button 
                              size="sm" 
                              variant="primary" 
                              onClick={() => navigate(`/painel/cotacoes/${ver.id}/editar`)}
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                            >
                              <Pencil size={14} style={{ marginRight: '6px' }} />
                              Editar Valores
                            </Button>
                          ) : (
                            <Button 
                              size="sm" 
                              variant="secondary" 
                              onClick={() => navigate(`/painel/cotacoes/${ver.id}/editar`)}
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                            >
                              <Eye size={14} style={{ marginRight: '6px' }} />
                              Visualizar (Leitura)
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Resumo Financeiro da Rodada */}
                      <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '12px', paddingTop: '10px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--color-grey-450)', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '6px', letterSpacing: '0.5px' }}>
                          Aluguel Mensal por Veículo (Unitário)
                        </span>
                        {renderResumoValores(ver)}
                      </div>

                      {/* Planilhas de Validação do Diretor anexadas nesta versão */}
                      {planilhas.length > 0 && (
                        <div style={{ marginTop: '12px', backgroundColor: ver.ativo ? '#fafafb' : '#fff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <span style={{ fontSize: '11px', color: 'var(--color-grey-500)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                            <FileText size={14} />
                            Planilhas de Validação da Diretoria (v{ver.versao}):
                          </span>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {planilhas.map((plan, pi) => (
                              <div key={pi} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#fff', padding: '4px 10px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)' }}>
                                  {plan.prazo}m
                                </span>
                                <span style={{ fontSize: '11px', color: 'var(--color-grey-600)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={plan.nome}>
                                  {plan.nome}
                                </span>
                                <a 
                                  href={`${plan.url}?download=`} 
                                  download={plan.nome}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '50%',
                                    backgroundColor: 'rgba(249,115,22,0.08)',
                                    color: 'var(--color-primary)',
                                    border: '1px solid rgba(249,115,22,0.2)'
                                  }}
                                  title={`Baixar planilha de ${plan.prazo}m`}
                                >
                                  <DownloadSimple size={12} />
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </div>

      </div>

      {/* Modal de Edição do Projeto */}
      {editModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal" style={{ width: '100%', maxWidth: '540px', padding: '24px', backgroundColor: '#fff', borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-grey-900)', margin: 0 }}>
                Editar Dados do Projeto
              </h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--color-grey-400)', fontWeight: 'bold' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Input
                label="Nome do Projeto / Proposta"
                placeholder="Nome do projeto..."
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                disabled={savingEdit}
                required
              />

              <Select
                label="Vendedor Responsável"
                options={vendedorOptions}
                value={formVendedor}
                onChange={(opt) => setFormVendedor(opt as OptionType | null)}
                placeholder="Selecione o vendedor..."
              />

              <Textarea
                label="Descrição / Observações Gerais"
                placeholder="Escreva detalhes gerais sobre a negociação..."
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                disabled={savingEdit}
                rows={3}
              />

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditModalOpen(false)}
                  disabled={savingEdit}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={savingEdit}
                >
                  Salvar Alterações
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
