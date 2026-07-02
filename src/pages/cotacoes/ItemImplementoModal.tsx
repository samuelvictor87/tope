// pages/cotacoes/ItemImplementoModal.tsx — TOPE
// Modal Wizard de 2 passos: Categoria → Modelo
import { useState, useEffect } from 'react';
import { Wrench, CheckCircle, ArrowLeft } from '@phosphor-icons/react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import type { OptionType } from '../../components/ui/Select';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import type { TipoUsoDepreciacao } from '../../types/configuracoes.types';

// ─── Helpers de máscara de moeda ──────────────────────────────────────────────
function formatCurrencyMask(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const number = parseInt(digits, 10) / 100;
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseCurrencyMask(formatted: string): number {
  const digits = formatted.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface ImplementoAtributoEscolha {
  atributo_id: string;
  atributo_nome: string;
  peso: number;
}

export interface ImplementoEscolha {
  categoria_id: string;
  categoria_nome: string;
  atributos: ImplementoAtributoEscolha[];
}

interface Categoria {
  id: string;
  nome: string;
}

interface Modelo {
  id: string;
  nome: string;
  categoria_id: string;
  valor: number | null;
}

interface ModeloSelecionado {
  categoria_id: string;
  atributo_id: string;
}

interface ItemImplementoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (implementos: ImplementoEscolha[], tipoUso: TipoUsoDepreciacao, valor: number) => void;
  itemDescricao: string;
  implementosIniciais: ImplementoEscolha[];
  tipoUsoInicial: TipoUsoDepreciacao | null;
  valorInicial: number | null;
}

// Opções de tipo de uso no padrão do Select do projeto
const TIPO_USO_OPTIONS: OptionType[] = [
  { value: 'Leve/Moderado', label: 'Leve/Moderado' },
  { value: 'Severo', label: 'Severo' },
];

// ─── Componente ───────────────────────────────────────────────────────────────
export function ItemImplementoModal({
  isOpen,
  onClose,
  onSave,
  itemDescricao,
  implementosIniciais,
  tipoUsoInicial,
  valorInicial,
}: ItemImplementoModalProps) {
  const toast = useToast();

  // Dados carregados do banco
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingModelos, setLoadingModelos] = useState(false);

  // Estado do wizard
  const [passo, setPasso] = useState(1);

  // Passo 1: categorias selecionadas
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>([]);

  // Passo 2: modelos selecionados por categoria
  const [modelosSelecionados, setModelosSelecionados] = useState<ModeloSelecionado[]>([]);

  // Campos adicionais
  const [implementoTipoUso, setImplementoTipoUso] = useState<OptionType>(TIPO_USO_OPTIONS[0]);
  const [implementoValor, setImplementoValor] = useState('');

  // ── Buscar categorias ao abrir o modal ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    // Pré-preenche com dados iniciais
    const tipoInicial = tipoUsoInicial
      ? TIPO_USO_OPTIONS.find(o => o.value === tipoUsoInicial) || TIPO_USO_OPTIONS[0]
      : TIPO_USO_OPTIONS[0];
    setImplementoTipoUso(tipoInicial);

    if (valorInicial !== null && valorInicial !== undefined && valorInicial > 0) {
      const digits = Math.round(valorInicial * 100).toString();
      setImplementoValor(formatCurrencyMask(digits));
    } else {
      setImplementoValor('');
    }

    if (implementosIniciais.length > 0) {
      const cats = implementosIniciais.map(i => i.categoria_id);
      setCategoriasSelecionadas(cats);

      const sels: ModeloSelecionado[] = [];
      for (const impl of implementosIniciais) {
        for (const attr of impl.atributos) {
          sels.push({ categoria_id: impl.categoria_id, atributo_id: attr.atributo_id });
        }
      }
      setModelosSelecionados(sels);
    } else {
      setCategoriasSelecionadas([]);
      setModelosSelecionados([]);
    }
    setPasso(1);

    setLoadingCats(true);
    supabase
      .from('implemento_categorias')
      .select('id, nome')
      .order('nome')
      .then(({ data, error }) => {
        setLoadingCats(false);
        if (error) { toast.error('Erro ao buscar categorias', error.message); return; }
        setCategorias(data || []);
      });
  }, [isOpen]);

  // ── Buscar modelos ao avançar para passo 2 ──────────────────────────────────
  useEffect(() => {
    if (passo !== 2 || categoriasSelecionadas.length === 0) { setModelos([]); return; }
    setLoadingModelos(true);
    supabase
      .from('modelos')
      .select('id, nome, categoria_id, valor')
      .in('categoria_id', categoriasSelecionadas)
      .order('nome')
      .then(({ data, error }) => {
        setLoadingModelos(false);
        if (error) { toast.error('Erro ao buscar modelos', error.message); return; }
        setModelos(data || []);
      });
  }, [passo, categoriasSelecionadas]);

  // ── Quando um modelo é selecionado, preencher o valor automaticamente ────────
  const handleToggleModelo = (categoriaId: string, modeloId: string) => {
    setModelosSelecionados(prev => {
      const existe = prev.some(a => a.categoria_id === categoriaId && a.atributo_id === modeloId);
      if (existe) {
        return prev.filter(a => !(a.categoria_id === categoriaId && a.atributo_id === modeloId));
      }
      // Ao adicionar: preenche o valor se ainda estiver vazio
      const modeloSelecionado = modelos.find(m => m.id === modeloId);
      if (modeloSelecionado?.valor && !implementoValor) {
        const digits = Math.round(modeloSelecionado.valor * 100).toString();
        setImplementoValor(formatCurrencyMask(digits));
      }
      return [...prev, { categoria_id: categoriaId, atributo_id: modeloId }];
    });
  };

  // ── Modificar seleção de categorias ─────────────────────────────────────────
  const toggleCategoria = (id: string) => {
    setCategoriasSelecionadas(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  // ── Wizard Navegação ────────────────────────────────────────────────────────
  const handleProximo = () => {
    if (passo === 1) {
      if (categoriasSelecionadas.length === 0) {
        toast.warning('Selecione uma categoria', 'Selecione ao menos uma categoria de implemento para continuar.');
        return;
      }
      setPasso(2);
    }
  };

  const handleAnterior = () => {
    if (passo > 1) setPasso(p => p - 1);
  };

  // ─── Salvar ─────────────────────────────────────────────────────────────────
  const handleDefinir = () => {
    if (modelosSelecionados.length === 0) {
      toast.warning('Selecione ao menos um modelo', 'Escolha ao menos um modelo por categoria para continuar.');
      return;
    }

    // Constrói a árvore de escolhas
    const resultado: ImplementoEscolha[] = categoriasSelecionadas.map(catId => {
      const cat = categorias.find(c => c.id === catId)!;
      const modelosDessaCategoria = modelosSelecionados.filter(a => a.categoria_id === catId);
      return {
        categoria_id: catId,
        categoria_nome: cat.nome,
        atributos: modelosDessaCategoria.map(sel => {
          const modeloObj = modelos.find(a => a.id === sel.atributo_id)!;
          return {
            atributo_id: sel.atributo_id,
            atributo_nome: modeloObj?.nome || '',
            peso: 0,
          };
        }),
      };
    });

    const val = parseCurrencyMask(implementoValor);
    onSave(resultado, implementoTipoUso.value as TipoUsoDepreciacao, val);
    onClose();
  };

  // ─── Indicador de progresso ────────────────────────────────────────────────
  const StepIndicator = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
      {[
        { num: 1, label: 'Categoria', sub: 'Defina as categorias' },
        { num: 2, label: 'Modelo', sub: 'Defina os modelos' },
      ].map((step, i) => (
        <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600,
              backgroundColor: passo === step.num ? 'var(--color-primary)' : passo > step.num ? 'rgba(249,115,22,0.1)' : '#f1f5f9',
              color: passo === step.num ? '#fff' : passo > step.num ? 'var(--color-primary)' : 'var(--color-grey-500)',
              border: passo === step.num ? 'none' : '1px solid',
              borderColor: passo > step.num ? 'var(--color-primary)' : '#e2e8f0',
            }}>
              {passo > step.num ? <CheckCircle size={16} weight="fill" /> : step.num}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: passo === step.num ? 'var(--color-grey-800)' : 'var(--color-grey-500)' }}>
              {step.label}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--color-grey-400)' }}>
              {step.sub}
            </span>
          </div>
          {i < 1 && (
            <div style={{
              flex: 1, height: '2px', marginLeft: '12px', marginRight: '4px',
              backgroundColor: passo > step.num ? 'var(--color-primary)' : '#e2e8f0',
            }} />
          )}
        </div>
      ))}
    </div>
  );

  // ─── Renderizadores de Passos ──────────────────────────────────────────────
  const renderPasso1 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {loadingCats ? (
        <p style={{ color: 'var(--color-grey-500)', textAlign: 'center', padding: '20px' }}>Carregando categorias...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
          {categorias.map(cat => {
            const isSelected = categoriasSelecionadas.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategoria(cat.id)}
                style={{
                  padding: '12px 16px', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', border: '1px solid', textAlign: 'center',
                  borderColor: isSelected ? 'var(--color-primary)' : '#e2e8f0',
                  backgroundColor: isSelected ? 'rgba(249,115,22,0.06)' : '#fff',
                  color: isSelected ? 'var(--color-primary)' : 'var(--color-grey-700)',
                  transition: 'all 0.15s',
                }}
              >
                {cat.nome}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderPasso2 = () => (
    <div>
      {loadingModelos ? (
        <p style={{ color: 'var(--color-grey-500)', textAlign: 'center', padding: '20px' }}>Carregando modelos...</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>Categoria</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>Modelos</th>
              </tr>
            </thead>
            <tbody>
              {categoriasSelecionadas.map(catId => {
                const cat = categorias.find(c => c.id === catId);
                const modelosDessaCat = modelos.filter(a => a.categoria_id === catId);
                const modelosSel = modelosSelecionados.filter(a => a.categoria_id === catId).map(a => a.atributo_id);
                return (
                  <tr key={catId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontSize: '13px', color: 'var(--color-grey-700)', fontWeight: 500, verticalAlign: 'top', width: '35%' }}>
                      {cat?.nome}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{
                        border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)',
                        padding: '4px', minHeight: '44px', display: 'flex', flexWrap: 'wrap', gap: '6px',
                        backgroundColor: '#fff',
                      }}>
                        {modelosSel.map(modeloId => {
                          const modelo = modelosDessaCat.find(a => a.id === modeloId);
                          return (
                            <span key={modeloId} style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0',
                              borderRadius: '4px', padding: '4px 10px', fontSize: '13px',
                              color: 'var(--color-grey-800)', fontWeight: 500,
                            }}>
                              {modelo?.nome}
                              <button type="button" onClick={() => handleToggleModelo(catId, modeloId)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 4px', lineHeight: 1, color: 'var(--color-grey-500)', fontSize: '14px' }}>
                                ×
                              </button>
                            </span>
                          );
                        })}
                        <select
                          value=""
                          onChange={e => { if (e.target.value) handleToggleModelo(catId, e.target.value); }}
                          style={{
                            border: 'none', outline: 'none', fontSize: '14px',
                            padding: '6px', backgroundColor: 'transparent', color: 'var(--color-grey-600)', cursor: 'pointer',
                            flex: 1, minWidth: '100px'
                          }}
                        >
                          <option value="">{modelosSel.length === 0 ? 'Selecionar modelo...' : 'Adicionar outro...'}</option>
                          {modelosDessaCat
                            .filter(a => !modelosSel.includes(a.id))
                            .map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Parâmetros para cálculo de depreciação de implemento */}
          <div style={{
            padding: '12px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 'var(--radius-md)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginTop: '16px'
          }}>
            {/* Tipo de uso — Select no padrão do projeto */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-grey-700)', display: 'block', marginBottom: '6px' }}>
                Tipo de uso do implemento (Depreciação)
              </label>
              <Select
                options={TIPO_USO_OPTIONS}
                value={implementoTipoUso}
                onChange={opt => { if (opt) setImplementoTipoUso(opt as OptionType); }}
                placeholder="Selecione..."
              />
            </div>

            {/* Valor — com máscara de moeda */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-grey-700)', display: 'block', marginBottom: '6px' }}>
                Valor de aquisição do implemento (R$)
              </label>
              <input
                type="text"
                value={implementoValor}
                onChange={e => setImplementoValor(formatCurrencyMask(e.target.value))}
                placeholder="R$ 0,00"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                  border: '1px solid #e2e8f0', fontSize: '13px', color: 'var(--color-grey-800)',
                  backgroundColor: '#fff', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ─── Footer dos passos ──────────────────────────────────────────────────────
  const renderFooter = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      <div>
        {passo > 1 && (
          <button type="button" onClick={handleAnterior}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-grey-500)', fontSize: '14px', padding: '8px 0',
              fontWeight: 500,
            }}>
            <ArrowLeft size={16} weight="bold" />
            Anterior
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        {passo < 2 ? (
          <button type="button" onClick={handleProximo}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-primary)', fontWeight: 600, fontSize: '14px'
            }}>
            Próximo →
          </button>
        ) : (
          <Button variant="primary" size="sm" onClick={handleDefinir}>Definir</Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="md"
      footer={renderFooter()}
    >
      {/* Cabeçalho personalizado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          backgroundColor: 'rgba(249,115,22,0.1)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Wrench size={24} color="var(--color-primary)" />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--color-grey-900)' }}>
            Definir implementos
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-grey-600)' }}>
            Atenção: você está prestes a definir{' '}
            <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>os implementos</span>{' '}
            para o{' '}
            <span style={{ color: 'var(--color-primary)', fontWeight: 600, fontStyle: 'italic' }}>
              item da cotação: {itemDescricao}
            </span>
          </p>
        </div>
      </div>

      <StepIndicator />

      <div style={{
        border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)',
        padding: '16px', backgroundColor: '#fff', minHeight: '120px',
      }}>
        {passo === 1 && renderPasso1()}
        {passo === 2 && renderPasso2()}
      </div>
    </Modal>
  );
}
