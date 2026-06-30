// pages/cotacoes/ItemImplementoModal.tsx — TOPE
// Modal Wizard de 3 passos: Categoria → Atributo → Opções
import { useState, useEffect } from 'react';
import { Wrench, CheckCircle } from '@phosphor-icons/react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface ImplementoAtributoEscolha {
  atributo_id: string;
  atributo_nome: string;
  opcao_id: string;
  opcao_nome: string;
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

interface Atributo {
  id: string;
  nome: string;
  categoria_id: string;
}

interface Opcao {
  id: string;
  nome: string;
  atributo_id: string;
  peso: number | null;
}

interface AtributoSelecionado {
  categoria_id: string;
  atributo_id: string;
}

interface OpcaoSelecionada {
  categoria_id: string;
  atributo_id: string;
  opcao_id: string;
}

interface ItemImplementoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (implementos: ImplementoEscolha[]) => void;
  itemDescricao: string;
  implementosIniciais: ImplementoEscolha[];
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function ItemImplementoModal({
  isOpen,
  onClose,
  onSave,
  itemDescricao,
  implementosIniciais,
}: ItemImplementoModalProps) {
  const toast = useToast();

  // Dados carregados do banco
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [atributos, setAtributos] = useState<Atributo[]>([]);
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingAttrs, setLoadingAttrs] = useState(false);
  const [loadingOpcoes, setLoadingOpcoes] = useState(false);

  // Estado do wizard
  const [passo, setPasso] = useState(1);

  // Passo 1: categorias selecionadas
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<string[]>([]);

  // Passo 2: atributos selecionados por categoria
  const [atributosSelecionados, setAtributosSelecionados] = useState<AtributoSelecionado[]>([]);

  // Passo 3: opções selecionadas por (categoria, atributo)
  const [opcoesSelecionadas, setOpcoesSelecionadas] = useState<OpcaoSelecionada[]>([]);

  // ── Buscar categorias ao abrir o modal ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    // Pré-preenche com dados iniciais
    if (implementosIniciais.length > 0) {
      const cats = implementosIniciais.map(i => i.categoria_id);
      setCategoriasSelecionadas(cats);

      const attrs: AtributoSelecionado[] = [];
      const opts: OpcaoSelecionada[] = [];
      for (const impl of implementosIniciais) {
        for (const attr of impl.atributos) {
          attrs.push({ categoria_id: impl.categoria_id, atributo_id: attr.atributo_id });
          opts.push({ categoria_id: impl.categoria_id, atributo_id: attr.atributo_id, opcao_id: attr.opcao_id });
        }
      }
      setAtributosSelecionados(attrs);
      setOpcoesSelecionadas(opts);
    } else {
      setCategoriasSelecionadas([]);
      setAtributosSelecionados([]);
      setOpcoesSelecionadas([]);
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

  // ── Buscar atributos ao avançar para passo 2 ────────────────────────────────
  useEffect(() => {
    if (passo !== 2 || categoriasSelecionadas.length === 0) { setAtributos([]); return; }
    setLoadingAttrs(true);
    supabase
      .from('atributos')
      .select('id, nome, categoria_id')
      .in('categoria_id', categoriasSelecionadas)
      .order('nome')
      .then(({ data, error }) => {
        setLoadingAttrs(false);
        if (error) { toast.error('Erro ao buscar atributos', error.message); return; }
        setAtributos(data || []);
      });
  }, [passo, categoriasSelecionadas]);

  // ── Buscar opções ao avançar para passo 3 ────────────────────────────────────
  useEffect(() => {
    if (passo !== 3 || atributosSelecionados.length === 0) { setOpcoes([]); return; }
    const attrIds = atributosSelecionados.map(a => a.atributo_id);
    setLoadingOpcoes(true);
    supabase
      .from('opcoes_atributos')
      .select('id, nome, atributo_id, peso')
      .in('atributo_id', attrIds)
      .order('nome')
      .then(({ data, error }) => {
        setLoadingOpcoes(false);
        if (error) { toast.error('Erro ao buscar opções', error.message); return; }
        setOpcoes(data || []);
      });
  }, [passo, atributosSelecionados]);

  // ─── Helpers de toggle ──────────────────────────────────────────────────────
  const toggleCategoria = (id: string) => {
    setCategoriasSelecionadas(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
    // Limpa atributos e opções da categoria desmarcada
    setAtributosSelecionados(prev => prev.filter(a => a.categoria_id !== id));
    setOpcoesSelecionadas(prev => prev.filter(o => o.categoria_id !== id));
  };

  const toggleAtributo = (categoria_id: string, atributo_id: string) => {
    const key = { categoria_id, atributo_id };
    const exists = atributosSelecionados.some(a => a.categoria_id === categoria_id && a.atributo_id === atributo_id);
    if (exists) {
      setAtributosSelecionados(prev => prev.filter(a => !(a.categoria_id === categoria_id && a.atributo_id === atributo_id)));
      setOpcoesSelecionadas(prev => prev.filter(o => !(o.categoria_id === categoria_id && o.atributo_id === atributo_id)));
    } else {
      setAtributosSelecionados(prev => [...prev, key]);
    }
  };

  const setOpcao = (categoria_id: string, atributo_id: string, opcao_id: string) => {
    setOpcoesSelecionadas(prev => {
      const outros = prev.filter(o => !(o.categoria_id === categoria_id && o.atributo_id === atributo_id));
      return [...outros, { categoria_id, atributo_id, opcao_id }];
    });
  };

  // ─── Navegar entre passos ───────────────────────────────────────────────────
  const handleProximo = () => {
    if (passo === 1) {
      if (categoriasSelecionadas.length === 0) {
        toast.warning('Selecione ao menos uma categoria', 'Escolha ao menos uma categoria de implemento para continuar.');
        return;
      }
      setPasso(2);
    } else if (passo === 2) {
      if (atributosSelecionados.length === 0) {
        toast.warning('Selecione ao menos um atributo', 'Escolha ao menos um atributo por categoria para continuar.');
        return;
      }
      setPasso(3);
    }
  };

  const handleAnterior = () => {
    if (passo > 1) setPasso(p => p - 1);
  };

  // ─── Salvar ─────────────────────────────────────────────────────────────────
  const handleDefinir = () => {
    // Verifica se todas as opções foram preenchidas
    for (const attr of atributosSelecionados) {
      const temOpcao = opcoesSelecionadas.some(
        o => o.categoria_id === attr.categoria_id && o.atributo_id === attr.atributo_id
      );
      if (!temOpcao) {
        const attrNome = atributos.find(a => a.id === attr.atributo_id)?.nome || '';
        const catNome = categorias.find(c => c.id === attr.categoria_id)?.nome || '';
        toast.warning('Opção não selecionada', `Selecione uma opção para o atributo "${attrNome}" de "${catNome}".`);
        return;
      }
    }

    // Constrói a árvore de escolhas
    const resultado: ImplementoEscolha[] = categoriasSelecionadas.map(catId => {
      const cat = categorias.find(c => c.id === catId)!;
      const attrsDestaCategoria = atributosSelecionados.filter(a => a.categoria_id === catId);
      return {
        categoria_id: catId,
        categoria_nome: cat.nome,
        atributos: attrsDestaCategoria.map(attr => {
          const attrObj = atributos.find(a => a.id === attr.atributo_id)!;
          const opcSel = opcoesSelecionadas.find(o => o.categoria_id === catId && o.atributo_id === attr.atributo_id)!;
          const opcObj = opcoes.find(o => o.id === opcSel.opcao_id)!;
          return {
            atributo_id: attr.atributo_id,
            atributo_nome: attrObj?.nome || '',
            opcao_id: opcSel.opcao_id,
            opcao_nome: opcObj?.nome || '',
            peso: opcObj?.peso ? Number(opcObj.peso) : 0,
          };
        }),
      };
    });

    onSave(resultado);
    onClose();
  };

  // ─── Indicador de progresso ────────────────────────────────────────────────
  const StepIndicator = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
      {[
        { num: 1, label: 'Categoria', sub: 'Defina as categorias' },
        { num: 2, label: 'Atributo', sub: 'Defina os atributos' },
        { num: 3, label: 'Opções', sub: 'Defina as variações' },
      ].map((step, i) => (
        <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600,
              backgroundColor: passo > step.num ? 'var(--color-primary)' : passo === step.num ? 'var(--color-primary)' : '#e2e8f0',
              color: passo >= step.num ? '#fff' : 'var(--color-grey-500)',
              border: passo >= step.num ? 'none' : '1.5px solid #e2e8f0',
              flexShrink: 0,
            }}>
              {passo > step.num ? <CheckCircle size={16} weight="fill" /> : step.num}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: passo >= step.num ? 'var(--color-grey-800)' : 'var(--color-grey-400)' }}>
                {step.label}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--color-grey-400)' }}>{step.sub}</div>
            </div>
          </div>
          {i < 2 && (
            <div style={{ flex: 1, height: '2px', backgroundColor: passo > step.num ? 'var(--color-primary)' : '#e2e8f0', marginBottom: '22px' }} />
          )}
        </div>
      ))}
    </div>
  );

  // ─── Renderização dos passos ────────────────────────────────────────────────
  const renderPasso1 = () => (
    <div>
      {loadingCats ? (
        <p style={{ color: 'var(--color-grey-500)', textAlign: 'center', padding: '20px' }}>Carregando categorias...</p>
      ) : (
        <div style={{
          border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)',
          padding: '4px', minHeight: '48px', display: 'flex', flexWrap: 'wrap', gap: '6px',
          cursor: 'text', backgroundColor: '#fff'
        }}>
          {categoriasSelecionadas.map(catId => {
            const cat = categorias.find(c => c.id === catId);
            return (
              <span key={catId} style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0',
                borderRadius: '4px', padding: '4px 10px', fontSize: '13px',
                color: 'var(--color-grey-800)', fontWeight: 500,
              }}>
                × {cat?.nome}
                <button type="button" onClick={() => toggleCategoria(catId)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 4px', lineHeight: 1, color: 'var(--color-grey-500)', fontSize: '14px' }}>
                  ×
                </button>
              </span>
            );
          })}
          <div style={{ position: 'relative', flex: 1 }}>
            <select
              style={{
                width: '100%', minWidth: '120px', border: 'none', outline: 'none',
                fontSize: '14px', padding: '8px', backgroundColor: 'transparent',
                color: 'var(--color-grey-600)', cursor: 'pointer',
              }}
              value=""
              onChange={e => { if (e.target.value) toggleCategoria(e.target.value); }}
            >
              <option value="">
                {categoriasSelecionadas.length === 0 ? 'Categoria' : 'Adicionar outra...'}
              </option>
              {categorias
                .filter(c => !categoriasSelecionadas.includes(c.id))
                .map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );

  const renderPasso2 = () => (
    <div>
      {loadingAttrs ? (
        <p style={{ color: 'var(--color-grey-500)', textAlign: 'center', padding: '20px' }}>Carregando atributos...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>Categoria</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>Atributos</th>
            </tr>
          </thead>
          <tbody>
            {categoriasSelecionadas.map(catId => {
              const cat = categorias.find(c => c.id === catId);
              const attrsDesaCat = atributos.filter(a => a.categoria_id === catId);
              const attrsSel = atributosSelecionados.filter(a => a.categoria_id === catId).map(a => a.atributo_id);
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
                      {attrsSel.map(attrId => {
                        const attr = attrsDesaCat.find(a => a.id === attrId);
                        return (
                          <span key={attrId} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0',
                            borderRadius: '4px', padding: '4px 10px', fontSize: '13px',
                            color: 'var(--color-grey-800)', fontWeight: 500,
                          }}>
                            × {attr?.nome}
                            <button type="button" onClick={() => toggleAtributo(catId, attrId)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 4px', lineHeight: 1, color: 'var(--color-grey-500)', fontSize: '14px' }}>
                              ×
                            </button>
                          </span>
                        );
                      })}
                      <select
                        value=""
                        onChange={e => { if (e.target.value) toggleAtributo(catId, e.target.value); }}
                        style={{
                          border: 'none', outline: 'none', fontSize: '14px',
                          padding: '6px', backgroundColor: 'transparent', color: 'var(--color-grey-600)', cursor: 'pointer',
                          flex: 1, minWidth: '100px'
                        }}
                      >
                        <option value="">{attrsSel.length === 0 ? 'Selecionar atributo...' : 'Adicionar outro...'}</option>
                        {attrsDesaCat
                          .filter(a => !attrsSel.includes(a.id))
                          .map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                      </select>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderPasso3 = () => (
    <div>
      {loadingOpcoes ? (
        <p style={{ color: 'var(--color-grey-500)', textAlign: 'center', padding: '20px' }}>Carregando opções...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>Categoria</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)', paddingLeft: '50px' }}>Opção</th>
            </tr>
          </thead>
          <tbody>
            {categoriasSelecionadas.map(catId => {
              const cat = categorias.find(c => c.id === catId);
              const attrsDesaCat = atributosSelecionados.filter(a => a.categoria_id === catId);
              return attrsDesaCat.map(({ atributo_id }) => {
                const attr = atributos.find(a => a.id === atributo_id);
                const opcoesDoAttr = opcoes.filter(o => o.atributo_id === atributo_id);
                const opcSel = opcoesSelecionadas.find(o => o.categoria_id === catId && o.atributo_id === atributo_id);
                return (
                  <tr key={`${catId}-${atributo_id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontSize: '13px', color: 'var(--color-grey-700)', fontWeight: 500, verticalAlign: 'middle', width: '35%' }}>
                      {cat?.nome}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <select
                        value={opcSel?.opcao_id || ''}
                        onChange={e => setOpcao(catId, atributo_id, e.target.value)}
                        style={{
                          width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-md)',
                          border: '1px solid #e2e8f0', fontSize: '14px',
                          color: 'var(--color-grey-800)', backgroundColor: '#fff',
                          outline: 'none', cursor: 'pointer',
                        }}
                      >
                        <option value="">{attr?.nome}</option>
                        {opcoesDoAttr.map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
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
              color: 'var(--color-grey-500)', fontSize: '14px', padding: '8px 0'
            }}>
            <span style={{ width: '14px', height: '14px', border: '1.5px solid var(--color-grey-400)', borderRadius: '2px', display: 'inline-block' }} />
            Anterior
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
        {passo < 3 ? (
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
        {passo === 3 && renderPasso3()}
      </div>
    </Modal>
  );
}
