import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, FileText, LinkBreak, Plus, Trash } from '@phosphor-icons/react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { InputNumber } from '../../components/ui/InputNumber';
import { InputDate } from '../../components/ui/InputDate';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { Drawer } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Textarea } from '../../components/ui/Textarea';
import { FileUpload } from '../../components/ui/FileUpload';
import { useToast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  acoplarImplemento,
  brToIso,
  desacoplarImplemento,
  displayAssetStatus,
  formatDateTime,
  formatMoney,
  isoToBr,
  LOCADORA_OPTIONS,
  MOVIMENTO_LABELS,
  FAMILY_CATALOGO_OPTIONS,
  parseIntOrNull,
  parseMoney,
  registrarMovimento,
  snapshotModeloTexto,
  STATUS_ATIVO_BADGE,
  STATUS_ATIVO_LABELS,
  STATUS_ATIVO_OPTIONS,
  todayBr,
  todayIso,
  asObject,
  labelCatalogoModelo,
  loadCatalogoModelos,
  TIPO_VEICULO_OPTIONS,
  type CatalogoModelo,
  type StatusOperacional,
  type TipoMovimento,
} from './frotaShared';
import '../../styles/components/frota.css';
import '../../styles/components/table.css';

interface VeiculoDetalhe {
  id: string;
  placa: string;
  chassi: string;
  renavam: string;
  marca: string;
  modelo_texto: string;
  caminhao_id: string | null;
  catalogo: CatalogoModelo | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  cor: string;
  locadora: string;
  status_operacional: StatusOperacional;
  nf_compra: string;
  data_emissao_nf: string | null;
  valor_compra: number | null;
}

interface AcoplamentoAtivo {
  id: string;
  data_inicio: string;
  implementoId: string;
  nome: string;
  valor: number | null;
  nf: string;
  implementadoraNome: string;
}

interface AnexoRow {
  id: string;
  arquivo_nome: string;
  arquivo_url: string;
  arquivo_path: string;
  mime_type: string;
  tamanho_bytes: number | null;
  criado_em: string;
  signedUrl?: string;
}

interface MovimentoRow {
  id: string;
  tipo: TipoMovimento;
  descricao: string;
  criado_em: string;
}

function emptyVeiculoForm() {
  return {
    placa: '',
    chassi: '',
    renavam: '',
    ano_fabricacao: '',
    ano_modelo: '',
    cor: '',
    locadora: null as OptionType | null,
    status_operacional: STATUS_ATIVO_OPTIONS[0] as OptionType | null,
    tipo: TIPO_VEICULO_OPTIONS[0] as OptionType | null,
    familia: null as OptionType | null,
    modelo: null as OptionType | null,
    nf_compra: '',
    data_emissao_nf: '',
    valor_compra: 0 as number | string,
  };
}

type VeiculoForm = ReturnType<typeof emptyVeiculoForm>;

function emptyImplForm() {
  return {
    modo: 'existente' as 'existente' | 'novo',
    implemento: null as OptionType | null,
    nome: '',
    valor: 0 as number | string,
    nf: '',
    implementadora: null as OptionType | null,
    data_inicio: todayBr(),
  };
}

type ImplForm = ReturnType<typeof emptyImplForm>;

