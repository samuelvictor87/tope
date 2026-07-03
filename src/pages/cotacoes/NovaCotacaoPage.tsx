// pages/cotacoes/NovaCotacaoPage.tsx — Form de Nova/Editar Cotação TOPE
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  FloppyDisk,
  Trash,
  Warning,
  CheckCircle,
  FileArrowUp,
  List,
  Wrench,
  Truck,
  Copy,
  Pencil,
  Check,
  X,
  Calculator,
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
  { value: '84', label: '84' }
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
  const [configLocacao, setConfigLocacao] = useState<any>(null);

  const [cotacaoTab, setCotacaoTab] = useState<'dados' | 'itens'>('dados');

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
  const [cotMesesAntesAluguel, setCotMesesAntesAluguel] = useState('');
  const [cotMesesDepoisAluguel, setCotMesesDepoisAluguel] = useState('');

  // ── Arquivos / Anexos ────────────────────────────────────────────────────────
  const [novosArquivos, setNovosArquivos] = useState<File[]>([]);
  const [anexosSalvos, setAnexosSalvos] = useState<AnexoSalvo[]>([]);
  const [anexosDeletarIds, setAnexosDeletarIds] = useState<AnexoSalvo[]>([]);

  // ── Loadings ─────────────────────────────────────────────────────────────────
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [saving, setSaving] = useState(false);

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
        const { data: activeConfig } = await supabase
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
          navigate('/painel/cotacoes');
          return;
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
            const mappedItens: ItemLocal[] = its.map((item: any) => ({
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
            }));
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
  };

  const handleRemoverItem = (tempId: string) => {
    setItens(prev => prev.filter(i => i.tempId !== tempId));
  };

  const handleDuplicarItem = (tempId: string) => {
    const item = itens.find(i => i.tempId === tempId);
    if (!item) return;
    setItens(prev => [...prev, { ...item, tempId: gerarTempId(), id: undefined }]);
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
  };

  const handleSalvarCamposCalculo = (updatedFields: Partial<ItemLocal>) => {
    if (!itemCalculoAtivo) return;
    setItens(prev => prev.map(i =>
      i.tempId === itemCalculoAtivo.tempId ? { ...i, ...updatedFields } : i
    ));
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

  // ── Salvar Formulário ────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formCNPJ.trim() || !formRazaoSocial.trim()) {
      toast.error('Campos obrigatórios', 'Por favor, preencha o CNPJ e a Razão Social.');
      return;
    }

    if (prazos.length === 0) {
      toast.error('Prazo de locação', 'Por favor, escolha ao menos um prazo de locação.');
      return;
    }

    if (detalhamentoAtivo) {
      if (itens.length === 0) {
        toast.error('Itens da cotação', 'Você ativou a seção de itens, por isso precisa adicionar pelo menos um item.');
        return;
      }
    }

    setSaving(true);
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

        const { error: insItensErr } = await supabase.from('cotacao_itens').insert(itensPayload);
        if (insItensErr) throw insItensErr;
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

      toast.success(
        isEditMode ? 'Cotação atualizada' : 'Cotação criada',
        `A cotação para ${formRazaoSocial} foi salva com sucesso!`
      );
      navigate('/painel/cotacoes');
    } catch (err: any) {
      toast.error('Erro ao salvar cotação', err.message || 'Ocorreu um erro ao persistir os dados.');
    } finally {
      setSaving(false);
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
        {/* Cabeçalho de Ações */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button type="button" variant="secondary" onClick={() => navigate('/painel/cotacoes')}>
            <ArrowLeft size={18} style={{ marginRight: '6px' }} />
            Cancelar
          </Button>
          <div style={{ display: 'flex', gap: '12px' }}>
            {isEditMode && (
              <div style={{ width: '160px' }}>
                <Select
                  options={[
                    { value: 'Em avaliação', label: 'Em avaliação' },
                    { value: 'Em orçamento', label: 'Em orçamento' },
                    { value: 'Completo', label: 'Completo' }
                  ]}
                  value={status}
                  onChange={(opt) => setStatus(opt as OptionType | null)}
                  placeholder="Status"
                />
              </div>
            )}
            <Button type="submit" variant="primary" loading={saving}>
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
        <div className="cotacao-card">
          <h3 className="cotacao-card-title">
            <CheckCircle size={20} />
            Identificação do Cliente
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
            <div>
              <Input
                label="CNPJ do Cliente"
                type="text"
                placeholder="00.000.000/0000-00"
                value={formCNPJ}
                onChange={handleCNPJChange}
                onBlur={handleCNPJBlur}
                disabled={buscandoCNPJ}
                required
              />
              {buscandoCNPJ && <span style={{ fontSize: '11px', color: 'var(--color-primary)' }}>Verificando CNPJ...</span>}
            </div>
            <div>
              <Input
                label="Razão Social"
                type="text"
                placeholder="Razão Social ou Nome do Cliente"
                value={formRazaoSocial}
                onChange={(e) => setFormRazaoSocial(e.target.value)}
                disabled={isClienteCadastrado}
                required
              />
              {isClienteCadastrado && (
                <div className="cnpj-status-success">
                  <CheckCircle size={14} weight="fill" />
                  Cliente já cadastrado no TOPE. Razão Social travada para segurança.
                </div>
              )}
              {!isClienteCadastrado && formCNPJ.replace(/\D/g, '').length === 14 && (
                <div className="cnpj-status-warning">
                  <Warning size={14} weight="fill" />
                  Cliente não cadastrado no TOPE. Será criado ao salvar.
                </div>
              )}
            </div>
          </div>
        </div>

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
                onChange={(vals) => setPrazos(vals.map(Number))}
                placeholder="Selecione os prazos..."
                required
              />
            </div>
            <div>
              <Input
                label="Estimativa de Rodagem (km/mês)"
                type="number"
                placeholder="5000"
                value={estimativaRodagem}
                onChange={(e) => setEstimativaRodagem(e.target.value)}
                required
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
                onChange={(opt) => setTipoPlaca(opt as OptionType | null)}
                placeholder="Selecione..."
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
                rows={3}
              />
            </div>
            <div>
              <Select
                label="Vendedor Responsável"
                options={vendedorOptions}
                value={vendedor}
                onChange={(opt) => setVendedor(opt as OptionType | null)}
                placeholder="Escolha o vendedor..."
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
                      onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
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
                      onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
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
                        <tr key={item.tempId} style={{ borderBottom: idx < itens.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
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
                                <button type="button" onClick={() => handleIniciarEdicaoDescricao(item.tempId)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-grey-400)', padding: '0 6px 0 0', verticalAlign: 'middle' }}>
                                  <Pencil size={14} />
                                </button>
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
                                  style={{
                                    padding: '5px', border: '1px solid #e2e8f0',
                                    borderRadius: 'var(--radius-sm)', backgroundColor: '#fff',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center',
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
                                  style={{
                                    padding: '5px', border: '1px solid #e2e8f0',
                                    borderRadius: 'var(--radius-sm)', backgroundColor: '#fff',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center',
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
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
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
                                className="action-btn"
                                style={{
                                  color: (item.caminhao || (item.implementos && item.implementos.length > 0)) ? 'var(--color-primary)' : 'var(--color-grey-400)',
                                  borderColor: (item.caminhao || (item.implementos && item.implementos.length > 0)) ? 'rgba(249,115,22,0.2)' : '#e2e8f0',
                                }}
                              >
                                <Calculator size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicarItem(item.tempId)}
                                title="Duplicar item"
                                className="action-btn"
                              >
                                <Copy size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoverItem(item.tempId)}
                                title="Excluir item"
                                className="action-btn action-btn-delete"
                              >
                                <Trash size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
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
          meses_antes_aluguel: cotMesesAntesAluguel !== '' ? parseInt(cotMesesAntesAluguel, 10) : undefined,
          meses_depois_aluguel: cotMesesDepoisAluguel !== '' ? parseInt(cotMesesDepoisAluguel, 10) : undefined,
        }}
        onSave={handleSalvarCamposCalculo}
      />
    </DashboardLayout>
  );
}
