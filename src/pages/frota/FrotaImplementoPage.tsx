import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowSquareOut, Eye, FileText, LinkBreak, Trash, X } from '@phosphor-icons/react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '../../components/layout/DashboardLayout';
import { Input } from '../../components/ui/Input';
import { InputNumber } from '../../components/ui/InputNumber';
import { InputDate } from '../../components/ui/InputDate';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Textarea } from '../../components/ui/Textarea';
import { FileUpload } from '../../components/ui/FileUpload';
import { useToast } from '../../components/ui/Toast';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  acoplarImplemento,
  asObject,
  brToIso,
  desacoplarImplemento,
  extrairExtensao,
  extrairNomeBase,
  formatDateTime,
  formatMoney,
  isoToBr,
  montarNomeArquivo,
  parseMoney,
  registrarMovimento,
  TIPO_DOCUMENTO_LABELS,
  TIPO_DOCUMENTO_OPTIONS,
  todayBr,
  todayIso,
} from './frotaShared';
import {
  FrotaMovimentoItem,
  MOVIMENTO_SELECT,
  mapMovimentoRow,
  type MovimentoRow,
} from './FrotaMovimentoItem';
import '../../styles/components/frota.css';
import '../../styles/components/table.css';

interface ImplementoDetalhe {
  id: string;
  nome: string;
  valor: number | null;
  nf: string;
  observacoes: string;
  implementadoraId: string | null;
  implementadoraNome: string;
}

interface AcoplamentoAtivo {
  id: string;
  veiculoId: string;
  placa: string;
  modeloTexto: string;
  dataInicio: string;
}

interface AnexoRow {
  id: string;
  arquivo_nome: string;
  arquivo_url: string;
  arquivo_path: string;
  mime_type: string;
  tamanho_bytes: number | null;
  tipo_documento: string;
  criado_em: string;
  signedUrl?: string;
}

interface PendingAnexo {
  file: File;
  nomeBase: string;
  ext: string;
  tipo: OptionType | null;
}

function emptyForm() {
  return {
    nome: '',
    valor: 0 as number | string,
    nf: '',
    observacoes: '',
    implementadora: null as OptionType | null,
  };
}

type FormState = ReturnType<typeof emptyForm>;