export function FrotaVeiculoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [veiculo, setVeiculo] = useState<VeiculoDetalhe | null>(null);
  const [form, setForm] = useState<VeiculoForm>(emptyVeiculoForm());
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('dados');

  const [acoplamentos, setAcoplamentos] = useState<AcoplamentoAtivo[]>([]);
  const [implDrawerOpen, setImplDrawerOpen] = useState(false);
  const [implForm, setImplForm] = useState<ImplForm>(emptyImplForm());
  const [implSaving, setImplSaving] = useState(false);
  const [livreOptions, setLivreOptions] = useState<OptionType[]>([]);
  const [implementadoraOptions, setImplementadoraOptions] = useState<OptionType[]>([]);

  const [anexos, setAnexos] = useState<AnexoRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [anexoToDelete, setAnexoToDelete] = useState<AnexoRow | null>(null);

  const [movimentos, setMovimentos] = useState<MovimentoRow[]>([]);
  const [obsTexto, setObsTexto] = useState('');
  const [obsSaving, setObsSaving] = useState(false);
  const [catalogo, setCatalogo] = useState<CatalogoModelo[]>([]);

  const patchForm = (partial: Partial<VeiculoForm>) => setForm(prev => ({ ...prev, ...partial }));
  const patchImpl = (partial: Partial<ImplForm>) => setImplForm(prev => ({ ...prev, ...partial }));

  const loadVeiculo = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('frota_veiculos')
      .select('*, caminhao:caminhoes(id, tipo, marca, familia, modelo)')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) {
      setVeiculo(null);
      return;
    }
    const catalogoJoin = asObject(data.caminhao as CatalogoModelo | CatalogoModelo[] | null);
    const mapped: VeiculoDetalhe = {
      id: data.id,
      placa: data.placa || '',
      chassi: data.chassi || '',
      renavam: data.renavam || '',
      marca: data.marca || '',
      modelo_texto: data.modelo_texto || '',
      caminhao_id: data.caminhao_id || null,
      catalogo: catalogoJoin,
      ano_fabricacao: data.ano_fabricacao,
      ano_modelo: data.ano_modelo,
      cor: data.cor || '',
      locadora: data.locadora || '',
      status_operacional: data.status_operacional,
      nf_compra: data.nf_compra || '',
      data_emissao_nf: data.data_emissao_nf,
      valor_compra: data.valor_compra != null ? Number(data.valor_compra) : null,
    };
    setVeiculo(mapped);
    const displayStatus = displayAssetStatus(mapped.status_operacional);
    const tipoOpt = TIPO_VEICULO_OPTIONS.find(o => o.value === catalogoJoin?.tipo) || TIPO_VEICULO_OPTIONS[0];
    const familiaOpt = catalogoJoin?.familia
      ? FAMILY_CATALOGO_OPTIONS.find(o => o.value === catalogoJoin.familia) || { value: catalogoJoin.familia, label: catalogoJoin.familia }
      : null;
    setForm({
      placa: mapped.placa,
      chassi: mapped.chassi,
      renavam: mapped.renavam,
      tipo: tipoOpt,
      familia: familiaOpt,
      modelo: catalogoJoin ? { value: catalogoJoin.id, label: labelCatalogoModelo(catalogoJoin) } : null,
      ano_fabricacao: mapped.ano_fabricacao != null ? String(mapped.ano_fabricacao) : '',
      ano_modelo: mapped.ano_modelo != null ? String(mapped.ano_modelo) : '',
      cor: mapped.cor,
      locadora: LOCADORA_OPTIONS.find(o => o.value === mapped.locadora) || null,
      status_operacional: STATUS_ATIVO_OPTIONS.find(o => o.value === displayStatus) || STATUS_ATIVO_OPTIONS[0],
      nf_compra: mapped.nf_compra,
      data_emissao_nf: isoToBr(mapped.data_emissao_nf),
      valor_compra: mapped.valor_compra ?? 0,
    });
  }, [id]);

  const loadAcoplamentos = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('frota_acoplamentos')
      .select(
        `
        id, data_inicio,
        implemento:frota_implementos (
          id, nome, valor, nf,
          implementadora:frota_implementadoras ( nome )
        )
      `
      )
      .eq('veiculo_id', id)
      .is('data_fim', null)
      .order('data_inicio', { ascending: false });
    if (error) {
      console.error('Erro ao carregar implementos:', error);
      return;
    }
    setAcoplamentos(
      (data || []).map(row => {
        const impl = asObject(row.implemento as {
          id: string;
          nome: string;
          valor: number | null;
          nf: string | null;
          implementadora: { nome: string } | { nome: string }[] | null;
        } | Array<{
          id: string;
          nome: string;
          valor: number | null;
          nf: string | null;
          implementadora: { nome: string } | { nome: string }[] | null;
        }> | null);
        const implementadora = asObject(impl?.implementadora);
        return {
          id: row.id,
          data_inicio: row.data_inicio,
          implementoId: impl?.id || '',
          nome: impl?.nome || 'Implemento',
          valor: impl?.valor != null ? Number(impl.valor) : null,
          nf: impl?.nf || '',
          implementadoraNome: implementadora?.nome || '',
        };
      })
    );
  }, [id]);

  const loadAnexos = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('frota_veiculo_anexos')
      .select('*')
      .eq('veiculo_id', id)
      .order('criado_em', { ascending: false });
    if (error) {
      console.error('Erro ao carregar documentos:', error);
      return;
    }
    const rows: AnexoRow[] = [];
    for (const item of data || []) {
      let signedUrl = item.arquivo_url as string;
      const { data: signed } = await supabase.storage.from('frota-documentos').createSignedUrl(item.arquivo_path, 3600);
      if (signed?.signedUrl) signedUrl = signed.signedUrl;
      rows.push({
        id: item.id,
        arquivo_nome: item.arquivo_nome,
        arquivo_url: item.arquivo_url,
        arquivo_path: item.arquivo_path,
        mime_type: item.mime_type || '',
        tamanho_bytes: item.tamanho_bytes,
        criado_em: item.criado_em,
        signedUrl,
      });
    }
    setAnexos(rows);
  }, [id]);

  const loadMovimentos = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('frota_movimentacoes')
      .select('id, tipo, descricao, criado_em')
      .eq('veiculo_id', id)
      .order('criado_em', { ascending: false });
    if (error) {
      console.error('Erro ao carregar movimentação:', error);
      return;
    }
    setMovimentos((data || []) as MovimentoRow[]);
  }, [id]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadVeiculo(), loadAcoplamentos(), loadAnexos(), loadMovimentos()]);
    setLoading(false);
  }, [loadVeiculo, loadAcoplamentos, loadAnexos, loadMovimentos]);

  useEffect(() => {
    loadCatalogoModelos().then(setCatalogo);
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleSaveDados = async () => {
    if (!id) return;
    if (!form.placa.trim() && !form.chassi.trim()) {
      toast.error('Campos obrigatórios', 'Informe a placa ou o chassi do caminhão.');
      return;
    }
    if (!form.status_operacional) {
      toast.error('Campos obrigatórios', 'Selecione o status do ativo.');
      return;
    }
    if (!form.modelo && veiculo?.caminhao_id) {
      toast.error('Campos obrigatórios', 'Selecione o modelo no catálogo.');
      return;
    }
    setSaving(true);
    try {
      const modeloCat = catalogo.find(c => c.id === form.modelo?.value) || null;
      const payload = {
        placa: form.placa.trim() || null,
        chassi: form.chassi.trim() || null,
        renavam: form.renavam.trim() || null,
        caminhao_id: modeloCat?.id || null,
        marca: modeloCat?.marca || null,
        modelo_texto: modeloCat
          ? snapshotModeloTexto(modeloCat.marca, modeloCat.modelo)
          : veiculo?.modelo_texto || null,
        ano_fabricacao: parseIntOrNull(form.ano_fabricacao),
        ano_modelo: parseIntOrNull(form.ano_modelo),
        cor: form.cor.trim() || null,
        locadora: form.locadora?.value || null,
        status_operacional: form.status_operacional.value,
        nf_compra: form.nf_compra.trim() || null,
        data_emissao_nf: brToIso(form.data_emissao_nf),
        valor_compra: parseMoney(form.valor_compra),
      };
      const { error } = await supabase.from('frota_veiculos').update(payload).eq('id', id);
      if (error) {
        toast.error('Erro ao atualizar caminhão', error.message);
      } else {
        toast.success('Dados do caminhão salvos.');
        loadVeiculo();
      }
    } finally {
      setSaving(false);
    }
  };

  const openImplDrawer = async () => {
    setImplForm(emptyImplForm());
    const [{ data: livres }, { data: impladoras }] = await Promise.all([
      supabase
        .from('frota_implementos')
        .select('id, nome, frota_acoplamentos(data_fim)')
        .order('nome'),
      supabase.from('frota_implementadoras').select('id, nome').order('nome'),
    ]);
    const livresOpts = (livres || [])
      .filter(row => {
        const couplings = (row.frota_acoplamentos as Array<{ data_fim: string | null }>) || [];
        return !couplings.some(c => !c.data_fim);
      })
      .map(row => ({ value: row.id, label: row.nome }));
    setLivreOptions(livresOpts);
    setImplementadoraOptions((impladoras || []).map(row => ({ value: row.id, label: row.nome })));
    setImplDrawerOpen(true);
  };

  const handleAcoplar = async () => {
    if (!id || !veiculo) return;
    const dataInicio = brToIso(implForm.data_inicio) || todayIso();
    setImplSaving(true);
    try {
      if (implForm.modo === 'existente') {
        if (!implForm.implemento) {
          toast.error('Campo obrigatório', 'Selecione um implemento livre.');
          return;
        }
        const err = await acoplarImplemento({
          veiculoId: id,
          implementoId: implForm.implemento.value,
          dataInicio,
          placa: veiculo.placa,
          implementoNome: implForm.implemento.label,
          criadoPor: user?.id || null,
        });
        if (err) {
          toast.error('Não foi possível acoplar', err);
          return;
        }
      } else {
        if (!implForm.nome.trim()) {
          toast.error('Campo obrigatório', 'Informe o nome do implemento.');
          return;
        }
        const { data, error } = await supabase
          .from('frota_implementos')
          .insert([
            {
              nome: implForm.nome.trim(),
              valor: parseMoney(implForm.valor),
              nf: implForm.nf.trim() || null,
              implementadora_id: implForm.implementadora?.value || null,
            },
          ])
          .select('id, nome')
          .single();
        if (error || !data) {
          toast.error('Erro ao cadastrar implemento', error?.message || 'Não foi possível salvar.');
          return;
        }
        await registrarMovimento({
          implementoId: data.id,
          tipo: 'cadastro',
          descricao: `Cadastrou o implemento ${data.nome}`,
          criadoPor: user?.id || null,
        });
        const err = await acoplarImplemento({
          veiculoId: id,
          implementoId: data.id,
          dataInicio,
          placa: veiculo.placa,
          implementoNome: data.nome,
          criadoPor: user?.id || null,
        });
        if (err) {
          toast.error('Implemento criado, mas o acoplamento falhou', err);
          return;
        }
      }
      toast.success('Implemento acoplado com sucesso!');
      setImplDrawerOpen(false);
      loadAcoplamentos();
      loadMovimentos();
    } finally {
      setImplSaving(false);
    }
  };

  const handleDesacoplar = async (item: AcoplamentoAtivo) => {
    if (!veiculo) return;
    const err = await desacoplarImplemento({
      acoplamentoId: item.id,
      veiculoId: veiculo.id,
      implementoId: item.implementoId,
      placa: veiculo.placa,
      implementoNome: item.nome,
      criadoPor: user?.id || null,
    });
    if (err) {
      toast.error('Não foi possível desacoplar', err);
    } else {
      toast.success('Implemento desacoplado.');
      loadAcoplamentos();
      loadMovimentos();
    }
  };

  const handleUpload = async (files: File[]) => {
    if (!id || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const path = `veiculos/${id}/${Date.now()}_${safeName}`;
        const { error: uploadErr } = await supabase.storage.from('frota-documentos').upload(path, file);
        if (uploadErr) {
          toast.warning('Aviso de upload', `Não foi possível enviar ${file.name}.`);
          continue;
        }
        const { data: publicData } = supabase.storage.from('frota-documentos').getPublicUrl(path);
        const { error: insertErr } = await supabase.from('frota_veiculo_anexos').insert({
          veiculo_id: id,
          criado_por: user?.id || null,
          arquivo_nome: file.name,
          arquivo_url: publicData.publicUrl,
          arquivo_path: path,
          mime_type: file.type || 'application/octet-stream',
          tamanho_bytes: file.size,
        });
        if (insertErr) {
          toast.error('Erro ao registrar anexo', insertErr.message);
          continue;
        }
        await registrarMovimento({
          veiculoId: id,
          tipo: 'documento',
          descricao: `Anexou o documento ${file.name}`,
          criadoPor: user?.id || null,
        });
      }
      loadAnexos();
      loadMovimentos();
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAnexo = async () => {
    if (!anexoToDelete || !id) return;
    await supabase.from('frota_veiculo_anexos').delete().eq('id', anexoToDelete.id);
    await supabase.storage.from('frota-documentos').remove([anexoToDelete.arquivo_path]);
    await registrarMovimento({
      veiculoId: id,
      tipo: 'documento',
      descricao: `Removeu o documento ${anexoToDelete.arquivo_nome}`,
      criadoPor: user?.id || null,
    });
    setAnexoToDelete(null);
    toast.success('Documento removido.');
    loadAnexos();
    loadMovimentos();
  };

  const handleAddObs = async () => {
    if (!id || !obsTexto.trim()) {
      toast.error('Campo obrigatório', 'Escreva a observação.');
      return;
    }
    setObsSaving(true);
    try {
      const err = await registrarMovimento({
        veiculoId: id,
        tipo: 'observacao',
        descricao: obsTexto.trim(),
        criadoPor: user?.id || null,
      });
      if (err) {
        toast.error('Erro ao registrar observação', err);
      } else {
        setObsTexto('');
        toast.success('Observação registrada.');
        loadMovimentos();
      }
    } finally {
      setObsSaving(false);
    }
  };

  if (!loading && !veiculo) {
    return (
      <DashboardLayout pageTitle="Caminhão não encontrado" pageSubtitle="A unidade solicitada não foi localizada.">
        <Button onClick={() => navigate('/painel/frota')} variant="secondary">
          Voltar para Caminhões
        </Button>
      </DashboardLayout>
    );
  }

  const status = displayAssetStatus(veiculo?.status_operacional);
  const valorTotalImpl = acoplamentos.reduce((sum, item) => sum + Number(item.valor || 0), 0);

  return (
    <DashboardLayout
      pageTitle={veiculo?.placa || 'Caminhão'}
      pageSubtitle={
        veiculo
          ? `${veiculo.catalogo ? labelCatalogoModelo(veiculo.catalogo) : veiculo.modelo_texto || 'Sem modelo'} · ${STATUS_ATIVO_LABELS[status]}`
          : 'Carregando...'
      }
      headerActions={
        <Button onClick={() => navigate('/painel/frota')} variant="secondary">
          <ArrowLeft size={18} style={{ marginRight: 6 }} />
          Voltar
        </Button>
      }
    >
      <div className="frota-detail-tabs">
        <Tabs
          tabs={[
            { key: 'dados', label: 'Dados' },
            { key: 'implementos', label: 'Implementos', badge: acoplamentos.length || undefined },
            { key: 'documentos', label: 'Documentos', badge: anexos.length || undefined },
            { key: 'movimentacao', label: 'Movimentação' },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {loading && <p className="frota-muted">Carregando...</p>}

      {!loading && activeTab === 'dados' && (
        <div className="frota-form-sections-container frota-detail-card">
          <div className="frota-form-section">
            <div className="frota-section-info">
              <h3 className="frota-section-title">Identificação</h3>
              <p className="frota-section-desc">Dados do ativo, sem contrato</p>
            </div>
            <div className="frota-section-fields">
              <div className="frota-input-row">
                <Input label="Placa" value={form.placa} onChange={e => patchForm({ placa: e.target.value.toUpperCase() })} />
                <Input label="Chassi" value={form.chassi} onChange={e => patchForm({ chassi: e.target.value.toUpperCase() })} />
              </div>
              <div className="frota-input-row">
                <Input label="RENAVAM" value={form.renavam} onChange={e => patchForm({ renavam: e.target.value })} />
                <Select
                  label="Tipo"
                  options={TIPO_VEICULO_OPTIONS}
                  value={form.tipo}
                  onChange={opt => patchForm({ tipo: opt as OptionType, familia: null, modelo: null })}
                />
              </div>
              {veiculo && !veiculo.caminhao_id && (
                <p className="frota-muted">Este ativo não está no catálogo (equipamento/implemento da planilha).</p>
              )}
              <div className="frota-input-row">
                <Select
                  label="Família"
                  options={FAMILY_CATALOGO_OPTIONS.filter(f =>
                    catalogo.some(c => c.tipo === form.tipo?.value && c.familia === f.value)
                  )}
                  value={form.familia}
                  onChange={opt => patchForm({ familia: (opt as OptionType) || null, modelo: null })}
                  isClearable
                  placeholder="Opcional"
                />
                <Select
                  label="Modelo"
                  options={catalogo
                    .filter(c =>
                      c.tipo === form.tipo?.value &&
                      (!form.familia?.value || c.familia === form.familia.value)
                    )
                    .map(c => ({ value: c.id, label: labelCatalogoModelo(c) }))}
                  value={form.modelo}
                  onChange={opt => patchForm({ modelo: (opt as OptionType) || null })}
                  isClearable
                  placeholder="Selecione o modelo..."
                />
              </div>
              <div className="frota-input-row">
                <Input
                  label="Ano fabricação"
                  value={form.ano_fabricacao}
                  onChange={e => patchForm({ ano_fabricacao: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                />
                <Input
                  label="Ano modelo"
                  value={form.ano_modelo}
                  onChange={e => patchForm({ ano_modelo: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                />
                <Input label="Cor" value={form.cor} onChange={e => patchForm({ cor: e.target.value })} />
              </div>
              <div className="frota-input-row">
                <Select
                  label="Locadora"
                  options={LOCADORA_OPTIONS}
                  value={form.locadora}
                  onChange={opt => patchForm({ locadora: opt as OptionType })}
                />
                <Select
                  label="Status do ativo"
                  options={STATUS_ATIVO_OPTIONS}
                  value={form.status_operacional}
                  onChange={opt => patchForm({ status_operacional: opt as OptionType })}
                />
              </div>
            </div>
          </div>
          <div className="frota-form-section">
            <div className="frota-section-info">
              <h3 className="frota-section-title">Compra do casco</h3>
              <p className="frota-section-desc">NF, emissão e valor de aquisição</p>
            </div>
            <div className="frota-section-fields">
              <div className="frota-input-row">
                <Input label="NF de compra" value={form.nf_compra} onChange={e => patchForm({ nf_compra: e.target.value })} />
                <InputDate
                  label="Emissão da NF"
                  value={form.data_emissao_nf}
                  onChange={val => patchForm({ data_emissao_nf: typeof val === 'string' ? val : '' })}
                />
                <InputNumber
                  label="Valor de compra"
                  currency
                  value={form.valor_compra}
                  onChange={val => patchForm({ valor_compra: val })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="primary" onClick={handleSaveDados} loading={saving}>
                  Salvar dados
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && activeTab === 'implementos' && (
        <div className="frota-detail-card">
          <div className="frota-detail-toolbar">
            <div>
              <p className="frota-kpi-label">Valor total dos implementos</p>
              <p className="frota-kpi-value">{formatMoney(valorTotalImpl)}</p>
            </div>
            <Button variant="primary" onClick={openImplDrawer} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} weight="bold" />
              Acoplar implemento
            </Button>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Implementadora</th>
                  <th>Valor</th>
                  <th>Desde</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {acoplamentos.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                      Nenhum implemento acoplado neste caminhão.
                    </td>
                  </tr>
                ) : (
                  acoplamentos.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div className="frota-cell-placa">
                          <span className="frota-placa-text">{item.nome}</span>
                          {item.nf && <span className="frota-chassi-text">NF {item.nf}</span>}
                        </div>
                      </td>
                      <td>{item.implementadoraNome || '—'}</td>
                      <td>{formatMoney(item.valor)}</td>
                      <td>{isoToBr(item.data_inicio)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="action-btn" onClick={() => handleDesacoplar(item)} title="Desacoplar">
                          <LinkBreak size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && activeTab === 'documentos' && (
        <div className="frota-detail-card">
          <FileUpload
            label={uploading ? 'Enviando...' : 'Anexar documentos'}
            onUpload={handleUpload}
            disabled={uploading}
            maxSize={10 * 1024 * 1024}
            accept="application/pdf,image/jpeg,image/png,image/webp,.doc,.docx"
          />
          <div className="table-container" style={{ marginTop: 'var(--spacing-24)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Enviado em</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {anexos.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: 'var(--spacing-32)', color: 'var(--color-grey-400)' }}>
                      Nenhum documento anexado.
                    </td>
                  </tr>
                ) : (
                  anexos.map(anexo => (
                    <tr key={anexo.id}>
                      <td>
                        <a className="frota-link-btn" href={anexo.signedUrl || anexo.arquivo_url} target="_blank" rel="noreferrer">
                          <FileText size={16} /> {anexo.arquivo_nome}
                        </a>
                      </td>
                      <td>{formatDateTime(anexo.criado_em)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="action-btn action-btn-delete" onClick={() => setAnexoToDelete(anexo)} title="Excluir">
                          <Trash size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && activeTab === 'movimentacao' && (
        <div className="frota-detail-card">
          <div className="frota-obs-row">
            <Textarea
              label="Nova observação"
              rows={3}
              value={obsTexto}
              onChange={e => setObsTexto(e.target.value)}
              placeholder="Registre um evento ou comentário sobre este caminhão."
            />
            <Button variant="primary" onClick={handleAddObs} loading={obsSaving}>
              Registrar
            </Button>
          </div>
          <ul className="frota-timeline">
            {movimentos.length === 0 ? (
              <li className="frota-muted">Nenhuma movimentação ainda.</li>
            ) : (
              movimentos.map(mov => (
                <li key={mov.id} className="frota-timeline-item">
                  <Badge variant={mov.tipo === 'desacoplamento' ? 'warning' : mov.tipo === 'documento' ? 'neutral' : 'primary'}>
                    {MOVIMENTO_LABELS[mov.tipo] || mov.tipo}
                  </Badge>
                  <div>
                    <p className="frota-timeline-desc">{mov.descricao}</p>
                    <p className="frota-chassi-text">{formatDateTime(mov.criado_em)}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      <Drawer
        isOpen={implDrawerOpen}
        onClose={() => setImplDrawerOpen(false)}
        title="Acoplar implemento"
        subtitle="Um caminhão pode ter dois ou mais implementos ao mesmo tempo."
        width="560px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-12)', width: '100%' }}>
            <Button variant="secondary" onClick={() => setImplDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleAcoplar} loading={implSaving}>
              Acoplar
            </Button>
          </div>
        }
      >
        <div className="frota-section-fields">
          <Select
            label="Origem"
            options={[
              { value: 'existente', label: 'Implemento já cadastrado' },
              { value: 'novo', label: 'Cadastrar agora' },
            ]}
            value={
              implForm.modo === 'novo'
                ? { value: 'novo', label: 'Cadastrar agora' }
                : { value: 'existente', label: 'Implemento já cadastrado' }
            }
            onChange={opt => patchImpl({ modo: ((opt as OptionType)?.value as ImplForm['modo']) || 'existente' })}
          />
          <InputDate
            label="Data de início"
            value={implForm.data_inicio}
            onChange={val => patchImpl({ data_inicio: typeof val === 'string' ? val : implForm.data_inicio })}
          />
          {implForm.modo === 'existente' ? (
            <Select
              label="Implemento livre"
              options={livreOptions}
              value={implForm.implemento}
              onChange={opt => patchImpl({ implemento: (opt as OptionType) || null })}
              placeholder={livreOptions.length ? 'Selecione...' : 'Nenhum implemento livre'}
            />
          ) : (
            <>
              <Input
                label="Nome"
                required
                value={implForm.nome}
                onChange={e => patchImpl({ nome: e.target.value })}
              />
              <Select
                label="Implementadora"
                options={implementadoraOptions}
                value={implForm.implementadora}
                onChange={opt => patchImpl({ implementadora: (opt as OptionType) || null })}
                isClearable
                placeholder="Selecione..."
              />
              <div className="frota-input-row">
                <InputNumber label="Valor" currency value={implForm.valor} onChange={val => patchImpl({ valor: val })} />
                <Input label="NF" value={implForm.nf} onChange={e => patchImpl({ nf: e.target.value })} />
              </div>
            </>
          )}
        </div>
      </Drawer>

      <ConfirmModal
        isOpen={!!anexoToDelete}
        onClose={() => setAnexoToDelete(null)}
        onConfirm={handleDeleteAnexo}
        title="Excluir documento"
        message={
          <>
            Remover o arquivo <strong>{anexoToDelete?.arquivo_nome}</strong>?
          </>
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
      />
    </DashboardLayout>
  );
}
