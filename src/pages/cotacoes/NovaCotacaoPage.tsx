// pages/cotacoes/NovaCotacaoPage.tsx — Form de Nova/Editar Cotação TOPE
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ExcelJS from 'exceljs/dist/exceljs.min.js';
import {
  ArrowLeft,
  FloppyDisk,
  Trash,
  Warning,
  CheckCircle,
  FileArrowUp,
  FileArrowDown,
  List,
  Wrench,
  Truck,
  Copy,
  Pencil,
  Check,
  X,
  Calculator,
  DownloadSimple,
} from '@phosphor-icons/react';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { MultiSelect } from '../../components/ui/MultiSelect';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Textarea';
import { useToast } from '../../components/ui/Toast';
import { FileUpload } from '../../components/ui/FileUpload';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ItemImplementoModal } from './ItemImplementoModal';
import type { ImplementoEscolha } from './ItemImplementoModal';
import { ItemCaminhaoModal } from './ItemCaminhaoModal';
import type { CaminhaoSelecionado } from './ItemCaminhaoModal';
import { CalculoItemModal } from './CalculoItemModal';
import type { TipoUsoDepreciacao } from '../../types/configuracoes.types';
import JSZip from 'jszip';
import { getTemplateConfig } from '../../utils/templateConfig';
import { readTemplateCashFlowData, goalSeekFromTemplate } from '../../utils/financialUtils';
import type { TemplateData } from '../../utils/financialUtils';
import { buscarDepreciacaoCaminhao, buscarDepreciacaoImplemento } from '../../services/configuracoes.service';
import '../../styles/components/cotacoes.css';

// ─── Interfaces locais ────────────────────────────────────────────────────────
export interface ItemLocal {
  tempId: string;
  id?: string;
  quantidade: number;
  descricao: string;
  implementos: ImplementoEscolha[];
  caminhao: CaminhaoSelecionado | null;
  caminhao_tipo_uso?: TipoUsoDepreciacao;
  caminhao_valor?: number;
  implemento_tipo_uso?: TipoUsoDepreciacao;
  implemento_valor?: number;

  // IDs correspondentes nas tabelas de depreciação do banco
  caminhao_depreciacao_id?: string | null;
  implemento_depreciacao_id?: string | null;

  editandoDescricao?: boolean;
  descricaoEditTemp?: string;

  // Planilhas de validação anexadas localmente por prazo (antes de salvar)
  planilhasNovas?: { [prazo: number]: File };

  // Planilhas de validação salvas no banco por prazo
  planilhasSalvas?: {
    [prazo: number]: {
      url: string;
      nome: string;
      path: string;
      calculado_em?: string;
    };
  };
  // Valores calculados salvos no banco por prazo
  valoresCalculados?: {
    [prazo: number]: {
      preco_aluguel: number;
      vpl: number;
      tir: number;
    };
  };
}

interface AnexoSalvo {
  id: string;
  arquivo_nome: string;
  arquivo_url: string;
  arquivo_path: string;
  mime_type: string;
  tamanho_bytes: number;
}