export function FrotaImplementoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [implemento, setImplemento] = useState<ImplementoDetalhe | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('dados');
  const [implementadoraOptions, setImplementadoraOptions] = useState<OptionType[]>([]);

  const [acoplamento, setAcoplamento] = useState<AcoplamentoAtivo | null>(null);
  const [truckOptions, setTruckOptions] = useState<OptionType[]>([]);
  const [selectedTruck, setSelectedTruck] = useState<OptionType | null>(null);
  const [coupleDate, setCoupleDate] = useState(todayBr());
  const [coupling, setCoupling] = useState(false);

  const [anexos, setAnexos] = useState<AnexoRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [anexoToDelete, setAnexoToDelete] = useState<AnexoRow | null>(null);
  const [deletingAnexo, setDeletingAnexo] = useState(false);
  const [pendingAnexos, setPendingAnexos] = useState<PendingAnexo[]>([]);
  const [tipoModalOpen, setTipoModalOpen] = useState(false);

  const [movimentos, setMovimentos] = useState<MovimentoRow[]>([]);
  const [obsTexto, setObsTexto] = useState('');
  const [obsSaving, setObsSaving] = useState(false);

  const patchForm = (partial: Partial<FormState>) => setForm(prev => ({ ...prev, ...partial }));

  const loadImplementadoras = useCallback(async () => {
    const { data } = await supabase.from('frota_implementadoras').select('id, nome').order('nome');
    setImplementadoraOptions((data || []).map(row => ({ value: row.id, label: row.nome })));
  }, []);

  const loadImplemento = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('frota_implementos')
      .select(
        `
        id, nome, valor, nf, observacoes, implementadora_id,
        implementadora:frota_implementadoras(id, nome)
      `
      )
      .eq('id', id)
      .maybeSingle();
    if (error || !data) {
      setImplemento(null);
      return;
    }
    const implementadora = asObject(
      data.implementadora as { id: string; nome: string } | { id: string; nome: string }[] | null
    );
    const mapped: ImplementoDetalhe = {
      id: data.id,
      nome: data.nome || '',
      valor: data.valor != null ? Number(data.valor) : null,
      nf: data.nf || '',
      observacoes: data.observacoes || '',
      implementadoraId: data.implementadora_id,
      implementadoraNome: implementadora?.nome || '',
    };
    setImplemento(mapped);
    setForm({
      nome: mapped.nome,
      valor: mapped.valor ?? 0,
      nf: mapped.nf,
      observacoes: mapped.observacoes,
      implementadora: implementadora
        ? { value: implementadora.id, label: implementadora.nome }
        : null,
    });
  }, [id]);

  const loadAcoplamento = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase
      .from('frota_acoplamentos')
      .select('id, data_inicio, veiculo:frota_veiculos(id, placa, modelo_texto)')
      .eq('implemento_id', id)
      .is('data_fim', null)
      .maybeSingle();
    if (!data) {
      setAcoplamento(null);
      return;
    }
    const veiculo = asObject(
      data.veiculo as { id: string; placa: string | null; modelo_texto: string | null } | null
    );
    if (!veiculo) {
      setAcoplamento(null);
      return;
    }
    setAcoplamento({
      id: data.id,
      veiculoId: veiculo.id,
      placa: veiculo.placa || '',
      modeloTexto: veiculo.modelo_texto || '',
      dataInicio: data.data_inicio,
    });
  }, [id]);

  const loadTruckOptions = useCallback(async () => {
    const { data } = await supabase
      .from('frota_veiculos')
      .select('id, placa, modelo_texto')
      .not('status_operacional', 'in', '("vendido","roubado","baixado")')
      .order('placa');
    setTruckOptions(
      (data || []).map(v => ({
        value: v.id,
        label: `${v.placa || 'Sem placa'} — ${v.modelo_texto || 'sem modelo'}`,
      }))
    );
  }, []);

  const loadAnexos = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('frota_implemento_anexos')
      .select('*')
      .eq('implemento_id', id)
      .order('criado_em', { ascending: false });
    if (error) {
      console.error('Erro ao carregar documentos:', error);
      return;
    }
    const rows: AnexoRow[] = [];
    for (const item of data || []) {
      let signedUrl = item.arquivo_url as string;
      const { data: signed } = await supabase.storage
        .from('frota-documentos')
        .createSignedUrl(item.arquivo_path, 3600);
      if (signed?.signedUrl) signedUrl = signed.signedUrl;
      rows.push({
        id: item.id,
        arquivo_nome: item.arquivo_nome,
        arquivo_url: item.arquivo_url,
        arquivo_path: item.arquivo_path,
        mime_type: item.mime_type || '',
        tamanho_bytes: item.tamanho_bytes,
        tipo_documento: item.tipo_documento || 'outros',
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
      .select(MOVIMENTO_SELECT)
      .eq('implemento_id', id)
      .order('criado_em', { ascending: false });
    if (error) {
      console.error('Erro ao carregar movimentação:', error);
      return;
    }
    setMovimentos((data || []).map(mapMovimentoRow));
  }, [id]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadImplemento(),
      loadAcoplamento(),
      loadAnexos(),
      loadMovimentos(),
    ]);
    setLoading(false);
  }, [loadImplemento, loadAcoplamento, loadAnexos, loadMovimentos]);

  useEffect(() => {
    loadImplementadoras();
  }, [loadImplementadoras]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (activeTab === 'caminhao' && !acoplamento) {
      loadTruckOptions();
    }
  }, [activeTab, acoplamento, loadTruckOptions]);

  const handleSaveDados = async () => {
    if (!id) return;
    if (!form.nome.trim()) {
      toast.error('Campo obrigatório', 'Informe o nome do implemento.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        valor: parseMoney(form.valor),
        nf: form.nf.trim() || null,
        observacoes: form.observacoes.trim() || null,
        implementadora_id: form.implementadora?.value || null,
      };
      const { error } = await supabase.from('frota_implementos').update(payload).eq('id', id);
      if (error) {
        toast.error('Erro ao salvar', error.message);
      } else {
        toast.success('Dados salvos.');
        loadImplemento();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAcoplar = async () => {
    if (!id || !implemento || !selectedTruck) {
      toast.error('Campo obrigatório', 'Selecione o caminhão.');
      return;
    }
    const dataInicio = brToIso(coupleDate) || todayIso();
    setCoupling(true);
    try {
      const err = await acoplarImplemento({
        veiculoId: selectedTruck.value,
        implementoId: id,
        dataInicio,
        placa: selectedTruck.label.split(' — ')[0] || selectedTruck.label,
        implementoNome: implemento.nome,
        criadoPor: user?.id || null,
      });
      if (err) {
        toast.error('Não foi possível acoplar', err);
      } else {
        toast.success('Implemento acoplado.');
        setSelectedTruck(null);
        setCoupleDate(todayBr());
        loadAcoplamento();
        loadMovimentos();
      }
    } finally {
      setCoupling(false);
    }
  };

  const handleDesacoplar = async () => {
    if (!id || !implemento || !acoplamento) return;
    const err = await desacoplarImplemento({
      acoplamentoId: acoplamento.id,
      veiculoId: acoplamento.veiculoId,
      implementoId: id,
      placa: acoplamento.placa,
      implementoNome: implemento.nome,
      criadoPor: user?.id || null,
    });
    if (err) {
      toast.error('Não foi possível desacoplar', err);
    } else {
      toast.success('Implemento desacoplado.');
      loadAcoplamento();
      loadMovimentos();
    }
  };

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;
    const novos = files.map(file => ({
      file,
      nomeBase: extrairNomeBase(file.name),
      ext: extrairExtensao(file.name),
      tipo: null,
    }));
    setPendingAnexos(prev => [...prev, ...novos]);
    setTipoModalOpen(true);
  };

  const cancelarAnexos = () => {
    setPendingAnexos([]);
    setTipoModalOpen(false);
  };

  const removerPendingAnexo = (index: number) => {
    setPendingAnexos(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setTipoModalOpen(false);
      return next;
    });
  };

  const atualizarNomePending = (index: number, nomeBase: string) => {
    setPendingAnexos(prev => prev.map((item, i) => (i === index ? { ...item, nomeBase } : item)));
  };

  const atualizarTipoPending = (index: number, tipo: OptionType | null) => {
    setPendingAnexos(prev => prev.map((item, i) => (i === index ? { ...item, tipo } : item)));
  };

  const todosProntos =
    pendingAnexos.length > 0 &&
    pendingAnexos.every(item => item.tipo && item.nomeBase.trim().length > 0);

  const confirmarAnexos = async () => {
    if (!id || !todosProntos) return;
    setUploading(true);
    try {
      for (const item of pendingAnexos) {
        const file = item.file;
        const nomeFinal = montarNomeArquivo(item.nomeBase, item.ext);
        const tipoSlug = item.tipo!.value;
        const tipoLabel = TIPO_DOCUMENTO_LABELS[tipoSlug] || tipoSlug;
        const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const path = `implementos/${id}/${Date.now()}_${safeName}`;
        const { error: uploadErr } = await supabase.storage.from('frota-documentos').upload(path, file);
        if (uploadErr) {
          toast.warning('Aviso de upload', `Não foi possível enviar ${nomeFinal}.`);
          continue;
        }
        const { data: publicData } = supabase.storage.from('frota-documentos').getPublicUrl(path);
        const { error: insertErr } = await supabase.from('frota_implemento_anexos').insert({
          implemento_id: id,
          criado_por: user?.id || null,
          arquivo_nome: nomeFinal,
          arquivo_url: publicData.publicUrl,
          arquivo_path: path,
          mime_type: file.type || 'application/octet-stream',
          tamanho_bytes: file.size,
          tipo_documento: tipoSlug,
        });
        if (insertErr) {
          toast.error('Erro ao registrar anexo', insertErr.message);
          continue;
        }
        await registrarMovimento({
          implementoId: id,
          tipo: 'documento',
          descricao: `Anexou documento ${tipoLabel}: ${nomeFinal}`,
          criadoPor: user?.id || null,
        });
      }
      setPendingAnexos([]);
      setTipoModalOpen(false);
      loadAnexos();
      loadMovimentos();
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAnexo = async () => {
    if (!anexoToDelete || !id || deletingAnexo) return;
    const anexo = anexoToDelete;
    setDeletingAnexo(true);
    setAnexoToDelete(null);
    try {
      await supabase.from('frota_implemento_anexos').delete().eq('id', anexo.id);
      await supabase.storage.from('frota-documentos').remove([anexo.arquivo_path]);
      await registrarMovimento({
        implementoId: id,
        tipo: 'documento',
        descricao: `Removeu o documento ${anexo.arquivo_nome}`,
        criadoPor: user?.id || null,
      });
      toast.success('Documento removido.');
      loadAnexos();
      loadMovimentos();
    } finally {
      setDeletingAnexo(false);
    }
  };

  const handleAddObs = async () => {
    if (!id || !obsTexto.trim()) {
      toast.error('Campo obrigatório', 'Escreva a observação.');
      return;
    }
    setObsSaving(true);
    try {
      const err = await registrarMovimento({
        implementoId: id,
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

  if (!loading && !implemento) {
    return (
      <DashboardLayout pageTitle="Implemento não encontrado">
        <p className="frota-muted">Este implemento não existe ou foi removido.</p>
        <Button variant="secondary" onClick={() => navigate('/painel/frota/implementos')}>
          Voltar
        </Button>
      </DashboardLayout>
    );
  }

  const subtitle = implemento
    ? [implemento.implementadoraNome, formatMoney(implemento.valor)].filter(Boolean).join(' · ')
    : 'Carregando...';

  return (
    <DashboardLayout
      pageTitle={implemento?.nome || 'Carregando...'}
      pageSubtitle={subtitle}
      headerActions={
        <Button onClick={() => navigate('/painel/frota/implementos')} variant="secondary">
          <ArrowLeft size={18} style={{ marginRight: 6 }} />
          Voltar
        </Button>
      }
    >
      <div className="frota-detail-tabs">
        <Tabs
          tabs={[
            { key: 'dados', label: 'Dados' },
            {
              key: 'caminhao',
              label: 'Caminhão conectado',
              badge: acoplamento ? 1 : undefined,
            },
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
              <h3 className="frota-section-title">Implemento</h3>
              <p className="frota-section-desc">Cada gasto vira um implemento físico</p>
            </div>
            <div className="frota-section-fields">
              <Input
                label="Nome"
                required
                placeholder="Ex: Caçamba RODOTEC"
                value={form.nome}
                onChange={e => patchForm({ nome: e.target.value })}
              />
              <Select
                label="Implementadora"
                options={implementadoraOptions}
                value={form.implementadora}
                onChange={opt => patchForm({ implementadora: (opt as OptionType) || null })}
                isClearable
                placeholder="Selecione..."
              />
              <div className="frota-input-row">
                <InputNumber
                  label="Valor"
                  currency
                  value={form.valor}
                  onChange={val => patchForm({ valor: val })}
                />
                <Input
                  label="NF"
                  placeholder="Opcional"
                  value={form.nf}
                  onChange={e => patchForm({ nf: e.target.value })}
                />
              </div>
              <Textarea
                label="Observações"
                rows={3}
                value={form.observacoes}
                onChange={e => patchForm({ observacoes: e.target.value })}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="primary" onClick={handleSaveDados} loading={saving}>
                  Salvar dados
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && activeTab === 'caminhao' && (
        <div className="frota-detail-card">
          {acoplamento ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Placa</th>
                    <th>Modelo</th>
                    <th>Desde</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <button
                        type="button"
                        className="frota-link-btn"
                        onClick={() => navigate(`/painel/frota/${acoplamento.veiculoId}`)}
                      >
                        {acoplamento.placa || 'Ver caminhão'}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="frota-link-btn"
                        onClick={() => navigate(`/painel/frota/${acoplamento.veiculoId}`)}
                      >
                        {acoplamento.modeloTexto || '—'}
                      </button>
                    </td>
                    <td>{isoToBr(acoplamento.dataInicio)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <button
                          type="button"
                          className="action-btn action-btn-edit"
                          onClick={() => navigate(`/painel/frota/${acoplamento.veiculoId}`)}
                          title="Ver caminhão"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          className="action-btn action-btn-edit"
                          onClick={() =>
                            window.open(
                              `/painel/frota/${acoplamento.veiculoId}`,
                              '_blank',
                              'noopener,noreferrer'
                            )
                          }
                          title="Abrir caminhão em nova guia"
                        >
                          <ArrowSquareOut size={16} />
                        </button>
                        <button className="action-btn" onClick={handleDesacoplar} title="Desacoplar">
                          <LinkBreak size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="frota-section-fields" style={{ maxWidth: 480 }}>
              <p className="frota-muted" style={{ marginBottom: 'var(--spacing-16)' }}>
                Este implemento está livre. Selecione um caminhão para acoplar.
              </p>
              <Select
                label="Caminhão"
                options={truckOptions}
                value={selectedTruck}
                onChange={opt => setSelectedTruck((opt as OptionType) || null)}
                placeholder="Selecione a placa..."
              />
              <InputDate
                label="Data de início"
                value={coupleDate}
                onChange={val => setCoupleDate(typeof val === 'string' ? val : coupleDate)}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="primary" onClick={handleAcoplar} loading={coupling}>
                  Acoplar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && activeTab === 'documentos' && (
        <div className="frota-detail-card">
          <FileUpload
            label={uploading ? 'Enviando...' : 'Anexar documentos'}
            onFilesSelected={handleFilesSelected}
            disabled={uploading || tipoModalOpen}
            maxSize={10 * 1024 * 1024}
            accept="application/pdf,image/jpeg,image/png,image/webp,.doc,.docx"
          />
          <div className="table-container" style={{ marginTop: 'var(--spacing-24)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Tipo</th>
                  <th>Enviado em</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {anexos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        textAlign: 'center',
                        padding: 'var(--spacing-32)',
                        color: 'var(--color-grey-400)',
                      }}
                    >
                      Nenhum documento anexado.
                    </td>
                  </tr>
                ) : (
                  anexos.map(anexo => (
                    <tr key={anexo.id}>
                      <td>
                        <a
                          className="frota-link-btn"
                          href={anexo.signedUrl || anexo.arquivo_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <FileText size={16} /> {anexo.arquivo_nome}
                        </a>
                      </td>
                      <td>
                        <Badge variant="neutral">
                          {TIPO_DOCUMENTO_LABELS[anexo.tipo_documento] || anexo.tipo_documento}
                        </Badge>
                      </td>
                      <td>{formatDateTime(anexo.criado_em)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="action-btn action-btn-delete"
                          onClick={() => setAnexoToDelete(anexo)}
                          title="Excluir"
                        >
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
              placeholder="Registre um evento ou comentário sobre este implemento."
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
                <FrotaMovimentoItem key={mov.id} mov={mov} context="implemento" navigate={navigate} />
              ))
            )}
          </ul>
        </div>
      )}

      <Modal
        open={tipoModalOpen}
        onClose={cancelarAnexos}
        title="Tipo do documento"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={cancelarAnexos} disabled={uploading}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={confirmarAnexos}
              loading={uploading}
              disabled={!todosProntos}
            >
              Anexar
            </Button>
          </>
        }
      >
        {pendingAnexos.map((item, index) => (
          <div key={`${item.file.name}-${index}`} className="frota-anexo-tipo-row">
            <div className="frota-anexo-tipo-nome-input">
              <div className="frota-anexo-nome-field">
                <Input
                  placeholder="Nome do arquivo"
                  value={item.nomeBase}
                  onChange={e => atualizarNomePending(index, e.target.value)}
                />
                {item.ext && <span className="frota-anexo-ext">{item.ext}</span>}
              </div>
            </div>
            <div className="frota-anexo-tipo-select">
              <Select
                options={TIPO_DOCUMENTO_OPTIONS}
                value={item.tipo}
                onChange={opt => atualizarTipoPending(index, (opt as OptionType) || null)}
                placeholder="Selecione o tipo..."
              />
            </div>
            <button
              type="button"
              className="frota-anexo-tipo-remove"
              onClick={() => removerPendingAnexo(index)}
              title="Remover arquivo"
              aria-label="Remover arquivo"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </Modal>

      <ConfirmModal
        isOpen={!!anexoToDelete}
        onClose={() => setAnexoToDelete(null)}
        onConfirm={handleDeleteAnexo}
        loading={deletingAnexo}
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
