// pages/cotacoes/NovaCotacaoPage.tsx — Form de Nova/Editar Cotação TOPE
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  FloppyDisk, 
  Trash, 
  Warning, 
  CheckCircle,
  FileArrowUp,
  List
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
import '../../styles/components/cotacoes.css';

// Interfaces locais
interface ItemLocal {
  id?: string;
  quantidade: number;
  descricao: string;
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

// Helpers de Máscara e Validação de CNPJ
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
  if (resultado !== parseInt(digitos.charAt(1))) return false;

  return true;
};

export function NovaCotacaoPage() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const { user, profile } = useAuth();

  // Estados do Formulário principal
  const [formCNPJ, setFormCNPJ] = useState('');
  const [formRazaoSocial, setFormRazaoSocial] = useState('');
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [isClienteCadastrado, setIsClienteCadastrado] = useState(false);
  const [buscandoCNPJ, setBuscandoCNPJ] = useState(false);

  const [prazos, setPrazos] = useState<number[]>([60]); // Padrão: 60 meses
  const [estimativaRodagem, setEstimativaRodagem] = useState('5000');
  const [tipoPlaca, setTipoPlaca] = useState<OptionType | null>({ value: 'Comum', label: 'Comum' });
  const [descricao, setDescricao] = useState('');
  const [detalhamentoAtivo, setDetalhamentoAtivo] = useState(false);
  const [status, setStatus] = useState<OptionType | null>({ value: 'Em avaliação', label: 'Em avaliação' });
  const [vendedor, setVendedor] = useState<OptionType | null>(null);

  // Tabelas auxiliares
  const [vendedorOptions, setVendedorOptions] = useState<OptionType[]>([]);

  // Itens da cotação
  const [itens, setItens] = useState<ItemLocal[]>([]);

  // Arquivos / Anexos
  const [novosArquivos, setNovosArquivos] = useState<File[]>([]);
  const [anexosSalvos, setAnexosSalvos] = useState<AnexoSalvo[]>([]);
  const [anexosDeletarIds, setAnexosDeletarIds] = useState<AnexoSalvo[]>([]);

  // Loadings
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [saving, setSaving] = useState(false);

  // 1. Carrega vendedores do banco
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

  // 2. Carregar Cotação Existente (Edição)
  useEffect(() => {
    async function loadCotacao() {
      if (!isEditMode || !id) return;
      setLoadingData(true);
      try {
        // Cotação Principal
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

        // Setar campos simples
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

        // Carregar Anexos
        const { data: anxs } = await supabase
          .from('cotacao_anexos')
          .select('*')
          .eq('cotacao_id', id);
        if (anxs) {
          setAnexosSalvos(anxs);
        }

        // Carregar Itens da cotação
        if (cot.detalhamento_ativo) {
          const { data: its } = await supabase
            .from('cotacao_itens')
            .select('*')
            .eq('cotacao_id', id);
          
          if (its) {
            const mappedItens: ItemLocal[] = its.map((item: any) => ({
              id: item.id,
              quantidade: item.quantidade,
              descricao: item.descricao || ''
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

  // 3. Busca CNPJ no Supabase ou BrasilAPI
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

  // Itens: Adicionar
  const handleAddItem = () => {
    const novoItem: ItemLocal = {
      quantidade: 1,
      descricao: ''
    };
    setItens(prev => [...prev, novoItem]);
  };

  // Itens: Remover
  const handleRemoveItem = (index: number) => {
    setItens(prev => prev.filter((_, i) => i !== index));
  };

  // Itens: Alterar campos simples
  const handleItemFieldChange = (index: number, field: keyof ItemLocal, val: any) => {
    setItens(prev => {
      const clone = [...prev];
      clone[index] = { ...clone[index], [field]: val };
      return clone;
    });
  };

  // Anexos: Remover Anexo já salvo
  const handleRemoveAnexoSalvo = (anexo: AnexoSalvo) => {
    setAnexosSalvos(prev => prev.filter(a => a.id !== anexo.id));
    setAnexosDeletarIds(prev => [...prev, anexo]);
  };

  // Salvar Formulário
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

      const incompleto = itens.some(i => !i.descricao.trim());
      if (incompleto) {
        toast.error('Itens incompletos', 'Por favor, preencha a descrição de todos os itens.');
        return;
      }
    }

    setSaving(true);
    try {
      let currentClienteId = clienteId;

      if (!currentClienteId) {
        const { data: newClient, error: clientErr } = await supabase
          .from('clientes')
          .insert({
            cnpj: formCNPJ,
            razao_social: formRazaoSocial,
            vendedor_id: vendedor?.value || null
          })
          .select('id')
          .single();

        if (clientErr || !newClient) {
          throw new Error(`Erro ao cadastrar cliente automaticamente: ${clientErr?.message}`);
        }
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
        status: status?.value as 'Em avaliação' | 'Em orçamento' | 'Completo',
        criado_por: user?.id || null
      };

      let activeCotacaoId = id;

      if (isEditMode && id) {
        const { error: updErr } = await supabase
          .from('cotacoes')
          .update(cotacaoPayload)
          .eq('id', id);

        if (updErr) throw updErr;
      } else {
        const { data: newCot, error: insErr } = await supabase
          .from('cotacoes')
          .insert(cotacaoPayload)
          .select('id')
          .single();

        if (insErr || !newCot) throw insErr || new Error('Não foi possível registrar a nova cotação.');
        activeCotacaoId = newCot.id;
      }

      const safeCotacaoId = activeCotacaoId as string;

      // 3. Gravar itens (deleta anteriores e reinsere se ativo)
      if (detalhamentoAtivo) {
        const { error: delErr } = await supabase
          .from('cotacao_itens')
          .delete()
          .eq('cotacao_id', safeCotacaoId);
        if (delErr) throw delErr;

        const itensPayload = itens.map(item => ({
          cotacao_id: safeCotacaoId,
          quantidade: item.quantidade,
          descricao: item.descricao
        }));

        const { error: insItensErr } = await supabase
          .from('cotacao_itens')
          .insert(itensPayload);
        if (insItensErr) throw insItensErr;
      } else {
        await supabase.from('cotacao_itens').delete().eq('cotacao_id', safeCotacaoId);
      }

      // 4. Upload de novos anexos
      if (novosArquivos.length > 0) {
        for (const file of novosArquivos) {
          const path = `cotacoes/${safeCotacaoId}/${Date.now()}_${file.name}`;
          const { error: uploadErr } = await supabase.storage
            .from('cotacoes-anexos')
            .upload(path, file);

          if (uploadErr) {
            console.error('Erro de upload:', uploadErr);
            toast.warning('Aviso de upload', `Não foi possível enviar o anexo ${file.name}.`);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('cotacoes-anexos')
            .getPublicUrl(path);

          await supabase
            .from('cotacao_anexos')
            .insert({
              cotacao_id: safeCotacaoId,
              criado_por: user?.id || null,
              arquivo_nome: file.name,
              arquivo_url: publicUrl,
              arquivo_path: path,
              mime_type: file.type || 'application/octet-stream',
              tamanho_bytes: file.size
            });
        }
      }

      // 5. Excluir anexos removidos
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

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  if (loadingData) {
    return (
      <DashboardLayout pageTitle="Carregando..." pageSubtitle="Buscando informações da cotação.">
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--color-grey-450)' }}>
          Carregando dados da cotação...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      pageTitle={isEditMode ? 'Editar cotação' : 'Nova cotação'} 
      pageSubtitle={isEditMode ? 'Modifique os parâmetros desta cotação.' : 'Forneça os detalhes para criar uma cotação.'}
    >
      <form onSubmit={handleSubmit} className="cotacao-form-container">
        {/* Cabeçalho de Ações */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button 
            type="button" 
            variant="secondary" 
            onClick={() => navigate('/painel/cotacoes')}
          >
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
                  onChange={setStatus}
                  placeholder="Status"
                />
              </div>
            )}
            <Button 
              type="submit" 
              variant="primary" 
              loading={saving}
            >
              <FloppyDisk size={18} style={{ marginRight: '6px' }} />
              Salvar Cotação
            </Button>
          </div>
        </div>

        {/* 1. SEÇÃO CLIENTE */}
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
                onChange={setTipoPlaca}
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
                onChange={setVendedor}
                placeholder="Escolha o vendedor..."
              />
            </div>
          </div>
        </div>

        {/* 3. ITENS DA COTAÇÃO */}
        <div className="cotacao-card">
          <div className="detalhamento-toggle-row" style={{ marginBottom: detalhamentoAtivo ? '16px' : '0' }}>
            <div className="detalhamento-toggle-info">
              <h4>Detalhamento dos Itens da Locação</h4>
              <p>Ative caso queira especificar os modelos de caminhões e categorias de implementos.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <label 
                htmlFor="detalhamento-checkbox"
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: '44px',
                  height: '24px',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="checkbox"
                  id="detalhamento-checkbox"
                  checked={detalhamentoAtivo}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setDetalhamentoAtivo(val);
                    if (val && itens.length === 0) {
                      handleAddItem(); // adiciona um item vazio por padrão ao ativar
                    }
                  }}
                  style={{
                    opacity: 0,
                    width: 0,
                    height: 0,
                    position: 'absolute'
                  }}
                />
                <span 
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: detalhamentoAtivo ? 'var(--color-primary)' : 'var(--color-grey-300)',
                    borderRadius: '24px',
                    transition: 'background-color 0.2s',
                  }}
                />
                <span 
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: detalhamentoAtivo ? '22px' : '2px',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                  }}
                />
              </label>
            </div>
          </div>

          {detalhamentoAtivo && (
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--spacing-20)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-16)'
            }}>
              {/* Cabeçalho da Seção de Itens (Ícone, Título e Subtítulo conforme imagem) */}
              <div style={{ display: 'flex', gap: 'var(--spacing-12)', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: 'var(--spacing-12)', marginBottom: 'var(--spacing-4)' }}>
                <div style={{
                  padding: '6px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-grey-500)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <List size={20} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <h4 style={{ margin: 0, fontSize: 'var(--font-size-md)', fontWeight: 600, color: 'var(--color-grey-900)' }}>Itens da cotação</h4>
                  <p style={{ margin: 0, fontSize: 'var(--font-size-xs)', color: 'var(--color-grey-500)' }}>
                    Adicione ou utilize os itens da cotação informados pelo vendedor e associe aos implementos necessários.
                  </p>
                </div>
              </div>

              {/* Lista de Itens (Quantidade e Descrição) */}
              {itens.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ width: '100px' }}>
                    <Input
                      type="number"
                      placeholder="Quantidade"
                      value={item.quantidade}
                      onChange={(e) => handleItemFieldChange(idx, 'quantidade', parseInt(e.target.value) || 1)}
                      min={1}
                      required
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Input
                      type="text"
                      placeholder="Descrição"
                      value={item.descricao}
                      onChange={(e) => handleItemFieldChange(idx, 'descricao', e.target.value)}
                      required
                    />
                  </div>
                  {itens.length > 1 && (
                    <button
                      type="button"
                      className="btn-remover-item"
                      onClick={() => handleRemoveItem(idx)}
                      title="Remover Item"
                      style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Trash size={18} />
                    </button>
                  )}
                </div>
              ))}

              {/* Botão Adicionar Item (Imitando checkbox como na imagem) */}
              <div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 'var(--font-size-sm)',
                    padding: '8px 0',
                    outline: 'none'
                  }}
                >
                  <span style={{
                    width: '16px',
                    height: '16px',
                    border: '1.5px solid var(--color-primary)',
                    borderRadius: '3px',
                    display: 'inline-block',
                    flexShrink: 0
                  }} />
                  Adicionar item
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. ANEXOS */}
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
                      <a href={anexo.arquivo_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-grey-700)', textDecoration: 'none', fontWeight: 500 }}>
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
      </form>
    </DashboardLayout>
  );
}