// Opções estáticas para seleção de prazos
const PRAZO_OPTIONS = [
  { value: '12', label: '12' },
  { value: '24', label: '24' },
  { value: '36', label: '36' },
  { value: '48', label: '48' },
  { value: '60', label: '60' },
  { value: '72', label: '72' },
  { value: '84', label: '84' },
  { value: '120', label: '120' }
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const maskCNPJ = (val: string) => {
  const digits = val.replace(/\D/g, '').slice(0, 14);
  let masked = digits;
  if (digits.length > 2) masked = `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length > 5) masked = `${masked.slice(0, 6)}.${digits.slice(5)}`;
  if (digits.length > 8) masked = `${masked.slice(0, 10)}/${digits.slice(8)}`;
  if (digits.length > 12) masked = `${masked.slice(0, 15)}-${digits.slice(12)}`;
  return masked;
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
  return resultado === parseInt(digitos.charAt(1));
};

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const gerarTempId = () => `temp-${Date.now()}-${Math.random()}`;

// ─── Componente principal ─────────────────────────────────────────────────────
export function NovaCotacaoPage() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const { user, profile } = useAuth();

  // ── Estados do Formulário principal ─────────────────────────────────────────
  const [formCNPJ, setFormCNPJ] = useState('');
  const [formRazaoSocial, setFormRazaoSocial] = useState('');
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [isClienteCadastrado, setIsClienteCadastrado] = useState(false);
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);

  const [prazos, setPrazos] = useState<number[]>([60]);
  const [estimativaRodagem, setEstimativaRodagem] = useState('5000');
  const [tipoPlaca, setTipoPlaca] = useState<OptionType | null>({ value: 'Comum', label: 'Comum' });
  const [descricao, setDescricao] = useState('');
  const [detalhamentoAtivo, setDetalhamentoAtivo] = useState(false);
  const [status, setStatus] = useState<OptionType | null>({ value: 'Em avaliação', label: 'Em avaliação' });
  const [vendedor, setVendedor] = useState<OptionType | null>(null);

  // ── Tabelas auxiliares ───────────────────────────────────────────────────────
  const [vendedorOptions, setVendedorOptions] = useState<OptionType[]>([]);

  // ── Itens da cotação ─────────────────────────────────────────────────────────
  const [itens, setItens] = useState<ItemLocal[]>([]);
  const [novaQtd, setNovaQtd] = useState(1);
  const [novaDescricao, setNovaDescricao] = useState('');

  // ── Modais de Item ───────────────────────────────────────────────────────────
  const [implementoModalOpen, setImplementoModalOpen] = useState(false);
  const [caminhaoModalOpen, setCaminhaoModalOpen] = useState(false);
  const [calculoModalOpen, setCalculoModalOpen] = useState(false);
  const [itemCalculoAtivo, setItemCalculoAtivo] = useState<ItemLocal | null>(null);
  const [itemAtivo, setItemAtivo] = useState<string | null>(null); // tempId
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState<{
    itemTempId: string;
    prazo: number;
    nomePlanilha: string;
  } | null>(null);
  const [_configLocacao, setConfigLocacao] = useState<any>(null);

  const [cotacaoTab, setCotacaoTab] = useState<'dados' | 'itens'>('dados');
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [projetoId, setProjetoId] = useState<string | null>(null);
  const [cotacaoVersao, setCotacaoVersao] = useState(1);
  const [projetoCriadoEm, setProjetoCriadoEm] = useState<string | null>(null);

  // ── Taxas & Despesas da cotação (globais) ──────────────────────────────────────
  const [cotComissao, setCotComissao] = useState('');
  const [cotIr, setCotIr] = useState('');
  const [cotAdicionalIr, setCotAdicionalIr] = useState('');
  const [cotCsll, setCotCsll] = useState('');
  const [cotDepreciacaoContabil, setCotDepreciacaoContabil] = useState('');
  const [cotDocumentacao, setCotDocumentacao] = useState('');
  const [cotIpvaDesconto, setCotIpvaDesconto] = useState('');
  const [cotIpvaDepreciacao, setCotIpvaDepreciacao] = useState('');
  const [cotReajusteAluguel, setCotReajusteAluguel] = useState('');
  const [cotTmaAnual, setCotTmaAnual] = useState('');
  const [cotMesesAntesAluguel, setCotMesesAntesAluguel] = useState('');
  const [cotMesesDepoisAluguel, setCotMesesDepoisAluguel] = useState('');

  // ── Arquivos / Anexos ────────────────────────────────────────────────────────
  const [novosArquivos, setNovosArquivos] = useState<File[]>([]);
  const [anexosSalvos, setAnexosSalvos] = useState<AnexoSalvo[]>([]);
  const [anexosDeletarIds, setAnexosDeletarIds] = useState<AnexoSalvo[]>([]);

  // ── Loadings ─────────────────────────────────────────────────────────────────
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [gerandoProposta, setGerandoProposta] = useState(false);

  // ── 1. Carrega vendedores ────────────────────────────────────────────────────
  useEffect(() => {
    async function loadVendedores() {
      try {
        const { data: vts } = await supabase
          .from('usuarios')
          .select('id, nome_completo')
          .in('perfil', ['vendedor', 'administrador'])
          .order('nome_completo');
        if (vts) {
          const opts = vts.map(u => ({ value: u.id, label: u.nome_completo }));
          setVendedorOptions(opts);
          if (!isEditMode && profile && (profile.perfil === 'vendedor' || profile.perfil === 'administrador')) {
            setVendedor({ value: profile.id, label: profile.nome_completo });
          }
        }
      } catch (err) {
        console.error('Erro ao carregar vendedores:', err);
      }
    }
    loadVendedores();
  }, [isEditMode, profile]);

  // ── 2. Carregar Cotação Existente (Edição) ───────────────────────────────────
  useEffect(() => {
    async function loadConfigLocacao() {
      try {
        const { data, error } = await supabase
          .from('cal_configuracoes_locacao')
          .select('*')
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) {
          console.error('Erro ao carregar configurações globais:', error.message);
        }
        if (data) {
          setConfigLocacao(data);
          // Pré-preencher taxas da cotação com valores globais (apenas nova cotação)
          if (!isEditMode) {
            setCotComissao(String(data.comissao_venda_percentual ?? ''));
            setCotIr(data.imposto_venda_ir_percentual != null ? String(+(data.imposto_venda_ir_percentual * 100).toFixed(4)) : '');
            setCotAdicionalIr(data.imposto_venda_adicional_ir_percentual != null ? String(+(data.imposto_venda_adicional_ir_percentual * 100).toFixed(4)) : '');
            setCotCsll(data.imposto_venda_csll_percentual != null ? String(+(data.imposto_venda_csll_percentual * 100).toFixed(4)) : '');
            setCotDepreciacaoContabil(data.depreciacao_contabil_percentual != null ? String(+(data.depreciacao_contabil_percentual * 100).toFixed(4)) : '');
            setCotDocumentacao(String(data.documentacao_valor ?? ''));
            setCotIpvaDesconto(data.ipva_desconto_vista_percentual != null ? String(+(data.ipva_desconto_vista_percentual * 100).toFixed(4)) : '');
            setCotIpvaDepreciacao(data.ipva_depreciacao_percentual != null ? String(+(data.ipva_depreciacao_percentual * 100).toFixed(4)) : '');
            setCotReajusteAluguel(data.reajuste_aluguel_anual_percentual != null ? String(+(data.reajuste_aluguel_anual_percentual * 100).toFixed(4)) : '');
            setCotTmaAnual(data.tma_anual_percentual != null ? String(+(data.tma_anual_percentual * 100).toFixed(4)) : '');
            setCotMesesAntesAluguel(String(data.meses_antes_aluguel ?? ''));
            setCotMesesDepoisAluguel(String(data.meses_depois_aluguel ?? ''));
          }
        }
      } catch (err) {
        console.error('Erro ao carregar configurações globais:', err);
      }
    }
    loadConfigLocacao();
  }, []);

  useEffect(() => {
    async function loadCotacao() {
      if (!isEditMode || !id) return;
      setLoadingData(true);
      try {
        // Carrega configurações de locação vigentes no momento
        const { data: _activeConfig } = await supabase
          .from('cal_configuracoes_locacao')
          .select('*')
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: cot, error: errC } = await supabase
          .from('cotacoes')
          .select('*, vendedor:usuarios(id, nome_completo)')
          .eq('id', id)
          .single();

        if (errC || !cot) {
          toast.error('Erro ao carregar cotação', errC?.message || 'Cotação não localizada.');
          navigate('/painel/projetos');
          return;
        }

        setProjetoId(cot.projeto_id);
        setCotacaoVersao(cot.versao || 1);
        setIsReadOnly(cot.ativo === false);

        // Carregar data de criação do projeto
        if (cot.projeto_id) {
          const { data: projData } = await supabase
            .from('projetos')
            .select('criado_em')
            .eq('id', cot.projeto_id)
            .single();
          if (projData?.criado_em) {
            setProjetoCriadoEm(projData.criado_em);
          }
        }

        setFormCNPJ(maskCNPJ(cot.cnpj));
        setFormRazaoSocial(cot.razao_social);
        setClienteId(cot.cliente_id);
        setIsClienteCadastrado(!!cot.cliente_id);
        setPrazos(cot.prazos || [60]);
        setEstimativaRodagem(cot.estimativa_rodagem_km?.toString() || '5000');
        setTipoPlaca({ value: cot.tipo_placa, label: cot.tipo_placa });
        setDescricao(cot.descricao || '');
        setDetalhamentoAtivo(cot.detalhamento_ativo);
        setStatus({ value: cot.status, label: cot.status });
        if (cot.vendedor) {
          setVendedor({ value: cot.vendedor.id, label: cot.vendedor.nome_completo });
        }

        // Carregar taxas da cotação salvas
        setCotComissao(cot.comissao_venda_percentual != null ? String(cot.comissao_venda_percentual) : '');
        setCotIr(cot.imposto_venda_ir_percentual != null ? String(+(cot.imposto_venda_ir_percentual * 100).toFixed(4)) : '');
        setCotAdicionalIr(cot.imposto_venda_adicional_ir_percentual != null ? String(+(cot.imposto_venda_adicional_ir_percentual * 100).toFixed(4)) : '');
        setCotCsll(cot.imposto_venda_csll_percentual != null ? String(+(cot.imposto_venda_csll_percentual * 100).toFixed(4)) : '');
        setCotDepreciacaoContabil(cot.depreciacao_contabil_percentual != null ? String(+(cot.depreciacao_contabil_percentual * 100).toFixed(4)) : '');
        setCotDocumentacao(cot.documentacao_valor != null ? String(cot.documentacao_valor) : '');
        setCotIpvaDesconto(cot.ipva_desconto_vista_percentual != null ? String(+(cot.ipva_desconto_vista_percentual * 100).toFixed(4)) : '');
        setCotIpvaDepreciacao(cot.ipva_depreciacao_percentual != null ? String(+(cot.ipva_depreciacao_percentual * 100).toFixed(4)) : '');
        setCotReajusteAluguel(cot.reajuste_aluguel_anual_percentual != null ? String(+(cot.reajuste_aluguel_anual_percentual * 100).toFixed(4)) : '');
        setCotTmaAnual(cot.tma_anual_percentual != null ? String(+(cot.tma_anual_percentual * 100).toFixed(4)) : '');
        setCotMesesAntesAluguel(cot.meses_antes_aluguel != null ? String(cot.meses_antes_aluguel) : '');
        setCotMesesDepoisAluguel(cot.meses_depois_aluguel != null ? String(cot.meses_depois_aluguel) : '');

        // Carregar Anexos
        const { data: anxs } = await supabase
          .from('cotacao_anexos')
          .select('*')
          .eq('cotacao_id', id);
        if (anxs) setAnexosSalvos(anxs);

        // Carregar Itens
        if (cot.detalhamento_ativo) {
          const { data: its } = await supabase
            .from('cotacao_itens')
            .select('*, caminhao:caminhoes(id, modelo, familia)')
            .eq('cotacao_id', id)
            .order('criado_em');

          if (its) {
            const itemIds = its.map((i: any) => i.id);
            const { data: valores } = await supabase
              .from('cotacao_item_valores')
              .select('*')
              .in('cotacao_item_id', itemIds);

            const mappedItens: ItemLocal[] = its.map((item: any) => {
              const itemValores = (valores || []).filter((v: any) => v.cotacao_item_id === item.id);
              const planilhasSalvas: { [prazo: number]: any } = {};
              const valoresCalculados: { [prazo: number]: any } = {};
              itemValores.forEach((v: any) => {
                if (v.planilha_url) {
                  planilhasSalvas[v.prazo] = {
                    url: v.planilha_url,
                    nome: v.planilha_nome,
                    path: v.planilha_path,
                    calculado_em: v.calculado_em,
                  };
                }
                valoresCalculados[v.prazo] = {
                  preco_aluguel: Number(v.preco_aluguel) || 0,
                  vpl: Number(v.vpl) || 0,
                  tir: Number(v.tir) || 0,
                };
              });

              return {
                tempId: gerarTempId(),
                id: item.id,
                quantidade: item.quantidade,
                descricao: item.descricao || '',
                implementos: item.implementos || [],
                caminhao: item.caminhao_id ? {
                  caminhao_id: item.caminhao_id,
                  caminhao_entre_eixo: item.caminhao_entre_eixo || '',
                  caminhao_modelo: item.caminhao?.modelo || '',
                  caminhao_familia: item.caminhao?.familia || '',
                } : null,
                caminhao_tipo_uso: item.caminhao_tipo_uso || undefined,
                caminhao_valor: item.caminhao_valor !== null ? Number(item.caminhao_valor) : undefined,
                implemento_tipo_uso: item.implemento_tipo_uso || undefined,
                implemento_valor: item.implemento_valor !== null ? Number(item.implemento_valor) : undefined,

                // IDs de depreciação
                caminhao_depreciacao_id: item.caminhao_depreciacao_id || null,
                implemento_depreciacao_id: item.implemento_depreciacao_id || null,
                planilhasSalvas,
                valoresCalculados,
              };
            });
            setItens(mappedItens);
          }
        }
      } catch (err: any) {
        toast.error('Erro de consulta', err.message);
      } finally {
        setLoadingData(false);
      }
    }
    loadCotacao();
  }, [isEditMode, id, navigate, toast]);

  // ── 3. Busca CNPJ ────────────────────────────────────────────────────────────
  const handleCNPJBlur = async () => {
    const clean = formCNPJ.replace(/\D/g, '');
    if (clean.length !== 14) return;
    if (!validarCNPJ(clean)) {
      toast.error('CNPJ Inválido', 'O CNPJ informado não possui formato ou dígitos verificadores válidos.');
      return;
    }

    setBuscandoCNPJ(true);
    try {
      const { data: client } = await supabase
        .from('clientes')
        .select('id, cnpj, razao_social')
        .eq('cnpj', formCNPJ)
        .maybeSingle();

      if (client) {
        setClienteId(client.id);
        setFormRazaoSocial(client.razao_social);
        setIsClienteCadastrado(true);
        toast.success('Cliente cadastrado localizado com sucesso!');
      } else {
        setIsClienteCadastrado(false);
        setClienteId(null);
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
        if (res.ok) {
          const apiData = await res.json();
          if (apiData.razao_social) {
            setFormRazaoSocial(apiData.razao_social);
            toast.success('Empresa localizada via Receita Federal! Razão Social preenchida.');
          }
        } else {
          toast.warning('Aviso de cadastro', 'Cliente não cadastrado no TOPE. Digite a Razão Social manualmente.');
        }
      }
    } catch (err) {
      console.error('Erro ao buscar CNPJ:', err);
    } finally {
      setBuscandoCNPJ(false);
      setAutoSaveTrigger(prev => prev + 1);
    }
  };

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormCNPJ(maskCNPJ(e.target.value));
  };

  // ── Handlers de Itens ────────────────────────────────────────────────────────
  const handleAdicionarItem = () => {
    if (!novaDescricao.trim()) {
      toast.warning('Descrição obrigatória', 'Preencha a descrição do item antes de adicionar.');
      return;
    }
    const novoItem: ItemLocal = {
      tempId: gerarTempId(),
      quantidade: novaQtd,
      descricao: novaDescricao.trim(),
      implementos: [],
      caminhao: null,
      
      // (taxas são globais da cotação, não do item)
    };
    setItens(prev => [...prev, novoItem]);
    setNovaQtd(1);
    setNovaDescricao('');
    setAutoSaveTrigger(prev => prev + 1);
  };

  const handleRemoverItem = (tempId: string) => {
    setItens(prev => prev.filter(i => i.tempId !== tempId));
    setAutoSaveTrigger(prev => prev + 1);
  };

  const handleDuplicarItem = (tempId: string) => {
    const item = itens.find(i => i.tempId === tempId);
    if (!item) return;
    setItens(prev => [...prev, { ...item, tempId: gerarTempId(), id: undefined }]);
    setAutoSaveTrigger(prev => prev + 1);
  };

  const handleIniciarEdicaoDescricao = (tempId: string) => {
    setItens(prev => prev.map(i =>
      i.tempId === tempId ? { ...i, editandoDescricao: true, descricaoEditTemp: i.descricao } : i
    ));
  };

  const handleSalvarDescricao = (tempId: string) => {
    setItens(prev => prev.map(i =>
      i.tempId === tempId ? { ...i, descricao: i.descricaoEditTemp || i.descricao, editandoDescricao: false } : i
    ));
    setAutoSaveTrigger(prev => prev + 1);
  };

  const handleCancelarEdicaoDescricao = (tempId: string) => {
    setItens(prev => prev.map(i =>
      i.tempId === tempId ? { ...i, editandoDescricao: false } : i
    ));
  };

  // ── Abre modais de implemento e caminhão ─────────────────────────────────────
  const handleAbrirImplemento = (tempId: string) => {
    setItemAtivo(tempId);
    setImplementoModalOpen(true);
  };

  const handleAbrirCaminhao = (tempId: string) => {
    setItemAtivo(tempId);
    setCaminhaoModalOpen(true);
  };

  const handleSalvarImplemento = (
    implementos: ImplementoEscolha[], 
    tipoUso: TipoUsoDepreciacao, 
    valor: number
  ) => {
    if (!itemAtivo) return;
    setItens(prev => prev.map(i =>
      i.tempId === itemAtivo ? { 
        ...i, 
        implementos, 
        implemento_tipo_uso: tipoUso, 
        implemento_valor: valor 
      } : i
    ));
    setAutoSaveTrigger(prev => prev + 1);
  };

  const handleSalvarCaminhao = (
    caminhao: CaminhaoSelecionado, 
    tipoUso: TipoUsoDepreciacao, 
    valor: number
  ) => {
    if (!itemAtivo) return;
    setItens(prev => prev.map(i =>
      i.tempId === itemAtivo ? { 
        ...i, 
        caminhao, 
        caminhao_tipo_uso: tipoUso, 
        caminhao_valor: valor 
      } : i
    ));
    setAutoSaveTrigger(prev => prev + 1);
  };

  const handleSalvarCamposCalculo = (updatedFields: Partial<ItemLocal>) => {
    if (!itemCalculoAtivo) return;
    setItens(prev => prev.map(i =>
      i.tempId === itemCalculoAtivo.tempId ? { ...i, ...updatedFields } : i
    ));
    setAutoSaveTrigger(prev => prev + 1);
  };

  const handleGerarPropostaExcel = async () => {
    try {
      setGerandoProposta(true);

      // 1. Buscar o template da proposta base
      const response = await fetch('/proposta_base.xlsx');
      if (!response.ok) throw new Error('Não foi possível carregar a proposta base.');
      const arrayBuffer = await response.arrayBuffer();

      // 2. Carregar a planilha com ExcelJS
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      const sheet = workbook.worksheets[0];

      // 3. Salvar estilos e alturas das linhas modelo
      const rowCabecalhoModelo = sheet.getRow(15);
      const rowHeaderModelo = sheet.getRow(16);
      const rowDadosModelo = sheet.getRow(17);

      // Guardar Condições Gerais (linhas 26 a 35)
      const condicoesGerais: Array<{ values: any[]; height: number; styles: any[] }> = [];
      for (let r = 26; r <= 35; r++) {
        const row = sheet.getRow(r);
        const rowValues = [];
        const rowStyles = [];
        for (let c = 1; c <= 11; c++) {
          const cell = row.getCell(c);
          rowValues.push(cell.value);
          rowStyles.push({
            font: cell.font,
            fill: cell.fill,
            border: cell.border,
            alignment: cell.alignment,
            numFormat: cell.numFormat
          });
        }
        condicoesGerais.push({
          values: rowValues,
          height: row.height,
          styles: rowStyles
        });
      }

      // 4. Preencher dados dinâmicos do cliente e data
      sheet.getCell('A11').value = `Cliente: ${formRazaoSocial}`;
      
      const dataAtualFormatada = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
      sheet.getCell('A12').value = dataAtualFormatada;

      // 5. Limpar mesclagens e deletar linhas antigas (linhas 15 em diante)
      (sheet as any)._merges = {};

      // Remesclar o título principal (linha 10)
      sheet.mergeCells('A10:K10');

      const totalRows = sheet.rowCount;
      for (let r = totalRows; r >= 15; r--) {
        sheet.spliceRows(r, 1);
      }

      // 6. Inserir itens e prazos da cotação
      let currentRowNum = 15;

      for (const item of itens) {
        // Montar descrição detalhada do veículo e implemento
        let descricaoItem = '';
        if (item.caminhao) {
          const marcaModelo = item.caminhao.caminhao_familia 
            ? `${item.caminhao.caminhao_familia} - ${item.caminhao.caminhao_modelo}` 
            : item.caminhao.caminhao_modelo;
          const entreEixo = item.caminhao.caminhao_entre_eixo 
            ? ` (entre-eixo: ${item.caminhao.caminhao_entre_eixo})` 
            : '';
          descricaoItem = `${marcaModelo}${entreEixo}`;
        } else {
          descricaoItem = item.descricao || 'VEÍCULO';
        }

        if (item.implementos && item.implementos.length > 0) {
          const implsStr = item.implementos.map(impl => {
            const attrs = impl.atributos.map(a => a.atributo_nome).filter(Boolean).join(', ');
            return `${impl.categoria_nome}${attrs ? ` [${attrs}]` : ''}`;
          }).join(' + ');
          
          descricaoItem = `${descricaoItem} EQUIPADO COM ${implsStr}`;
        }

        const textoFinal = `${descricaoItem.toUpperCase()} (${item.quantidade} UNIDADE${item.quantidade > 1 ? 'S' : ''})`;

        // 1. Inserir cabeçalho principal da tabela do item (antiga linha 15)
        const rowHeader1 = sheet.insertRow(currentRowNum, []);
        rowHeader1.height = rowCabecalhoModelo.height;

        for (let c = 1; c <= 11; c++) {
          const cellOrigem = rowCabecalhoModelo.getCell(c);
          const cellDestino = rowHeader1.getCell(c);
          cellDestino.value = c === 1 ? textoFinal : cellOrigem.value;
          cellDestino.font = cellOrigem.font;
          cellDestino.fill = cellOrigem.fill;
          cellDestino.border = cellOrigem.border;
          cellDestino.alignment = cellOrigem.alignment;
        }

        currentRowNum++;

        // 2. Inserir header secundário da tabela (antiga linha 16)
        const rowHeader2 = sheet.insertRow(currentRowNum, []);
        rowHeader2.height = rowHeaderModelo.height;
        for (let c = 1; c <= 11; c++) {
          const cellOrigem = rowHeaderModelo.getCell(c);
          const cellDestino = rowHeader2.getCell(c);
          cellDestino.value = c === 1 ? '' : cellOrigem.value;
          cellDestino.font = cellOrigem.font;
          cellDestino.fill = cellOrigem.fill;
          cellDestino.border = cellOrigem.border;
          cellDestino.alignment = cellOrigem.alignment;
        }

        currentRowNum++;

        // Ordenar prazos de forma decrescente (ex: 36, 24)
        const prazosOrdenados = [...prazos].sort((a, b) => b - a);
        const startLine = currentRowNum;

        prazosOrdenados.forEach((prazo, idx) => {
          const rowDados = sheet.insertRow(currentRowNum, []);
          rowDados.height = rowDadosModelo.height;

          const isPrimeira = idx === 0;
          const calcVal = item.valoresCalculados?.[prazo];
          const precoAluguel = calcVal?.preco_aluguel || 0;

          // Preencher colunas
          rowDados.getCell(1).value = ''; // Limpar coluna A
          rowDados.getCell(2).value = isPrimeira ? 'SIM' : ''; // Emplacamento
          rowDados.getCell(3).value = isPrimeira ? 'LOCATÁRIA' : ''; // Pneus
          rowDados.getCell(4).value = isPrimeira ? prazo : ''; // Prazo (meses)
          rowDados.getCell(5).value = isPrimeira ? 'NÃO' : ''; // VW Service
          rowDados.getCell(6).value = isPrimeira ? (estimativaRodagem ? Number(estimativaRodagem) : '') : ''; // Rodagem
          rowDados.getCell(7).value = `${prazo} MESES`; // Prazo contrato
          rowDados.getCell(8).value = precoAluguel; // Valor mensal

          // Fórmulas
          rowDados.getCell(9).value = { formula: `H${currentRowNum}*9.25%` };
          rowDados.getCell(10).value = { formula: `H${currentRowNum}*34%` };
          rowDados.getCell(11).value = { formula: `H${currentRowNum}-I${currentRowNum}-J${currentRowNum}` };

          // Copiar estilos e forçar moeda nas colunas de valor (8 a 11)
          for (let c = 1; c <= 11; c++) {
            const cellOrigem = rowDadosModelo.getCell(c);
            const cellDestino = rowDados.getCell(c);
            cellDestino.font = cellOrigem.font;
            cellDestino.fill = cellOrigem.fill;
            cellDestino.border = cellOrigem.border;
            cellDestino.alignment = cellOrigem.alignment;
            
            if (c >= 8 && c <= 11) {
              cellDestino.numFormat = '[$R$-416] #,##0.00';
            } else {
              cellDestino.numFormat = cellOrigem.numFormat;
            }
          }

          currentRowNum++;
        });

        // Mesclar a Coluna A verticalmente incluindo o header secundário e deixar em branco para a logo
        const logoStartLine = startLine - 1;
        const logoEndLine = startLine + prazosOrdenados.length - 1;
        if (logoEndLine >= logoStartLine) {
          try {
            sheet.unmergeCells(`A${logoStartLine}:A${logoEndLine}`);
          } catch (e) {}
          sheet.mergeCells(`A${logoStartLine}:A${logoEndLine}`);
          
          const cellA = sheet.getCell(`A${logoStartLine}`);
          cellA.value = '';
          cellA.alignment = {
            vertical: 'middle',
            horizontal: 'center'
          };
          
          cellA.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' } // Branco sólido
          };
          
          const cellOrigemA = rowDadosModelo.getCell(1);
          cellA.border = cellOrigemA.border;
        }

        // Linha em branco
        sheet.insertRow(currentRowNum, []);
        currentRowNum++;
      }

      // 7. Inserir Condições Gerais no final
      condicoesGerais.forEach(cg => {
        const row = sheet.insertRow(currentRowNum, cg.values);
        row.height = cg.height;
        for (let c = 1; c <= 11; c++) {
          const cell = row.getCell(c);
          const style = cg.styles[c - 1];
          if (style) {
            cell.font = style.font;
            cell.fill = style.fill;
            cell.border = style.border;
            cell.alignment = style.alignment;
            cell.numFormat = style.numFormat;
          }
        }
        currentRowNum++;
      });

      // 8. Escrever e disparar download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      // Código de Proposta (ex: LOG2607-A.xlsx)
      const cleanCliente = (formRazaoSocial || 'COT')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z]/g, '')
        .toUpperCase();
      const prefixo = cleanCliente.slice(0, 3).padEnd(3, 'X');

      const dataProjeto = projetoCriadoEm ? new Date(projetoCriadoEm) : new Date();
      const ano = String(dataProjeto.getFullYear()).slice(-2);
      const mes = String(dataProjeto.getMonth() + 1).padStart(2, '0');

      const letraRodada = String.fromCharCode(65 + ((cotacaoVersao || 1) - 1));
      const nomeArquivo = `Proposta_${prefixo}${ano}${mes}-${letraRodada}.xlsx`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Proposta comercial gerada com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar proposta comercial:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar proposta.');
    } finally {
      setGerandoProposta(false);
    }
  };

  const handleUploadPlanilhaPrazo = (itemTempId: string, prazo: number, file: File) => {
    setItens(prev => prev.map(i => {
      if (i.tempId === itemTempId) {
        const planilhasNovas = { ...i.planilhasNovas, [prazo]: file };
        return { ...i, planilhasNovas };
      }
      return i;
    }));
    setAutoSaveTrigger(prev => prev + 1);
  };

  const handleRemoverPlanilhaPrazo = (itemTempId: string, prazo: number) => {
    setItens(prev => prev.map(i => {
      if (i.tempId === itemTempId) {
        // Remover das novas se houver
        const planilhasNovas = { ...i.planilhasNovas };
        delete planilhasNovas[prazo];

        // Remover das salvas se houver
        const planilhasSalvas = { ...i.planilhasSalvas };
        delete planilhasSalvas[prazo];

        return { ...i, planilhasNovas, planilhasSalvas };
      }
      return i;
    }));
    setAutoSaveTrigger(prev => prev + 1);
  };

  const handleAbrirCalculo = (item: ItemLocal) => {
    setItemCalculoAtivo(item);
    setCalculoModalOpen(true);
  };

  // ── Anexos ──────────────────────────────────────────────────────────────────
  const handleRemoveAnexoSalvo = (anexo: AnexoSalvo) => {
    setAnexosSalvos(prev => prev.filter(a => a.id !== anexo.id));
    setAnexosDeletarIds(prev => [...prev, anexo]);
  };

  const [autoSaveTrigger, setAutoSaveTrigger] = useState(0);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  useEffect(() => {
    if (autoSaveTrigger > 0) {
      handleSubmit(undefined, true);
    }
  }, [autoSaveTrigger]);

  // ── Salvar Formulário ────────────────────────────────────────────────────────
  const handleSubmit = async (e?: React.FormEvent, silencioso = false) => {
    if (e) e.preventDefault();

    if (!formCNPJ.trim() || !formRazaoSocial.trim()) {
      if (!silencioso) {
        toast.error('Campos obrigatórios', 'Por favor, preencha o CNPJ e a Razão Social.');
      }
      return;
    }

    if (prazos.length === 0) {
      if (!silencioso) {
        toast.error('Prazo de locação', 'Por favor, escolha ao menos um prazo de locação.');
      }
      return;
    }

    if (detalhamentoAtivo) {
      if (itens.length === 0) {
        if (!silencioso) {
          toast.error('Itens da cotação', 'Você ativou a seção de itens, por isso precisa adicionar pelo menos um item.');
        }
        return;
      }
    }

    if (silencioso) {
      setIsAutoSaving(true);
    } else {
      setSaving(true);
    }
    try {
      let currentClienteId = clienteId;

      if (!currentClienteId) {
        const { data: newClient, error: clientErr } = await supabase
          .from('clientes')
          .insert({ cnpj: formCNPJ, razao_social: formRazaoSocial, vendedor_id: vendedor?.value || null })
          .select('id')
          .single();
        if (clientErr || !newClient) throw new Error(`Erro ao cadastrar cliente: ${clientErr?.message}`);
        currentClienteId = newClient.id;
      }

      const cotacaoPayload = {
        cliente_id: currentClienteId,
        vendedor_id: vendedor?.value || null,
        cnpj: formCNPJ,
        razao_social: formRazaoSocial,
        prazos,
        estimativa_rodagem_km: parseFloat(estimativaRodagem) || 0,
        tipo_placa: tipoPlaca?.value as 'Comum' | 'ANTT',
        descricao: descricao || null,
        detalhamento_ativo: detalhamentoAtivo,
        status: status?.value as 'Em avalição' | 'Em orçamento' | 'Completo',
        criado_por: user?.id || null,
        // ── Taxas & Despesas globais da cotação ──
        comissao_venda_percentual: cotComissao !== '' ? parseFloat(cotComissao) : null,
        imposto_venda_ir_percentual: cotIr !== '' ? parseFloat(cotIr) / 100 : null,
        imposto_venda_adicional_ir_percentual: cotAdicionalIr !== '' ? parseFloat(cotAdicionalIr) / 100 : null,
        imposto_venda_csll_percentual: cotCsll !== '' ? parseFloat(cotCsll) / 100 : null,
        depreciacao_contabil_percentual: cotDepreciacaoContabil !== '' ? parseFloat(cotDepreciacaoContabil) / 100 : null,
        documentacao_valor: cotDocumentacao !== '' ? parseFloat(cotDocumentacao) : null,
        ipva_desconto_vista_percentual: cotIpvaDesconto !== '' ? parseFloat(cotIpvaDesconto) / 100 : null,
        ipva_depreciacao_percentual: cotIpvaDepreciacao !== '' ? parseFloat(cotIpvaDepreciacao) / 100 : null,
        reajuste_aluguel_anual_percentual: cotReajusteAluguel !== '' ? parseFloat(cotReajusteAluguel) / 100 : null,
        tma_anual_percentual: cotTmaAnual !== '' ? parseFloat(cotTmaAnual) / 100 : null,
        meses_antes_aluguel: cotMesesAntesAluguel !== '' ? parseInt(cotMesesAntesAluguel, 10) : null,
        meses_depois_aluguel: cotMesesDepoisAluguel !== '' ? parseInt(cotMesesDepoisAluguel, 10) : null,
      };

      let activeCotacaoId = id;

      if (isEditMode && id) {
        const { error: updErr } = await supabase.from('cotacoes').update(cotacaoPayload).eq('id', id);
        if (updErr) throw updErr;
      } else {
        const { data: newCot, error: insErr } = await supabase.from('cotacoes').insert(cotacaoPayload).select('id').single();
        if (insErr || !newCot) throw insErr || new Error('Não foi possível registrar a nova cotação.');
        activeCotacaoId = newCot.id;
      }

      const safeCotacaoId = activeCotacaoId as string;

      // Gravar itens
      if (detalhamentoAtivo) {
        await supabase.from('cotacao_itens').delete().eq('cotacao_id', safeCotacaoId);

        const itensPayload = itens.map(item => ({
          cotacao_id: safeCotacaoId,
          quantidade: item.quantidade,
          descricao: item.descricao,
          implementos: item.implementos,
          caminhao_id: item.caminhao?.caminhao_id || null,
          caminhao_entre_eixo: item.caminhao?.caminhao_entre_eixo || null,
          caminhao_tipo_uso: item.caminhao_tipo_uso || null,
          caminhao_valor: item.caminhao_valor !== undefined ? item.caminhao_valor : null,
          implemento_tipo_uso: item.implemento_tipo_uso || null,
          implemento_valor: item.implemento_valor !== undefined ? item.implemento_valor : null,

          // IDs de depreciação
          caminhao_depreciacao_id: item.caminhao_depreciacao_id || null,
          implemento_depreciacao_id: item.implemento_depreciacao_id || null,
        }));

        const { data: insertedItens, error: insItensErr } = await supabase
          .from('cotacao_itens')
          .insert(itensPayload)
          .select('*');

        if (insItensErr) throw insItensErr;

        // Gravar valores calculados por prazo (Goal Seek em lote)
        if (insertedItens && insertedItens.length > 0) {
          // Obter os prazos ativos selecionados na cotação
          const prazosAtivos = [...prazos].sort((a, b) => a - b);
          
          if (prazosAtivos.length > 0) {
            const valoresPayload = [];

            for (let index = 0; index < insertedItens.length; index++) {
              const dbItem = insertedItens[index];
              const localItem = itens[index]; // correspondência por índice

              for (const prazo of prazosAtivos) {
                // Se já estiver calculado e salvo no estado local (memória), mantém ele!
                const valorSalvo = localItem.valoresCalculados?.[prazo];
                
                let precoAluguel = 0;
                let vplVal = 0;
                let tirVal = 0;

                if (valorSalvo && valorSalvo.preco_aluguel > 0) {
                  precoAluguel = valorSalvo.preco_aluguel;
                  vplVal = valorSalvo.vpl;
                  tirVal = valorSalvo.tir;
                }

                let planilhaUrl = null;
                let planilhaNome = null;
                let planilhaPath = null;

                if (localItem.planilhasNovas && localItem.planilhasNovas[prazo]) {
                  const file = localItem.planilhasNovas[prazo];
                  const path = `cotacoes/${safeCotacaoId}/itens/${dbItem.id}/${prazo}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                  const { error: uploadErr } = await supabase.storage.from('cotacoes-anexos').upload(path, file);

                  if (!uploadErr) {
                    const { data: { publicUrl } } = supabase.storage.from('cotacoes-anexos').getPublicUrl(path);
                    planilhaUrl = publicUrl;
                    planilhaNome = file.name;
                    planilhaPath = path;
                  } else {
                    console.error('Erro de upload da planilha:', uploadErr);
                  }
                } else if (localItem.planilhasSalvas && localItem.planilhasSalvas[prazo]) {
                  const salva = localItem.planilhasSalvas[prazo];
                  planilhaUrl = salva.url;
                  planilhaNome = salva.nome;
                  planilhaPath = salva.path;
                }

                valoresPayload.push({
                  cotacao_item_id: dbItem.id,
                  prazo,
                  preco_aluguel: precoAluguel,
                  vpl: vplVal,
                  tir: tirVal,
                  planilha_url: planilhaUrl,
                  planilha_nome: planilhaNome,
                  planilha_path: planilhaPath,
                  calculado_em: new Date().toISOString(),
                });
              }
            }

            // Gravar tudo na nova tabela cotacao_item_valores
            if (valoresPayload.length > 0) {
              const itemIdsParaLimpar = insertedItens.map((i: any) => i.id);
              await supabase
                .from('cotacao_item_valores')
                .delete()
                .in('cotacao_item_id', itemIdsParaLimpar);

              const { error: insValoresErr } = await supabase
                .from('cotacao_item_valores')
                .insert(valoresPayload);

              if (insValoresErr) {
                console.error('Erro ao gravar valores calculados por prazo:', insValoresErr);
                throw insValoresErr;
              }
            }
          }
        }
      } else {
        await supabase.from('cotacao_itens').delete().eq('cotacao_id', safeCotacaoId);
      }

      // Upload de novos anexos
      if (novosArquivos.length > 0) {
        for (const file of novosArquivos) {
          const path = `cotacoes/${safeCotacaoId}/${Date.now()}_${file.name}`;
          const { error: uploadErr } = await supabase.storage.from('cotacoes-anexos').upload(path, file);
          if (uploadErr) {
            toast.warning('Aviso de upload', `Não foi possível enviar o anexo ${file.name}.`);
            continue;
          }
          const { data: { publicUrl } } = supabase.storage.from('cotacoes-anexos').getPublicUrl(path);
          await supabase.from('cotacao_anexos').insert({
            cotacao_id: safeCotacaoId,
            criado_por: user?.id || null,
            arquivo_nome: file.name,
            arquivo_url: publicUrl,
            arquivo_path: path,
            mime_type: file.type || 'application/octet-stream',
            tamanho_bytes: file.size,
          });
        }
      }

      // Excluir anexos removidos
      if (anexosDeletarIds.length > 0) {
        for (const anexo of anexosDeletarIds) {
          await supabase.from('cotacao_anexos').delete().eq('id', anexo.id);
          await supabase.storage.from('cotacoes-anexos').remove([anexo.arquivo_path]);
        }
      }

      if (silencioso) {
        if (safeCotacaoId) {
          const { data: updatedIts } = await supabase
            .from('cotacao_itens')
            .select('*, caminhao:caminhoes(id, modelo, familia)')
            .eq('cotacao_id', safeCotacaoId)
            .order('criado_em');
          
          if (updatedIts) {
            const { data: updatedVals } = await supabase
              .from('cotacao_item_valores')
              .select('*')
              .in('cotacao_item_id', updatedIts.map((i: any) => i.id));
            
            setItens(prev => {
              return prev.map((localItem, idx) => {
                const dbItem = updatedIts[idx];
                if (!dbItem) return localItem;
                
                const itemValores = (updatedVals || []).filter((v: any) => v.cotacao_item_id === dbItem.id);
                const planilhasSalvas: { [prazo: number]: any } = {};
                const valoresCalculados: { [prazo: number]: any } = {};
                itemValores.forEach((v: any) => {
                  if (v.planilha_url) {
                    planilhasSalvas[v.prazo] = {
                      url: v.planilha_url,
                      nome: v.planilha_nome,
                      path: v.planilha_path,
                      calculado_em: v.calculado_em,
                    };
                  }
                  valoresCalculados[v.prazo] = {
                    preco_aluguel: Number(v.preco_aluguel) || 0,
                    vpl: Number(v.vpl) || 0,
                    tir: Number(v.tir) || 0,
                  };
                });
                
                return {
                  ...localItem,
                  id: dbItem.id,
                  planilhasSalvas,
                  valoresCalculados,
                  planilhasNovas: {},
                };
              });
            });
          }
        }
        
        toast.success('Alterações salvas', undefined, { duration: 1500 });
      } else {
        toast.success(
          isEditMode ? 'Cotação atualizada' : 'Cotação criada',
          `A cotação para ${formRazaoSocial} foi salva com sucesso!`
        );
        navigate(projetoId ? `/painel/projetos/${projetoId}` : '/painel/projetos');
      }
    } catch (err: any) {
      console.error('Erro no autosave/salvamento:', err);
      if (!silencioso) {
        toast.error('Erro ao salvar cotação', err.message || 'Ocorreu um erro ao persistir os dados.');
      }
    } finally {
      setSaving(false);
      setIsAutoSaving(false);
    }
  };

  // ── Renderizar badges de implementos ─────────────────────────────────────────
  const renderImplementoBadges = (implementos: ImplementoEscolha[]) => {
    if (!implementos || implementos.length === 0) return null;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
        {implementos.map((impl, i) => {
          const attrs = impl.atributos.map(a => a.atributo_nome).filter(Boolean).join(', ');
          return (
            <span key={i} style={{
              display: 'inline-block', fontSize: '11px', fontWeight: 500,
              padding: '2px 8px', borderRadius: '4px',
              backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0',
              color: 'var(--color-grey-700)',
            }}>
              {impl.categoria_nome}{attrs ? ` (${attrs})` : ''}
            </span>
          );
        })}
      </div>
    );
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loadingData) {
    return (
      <DashboardLayout pageTitle="Carregando..." pageSubtitle="Buscando informações da cotação.">
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-grey-450)' }}>
          Carregando dados da cotação...
        </div>
      </DashboardLayout>
    );
  }

  // ── Item em edição ativo ─────────────────────────────────────────────────────
  const itemAtivoObj = itens.find(i => i.tempId === itemAtivo) || null;

  return (
    <DashboardLayout
      pageTitle={isEditMode ? 'Editar cotação' : 'Nova cotação'}
      pageSubtitle={isEditMode ? 'Modifique os parâmetros desta cotação.' : 'Forneça os detalhes para criar uma cotação.'}
    >
      <form onSubmit={handleSubmit} className="cotacao-form-container">
        {isReadOnly && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)',
            padding: '12px 16px', marginBottom: '20px', color: '#b45309', fontSize: '13px', fontWeight: 500
          }}>
            <Warning size={20} weight="fill" style={{ flexShrink: 0 }} />
            <div>
              Você está visualizando a <strong>Rodada v{cotacaoVersao} (Histórico Desativado)</strong> deste projeto.
              <br />
              <span style={{ fontSize: '11.5px', fontWeight: 400, color: '#d97706' }}>Esta versão é mantida apenas para auditoria de preços cobrados no passado. Alterações e novos cálculos estão bloqueados.</span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button type="button" variant="secondary" onClick={() => navigate(projetoId ? `/painel/projetos/${projetoId}` : '/painel/projetos')}>
            <ArrowLeft size={18} style={{ marginRight: '6px' }} />
            Cancelar
          </Button>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Indicador de Autosave */}
            <style>{`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: .3; }
              }
              .auto-save-pulse {
                animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
              }
            `}</style>
            {!isReadOnly && (
              isAutoSaving ? (
                <span style={{ fontSize: '12px', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                  <span className="auto-save-pulse" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-primary)' }}></span>
                  Salvando...
                </span>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--color-grey-450)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}>
                  ✓ Salvo no banco
                </span>
              )
            )}

            {isEditMode && (
              <div style={{ width: '160px' }}>
                <Select
                  options={[
                    { value: 'Em avaliação', label: 'Em avaliação' },
                    { value: 'Em orçamento', label: 'Em orçamento' },
                    { value: 'Completo', label: 'Completo' }
                  ]}
                  value={status}
                  onChange={(opt) => {
                    setStatus(opt as OptionType | null);
                    setAutoSaveTrigger(prev => prev + 1);
                  }}
                  placeholder="Status"
                  disabled={isReadOnly}
                />
              </div>
            )}
            {isEditMode && (
              <Button
                type="button"
                variant="outline"
                loading={gerandoProposta}
                onClick={handleGerarPropostaExcel}
                style={{
                  borderColor: 'var(--color-primary)',
                  color: 'var(--color-primary)',
                  backgroundColor: 'transparent',
                }}
              >
                <FileArrowDown size={18} style={{ marginRight: '6px' }} />
                Gerar Proposta
              </Button>
            )}
            <Button type="submit" variant="primary" loading={saving} disabled={isReadOnly}>
              <FloppyDisk size={18} style={{ marginRight: '6px' }} />
              Salvar Cotação
            </Button>
          </div>
        </div>

        {/* ─── Abas da Cotação ─── */}
        <div style={{
          display: 'flex', borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc', padding: '0 0', gap: '0',
          marginBottom: '24px', borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
          border: '1px solid #e2e8f0', overflow: 'hidden',
        }}>
          {([
            { id: 'dados', label: 'Dados Gerais', icon: '📋' },
            { id: 'itens', label: 'Itens da Cotação', icon: '🚚' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCotacaoTab(tab.id)}
              style={{
                flex: 1,
                padding: '14px 24px',
                border: 'none',
                borderBottom: cotacaoTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                background: cotacaoTab === tab.id ? '#fff' : 'transparent',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                color: cotacaoTab === tab.id ? 'var(--color-primary)' : 'var(--color-grey-500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s',
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 1. SEÇÃO CLIENTE */}
        {cotacaoTab === 'dados' && (
        <>

        {/* 2. DETALHES DA LOCAÇÃO */}
        <div className="cotacao-card">
          <h3 className="cotacao-card-title">
            <List size={20} />
            Parâmetros da Locação
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <MultiSelect
                label="Prazos de Locação (Meses)"
                options={PRAZO_OPTIONS}
                value={prazos.map(String)}
                onChange={(vals) => {
                  setPrazos(vals.map(Number));
                  setAutoSaveTrigger(prev => prev + 1);
                }}
                placeholder="Selecione os prazos..."
                required
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Input
                label="Estimativa de Rodagem (km/mês)"
                type="number"
                placeholder="5000"
                value={estimativaRodagem}
                onChange={(e) => setEstimativaRodagem(e.target.value)}
                onBlur={() => setAutoSaveTrigger(prev => prev + 1)}
                required
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Select
                label="Tipo de Placa"
                options={[
                  { value: 'Comum', label: 'Comum' },
                  { value: 'ANTT', label: 'ANTT' }
                ]}
                value={tipoPlaca}
                onChange={(opt) => {
                  setTipoPlaca(opt as OptionType | null);
                  setAutoSaveTrigger(prev => prev + 1);
                }}
                placeholder="Selecione..."
                disabled={isReadOnly}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
            <div>
              <Textarea
                label="Observações da Cotação"
                placeholder="Descreva detalhes ou observações de locação..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                onBlur={() => setAutoSaveTrigger(prev => prev + 1)}
                rows={3}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <Select
                label="Vendedor Responsável"
                options={vendedorOptions}
                value={vendedor}
                onChange={(opt) => {
                  setVendedor(opt as OptionType | null);
                  setAutoSaveTrigger(prev => prev + 1);
                }}
                placeholder="Escolha o vendedor..."
                disabled={isReadOnly}
              />
            </div>
          </div>
        </div>

        {/* 3. TAXAS & DESPESAS DA COTAÇÃO */}
        <div className="cotacao-card">
          <h3 className="cotacao-card-title">
            <span style={{ fontSize: '18px' }}>🏦</span>
            Taxas &amp; Despesas
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--color-grey-500)', marginBottom: '20px', marginTop: '-4px' }}>
            Parâmetros financeiros globais desta cotação. Pré-preenchidos com as configurações globais do sistema.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* Card Taxas e Impostos */}
            <div style={{
              padding: '20px', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)',
              backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '16px'
            }}>
              <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--color-grey-900)' }}>
                  Taxas e Impostos
                </h4>
                <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--color-grey-400)' }}>
                  Encargos aplicados na venda pós-locação.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { label: 'Comissão (%)', value: cotComissao, set: setCotComissao, hint: '5.8' },
                  { label: 'IR (%)', value: cotIr, set: setCotIr, hint: '15' },
                  { label: 'Adicional IR (%)', value: cotAdicionalIr, set: setCotAdicionalIr, hint: '10' },
                  { label: 'CSLL (%)', value: cotCsll, set: setCotCsll, hint: '9' },
                  { label: 'Dep. Contábil Ativo Imob. (% a.a.)', value: cotDepreciacaoContabil, set: setCotDepreciacaoContabil, hint: '20' },
                ].map(({ label, value, set, hint }) => (
                  <div key={label}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-grey-600)', marginBottom: '4px' }}>
                      {label}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={value}
                      onChange={e => set(e.target.value)}
                      placeholder={hint}
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)',
                        border: '1px solid #e2e8f0', fontSize: '13px', color: 'var(--color-grey-800)',
                        backgroundColor: '#fff', outline: 'none', boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
                      onBlur={e => {
                        e.target.style.borderColor = '#e2e8f0';
                        setAutoSaveTrigger(prev => prev + 1);
                      }}
                      disabled={isReadOnly}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Card Despesas Operacionais */}
            <div style={{
              padding: '20px', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)',
              backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '16px'
            }}>
              <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'var(--color-grey-900)' }}>
                  Despesas Operacionais
                </h4>
                <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'var(--color-grey-400)' }}>
                  Custos operacionais e licenciamento de veículos.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { label: 'Documentação (R$)', value: cotDocumentacao, set: setCotDocumentacao, hint: '1000' },
                  { label: 'IPVA desconto à vista (%)', value: cotIpvaDesconto, set: setCotIpvaDesconto, hint: '3' },
                  { label: 'IPVA depreciação (%)', value: cotIpvaDepreciacao, set: setCotIpvaDepreciacao, hint: '15' },
                  { label: 'Reajuste anual aluguel (%)', value: cotReajusteAluguel, set: setCotReajusteAluguel, hint: '4' },
                  { label: 'TMA Anual (%)', value: cotTmaAnual, set: setCotTmaAnual, hint: '30' },
                  { label: 'Meses antes (Preparação)', value: cotMesesAntesAluguel, set: setCotMesesAntesAluguel, hint: '1' },
                  { label: 'Meses depois (Venda)', value: cotMesesDepoisAluguel, set: setCotMesesDepoisAluguel, hint: '3' },
                ].map(({ label, value, set, hint }) => (
                  <div key={label}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--color-grey-600)', marginBottom: '4px' }}>
                      {label}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={value}
                      onChange={e => set(e.target.value)}
                      placeholder={hint}
                      style={{
                        width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)',
                        border: '1px solid #e2e8f0', fontSize: '13px', color: 'var(--color-grey-800)',
                        backgroundColor: '#fff', outline: 'none', boxSizing: 'border-box',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={e => (e.target.style.borderColor = 'var(--color-primary)')}
                      onBlur={e => {
                        e.target.style.borderColor = '#e2e8f0';
                        setAutoSaveTrigger(prev => prev + 1);
                      }}
                      disabled={isReadOnly}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        </>
        )}

        {/* 4. ITENS DA COTAÇÃO */}
        {cotacaoTab === 'itens' && (
        <>
        <div className="cotacao-card">
          {/* Toggle de detalhamento */}
          <div className="detalhamento-toggle-row" style={{ marginBottom: detalhamentoAtivo ? '20px' : '0' }}>
            <div className="detalhamento-toggle-info">
              <h4>Detalhamento dos Itens da Locação</h4>
              <p>Ative caso queira especificar os modelos de caminhões e categorias de implementos.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <label
                htmlFor="detalhamento-checkbox"
                style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  id="detalhamento-checkbox"
                  checked={detalhamentoAtivo}
                  onChange={(e) => {
                    setDetalhamentoAtivo(e.target.checked);
                  }}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                  disabled={isReadOnly}
                />
                <span style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: detalhamentoAtivo ? 'var(--color-primary)' : 'var(--color-grey-300)',
                  borderRadius: '24px', transition: 'background-color 0.2s',
                }} />
                <span style={{
                  position: 'absolute', top: '2px',
                  left: detalhamentoAtivo ? '22px' : '2px',
                  width: '20px', height: '20px',
                  borderRadius: '50%', backgroundColor: '#ffffff',
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }} />
              </label>
            </div>
          </div>

          {detalhamentoAtivo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Cabeçalho de itens */}
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                <div style={{
                  padding: '6px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-sm)', color: 'var(--color-grey-500)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <List size={20} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <h4 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-grey-900)' }}>
                    Itens da cotação
                  </h4>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-grey-500)' }}>
                    Adicione os itens da cotação informados pelo vendedor e associe aos implementos necessários.
                  </p>
                </div>
              </div>

              {/* Input de inclusão rápida */}
              {!isReadOnly && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', backgroundColor: '#f8fafc', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                  <div style={{ width: '90px' }}>
                    <Input
                      label="Qtd"
                      type="number"
                      placeholder="1"
                      value={novaQtd}
                      onChange={(e) => setNovaQtd(parseInt(e.target.value) || 1)}
                      min={1}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Input
                      label="Descrição"
                      type="text"
                      placeholder="Descreva o item da cotação..."
                      value={novaDescricao}
                      onChange={(e) => setNovaDescricao(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdicionarItem(); } }}
                    />
                  </div>
                  <div style={{ paddingBottom: '1px' }}>
                    <button
                      type="button"
                      onClick={handleAdicionarItem}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'none', border: 'none', color: 'var(--color-primary)',
                        cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)',
                        padding: '10px 4px', outline: 'none', whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{
                        width: '16px', height: '16px', border: '1.5px solid var(--color-primary)',
                        borderRadius: '3px', display: 'inline-block', flexShrink: 0,
                      }} />
                      Adicionar item
                    </button>
                  </div>
                </div>
              )}

              {/* Tabela de itens */}
              {itens.length > 0 && (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f8fafc' }}>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ textAlign: 'center', padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--color-grey-600)', width: '60px' }}>Qtde</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--color-grey-600)' }}>Item cotação</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)', width: '220px' }}>Implemento</th>
                        <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--color-grey-600)', width: '200px' }}>Caminhão</th>
                        <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--color-grey-600)', width: '100px' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((item, idx) => (
                        <React.Fragment key={item.tempId}>
                          <tr style={{ borderBottom: prazos.length > 0 ? 'none' : (idx < itens.length - 1 ? '1px solid #f1f5f9' : 'none') }}>
                            {/* Qtde */}
                            <td style={{ textAlign: 'center', padding: '12px', fontSize: '14px', fontWeight: 600, color: 'var(--color-grey-800)' }}>
                              {item.quantidade}
                            </td>

                            {/* Descrição */}
                            <td style={{ padding: '12px' }}>
                              {item.editandoDescricao ? (
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  <input
                                    type="text"
                                    value={item.descricaoEditTemp || ''}
                                    onChange={e => setItens(prev => prev.map(i =>
                                      i.tempId === item.tempId ? { ...i, descricaoEditTemp: e.target.value } : i
                                    ))}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSalvarDescricao(item.tempId); if (e.key === 'Escape') handleCancelarEdicaoDescricao(item.tempId); }}
                                    autoFocus
                                    style={{
                                      flex: 1, padding: '6px 10px', border: '1px solid var(--color-primary)',
                                      borderRadius: 'var(--radius-sm)', fontSize: '13px', outline: 'none',
                                    }}
                                  />
                                  <button type="button" onClick={() => handleSalvarDescricao(item.tempId)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: '4px' }}>
                                    <Check size={16} />
                                  </button>
                                  <button type="button" onClick={() => handleCancelarEdicaoDescricao(item.tempId)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-grey-500)', padding: '4px' }}>
                                    <X size={16} />
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  {!isReadOnly && (
                                    <button type="button" onClick={() => handleIniciarEdicaoDescricao(item.tempId)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-grey-400)', padding: '0 6px 0 0', verticalAlign: 'middle' }}>
                                      <Pencil size={14} />
                                    </button>
                                  )}
                                  <span style={{ fontSize: '13px', color: 'var(--color-grey-800)' }}>{item.descricao}</span>
                                </div>
                              )}
                            </td>

                            {/* Implemento */}
                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleAbrirImplemento(item.tempId)}
                                    title="Definir implementos"
                                    disabled={isReadOnly}
                                    style={{
                                      padding: '5px', border: '1px solid #e2e8f0',
                                      borderRadius: 'var(--radius-sm)', backgroundColor: isReadOnly ? '#f1f5f9' : '#fff',
                                      cursor: isReadOnly ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
                                      color: item.implementos?.length > 0 ? 'var(--color-primary)' : 'var(--color-grey-500)',
                                    }}
                                  >
                                    <Wrench size={15} />
                                  </button>
                                </div>
                                {renderImplementoBadges(item.implementos)}
                              </div>
                            </td>

                            {/* Caminhão */}
                            <td style={{ padding: '12px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => handleAbrirCaminhao(item.tempId)}
                                    title="Definir caminhão"
                                    disabled={isReadOnly}
                                    style={{
                                      padding: '5px', border: '1px solid #e2e8f0',
                                      borderRadius: 'var(--radius-sm)', backgroundColor: isReadOnly ? '#f1f5f9' : '#fff',
                                      cursor: isReadOnly ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
                                      color: item.caminhao ? 'var(--color-primary)' : 'var(--color-grey-500)',
                                    }}
                                  >
                                    <Truck size={15} />
                                  </button>
                                </div>
                                {item.caminhao && (
                                  <span style={{
                                    display: 'inline-block', fontSize: '11px', fontWeight: 500,
                                    padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap',
                                    backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)',
                                    color: 'var(--color-primary)',
                                  }}>
                                    {item.caminhao.caminhao_familia
                                      ? `${item.caminhao.caminhao_familia} - ${item.caminhao.caminhao_modelo}`
                                      : item.caminhao.caminhao_modelo || item.caminhao.caminhao_id}
                                    {item.caminhao.caminhao_entre_eixo ? ` (entre-eixo: ${item.caminhao.caminhao_entre_eixo})` : ''}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Ações */}
                            <td style={{ padding: '12px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!item.caminhao && (!item.implementos || item.implementos.length === 0)) {
                                      toast.warning('Seleções ausentes', 'Por favor, defina ao menos um caminhão ou um implemento para visualizar os cálculos.');
                                      return;
                                    }
                                    handleAbrirCalculo(item);
                                  }}
                                  title="Planilha de Cálculos (Dados, Cash Flow, Financiamento)"
                                  className="action-btn action-btn-edit"
                                  style={{
                                    color: (item.caminhao || (item.implementos && item.implementos.length > 0)) ? 'var(--color-primary)' : 'var(--color-grey-300)',
                                    cursor: (item.caminhao || (item.implementos && item.implementos.length > 0)) ? 'pointer' : 'not-allowed',
                                    opacity: (item.caminhao || (item.implementos && item.implementos.length > 0)) ? 1 : 0.5,
                                  }}
                                >
                                  <Calculator size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicarItem(item.tempId)}
                                  title="Duplicar item"
                                  className="action-btn"
                                >
                                  <Copy size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoverItem(item.tempId)}
                                  title="Excluir item"
                                  className="action-btn action-btn-delete"
                                >
                                  <Trash size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Linha de Planilhas de Validação do Diretor por Prazo */}
                          {prazos.length > 0 && (
                            <tr style={{ backgroundColor: '#fafafb', borderBottom: idx < itens.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                              <td />
                              <td colSpan={4} style={{ padding: '8px 12px 14px 12px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '3px solid var(--color-primary)', paddingLeft: '12px' }}>
                                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-grey-500)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    📁 Planilhas de Validação da Diretoria (por prazo)
                                  </div>
                                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {[...prazos].sort((a, b) => a - b).map(prazo => {

                                      const nova = item.planilhasNovas?.[prazo];
                                      const salva = item.planilhasSalvas?.[prazo];
                                      const valorCalculado = item.valoresCalculados?.[prazo];

                                      return (
                                        <div key={prazo} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#fff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-primary)', backgroundColor: 'rgba(249,115,22,0.08)', padding: '2px 6px', borderRadius: '4px' }}>
                                            {prazo}m
                                          </span>
                                          
                                          {valorCalculado && valorCalculado.preco_aluguel > 0 ? (
                                            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-grey-800)', borderRight: '1px solid #f1f5f9', paddingRight: '8px', display: 'inline-flex', alignItems: 'center' }} title={`VPL: ${valorCalculado.vpl.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | TIR: ${(valorCalculado.tir * 100).toFixed(4)}%`}>
                                              {valorCalculado.preco_aluguel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </span>
                                          ) : (
                                            <span style={{ fontSize: '10px', color: 'var(--color-grey-400)', borderRight: '1px solid #f1f5f9', paddingRight: '8px', fontStyle: 'italic' }}>
                                              Não calculado
                                            </span>
                                          )}
                                          
                                          {nova ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <span style={{ fontSize: '12px', color: 'var(--color-grey-800)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={nova.name}>
                                                {nova.name}
                                              </span>
                                              <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>(Anexado)</span>
                                              <button
                                                type="button"
                                                onClick={() => setConfirmacaoExclusao({
                                                  itemTempId: item.tempId,
                                                  prazo,
                                                  nomePlanilha: nova.name
                                                })}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', padding: '2px' }}
                                                title="Remover anexo"
                                              >
                                                <X size={14} />
                                              </button>
                                            </div>
                                          ) : salva ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                              <span style={{ fontSize: '12px', color: 'var(--color-grey-800)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={salva.nome}>
                                                📎 {salva.nome}
                                              </span>
                                              <a
                                                href={`${salva.url}?download=`}
                                                download={salva.nome}
                                                style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                  width: '24px',
                                                  height: '24px',
                                                  borderRadius: '50%',
                                                  backgroundColor: 'rgba(249,115,22,0.08)',
                                                  color: 'var(--color-primary)',
                                                  border: '1px solid rgba(249,115,22,0.2)',
                                                  cursor: 'pointer',
                                                  transition: 'all 0.15s',
                                                }}
                                                title="Baixar planilha"
                                                onMouseEnter={e => {
                                                  e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                                                  e.currentTarget.style.color = '#fff';
                                                }}
                                                onMouseLeave={e => {
                                                  e.currentTarget.style.backgroundColor = 'rgba(249,115,22,0.08)';
                                                  e.currentTarget.style.color = 'var(--color-primary)';
                                                }}
                                              >
                                                <DownloadSimple size={13} />
                                              </a>
                                              <span style={{ fontSize: '9px', color: 'var(--color-grey-400)' }}>
                                                ({salva.calculado_em ? new Date(salva.calculado_em).toLocaleDateString('pt-BR') : 'Salvo'})
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => setConfirmacaoExclusao({
                                                  itemTempId: item.tempId,
                                                  prazo,
                                                  nomePlanilha: salva.nome
                                                })}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', padding: '2px' }}
                                                title="Excluir planilha"
                                              >
                                                <Trash size={12} />
                                              </button>
                                            </div>
                                          ) : (
                                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: 'var(--color-grey-500)', cursor: 'pointer', margin: 0 }}>
                                              <FileArrowUp size={13} style={{ color: 'var(--color-grey-450)' }} />
                                              <span>Anexar planilha</span>
                                              <input
                                                type="file"
                                                accept=".xls,.xlsx"
                                                onChange={(e) => {
                                                  const file = e.target.files?.[0];
                                                  if (file) handleUploadPlanilhaPrazo(item.tempId, prazo, file);
                                                }}
                                                style={{ display: 'none' }}
                                              />
                                            </label>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ANEXOS */}
        <div className="cotacao-card">
          <h3 className="cotacao-card-title">
            <FileArrowUp size={20} />
            Anexos e Documentos da Cotação
          </h3>

          <FileUpload
            onUpload={(files) => setNovosArquivos(prev => [...prev, ...files])}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*"
            maxSize={5 * 1024 * 1024}
            maxFiles={5}
            label="Arraste arquivos da cotação (PDFs, planilhas ou imagens)"
          />

          {anexosSalvos.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <label className="input-label">Documentos já salvos:</label>
              <div className="anexos-list" style={{ marginTop: '8px' }}>
                {anexosSalvos.map((anexo) => (
                  <div key={anexo.id} className="anexo-item">
                    <div className="anexo-info">
                      <List size={16} style={{ color: 'var(--color-primary)' }} />
                      <a href={anexo.arquivo_url} target="_blank" rel="noopener noreferrer"
                        style={{ color: 'var(--color-grey-700)', textDecoration: 'none', fontWeight: 500 }}>
                        {anexo.arquivo_nome}
                      </a>
                      <span className="anexo-size">({formatBytes(anexo.tamanho_bytes)})</span>
                    </div>
                    <button
                      type="button"
                      className="btn-remover-anexo"
                      onClick={() => handleRemoveAnexoSalvo(anexo)}
                      title="Excluir anexo"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </>
        )}
      </form>

      {/* Modal de Implementos */}
      <ItemImplementoModal
        isOpen={implementoModalOpen}
        onClose={() => { setImplementoModalOpen(false); setItemAtivo(null); }}
        onSave={handleSalvarImplemento}
        itemDescricao={itemAtivoObj?.descricao || ''}
        implementosIniciais={itemAtivoObj?.implementos || []}
        tipoUsoInicial={itemAtivoObj?.implemento_tipo_uso || null}
        valorInicial={itemAtivoObj?.implemento_valor || null}
      />

      {/* Modal de Caminhão */}
      <ItemCaminhaoModal
        isOpen={caminhaoModalOpen}
        onClose={() => { setCaminhaoModalOpen(false); setItemAtivo(null); }}
        onSave={handleSalvarCaminhao}
        implementos={itemAtivoObj?.implementos || []}
        caminhaoInicial={itemAtivoObj?.caminhao || null}
        tipoUsoInicial={itemAtivoObj?.caminhao_tipo_uso || null}
        valorInicial={itemAtivoObj?.caminhao_valor || null}
      />

      {/* Modal de Planilha/Cálculos do Item */}
      <CalculoItemModal
        isOpen={calculoModalOpen}
        onClose={() => { setCalculoModalOpen(false); setItemCalculoAtivo(null); }}
        item={itemCalculoAtivo}
        prazosCotaque={prazos}
        taxasCotacao={{
          comissao_venda_percentual: cotComissao !== '' ? parseFloat(cotComissao) : undefined,
          imposto_venda_ir_percentual: cotIr !== '' ? parseFloat(cotIr) / 100 : undefined,
          imposto_venda_adicional_ir_percentual: cotAdicionalIr !== '' ? parseFloat(cotAdicionalIr) / 100 : undefined,
          imposto_venda_csll_percentual: cotCsll !== '' ? parseFloat(cotCsll) / 100 : undefined,
          depreciacao_contabil_percentual: cotDepreciacaoContabil !== '' ? parseFloat(cotDepreciacaoContabil) / 100 : undefined,
          documentacao_valor: cotDocumentacao !== '' ? parseFloat(cotDocumentacao) : undefined,
          ipva_desconto_vista_percentual: cotIpvaDesconto !== '' ? parseFloat(cotIpvaDesconto) / 100 : undefined,
          ipva_depreciacao_percentual: cotIpvaDepreciacao !== '' ? parseFloat(cotIpvaDepreciacao) / 100 : undefined,
          reajuste_aluguel_anual_percentual: cotReajusteAluguel !== '' ? parseFloat(cotReajusteAluguel) / 100 : undefined,
          tma_anual_percentual: cotTmaAnual !== '' ? parseFloat(cotTmaAnual) / 100 : undefined,
          meses_antes_aluguel: cotMesesAntesAluguel !== '' ? parseInt(cotMesesAntesAluguel, 10) : undefined,
          meses_depois_aluguel: cotMesesDepoisAluguel !== '' ? parseInt(cotMesesDepoisAluguel, 10) : undefined,
        }}
        onSave={handleSalvarCamposCalculo}
        projetoCriadoEm={projetoCriadoEm}
        clienteNome={formRazaoSocial}
        cotacaoVersao={cotacaoVersao}
      />

      {/* Modal de Confirmação de Exclusão da Planilha de Validação */}
      {confirmacaoExclusao && (
        <div className="modal-overlay" style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal" style={{ maxWidth: '440px', padding: '24px', textAlign: 'center', backgroundColor: '#fff', borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px', color: '#dc2626' }}>
              <Warning size={48} weight="fill" />
            </div>
            <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-grey-900)', margin: '0 0 8px 0' }}>
              Confirmar Exclusão de Planilha
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--color-grey-600)', margin: '0 0 24px 0', lineHeight: '1.4' }}>
              Você tem certeza que deseja remover a planilha de validação <strong>{confirmacaoExclusao.nomePlanilha}</strong> referente ao prazo de <strong>{confirmacaoExclusao.prazo} meses</strong>?
              <br />
              <span style={{ color: '#dc2626', fontWeight: 500, fontSize: '11px', marginTop: '6px', display: 'inline-block' }}>
                ⚠️ Esta exclusão será definitiva após você salvar o orçamento.
              </span>
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmacaoExclusao(null)}
                style={{ flex: 1 }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  handleRemoverPlanilhaPrazo(confirmacaoExclusao.itemTempId, confirmacaoExclusao.prazo);
                  setConfirmacaoExclusao(null);
                }}
                style={{ flex: 1, backgroundColor: '#dc2626', borderColor: '#dc2626', color: '#fff' }}
              >
                Confirmar Exclusão
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
