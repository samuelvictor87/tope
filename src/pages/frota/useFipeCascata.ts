import { useCallback, useState } from 'react';
import type { OptionType } from '../../components/ui/Select';
import {
  consultarValorFipe,
  fipeOptionsToSelect,
  listarAnosFipe,
  listarMarcasFipe,
  listarModelosFipe,
  parseAnoFipe,
  parseValorFipe,
  type FipeTipoVeiculo,
  type FipeValor,
} from '../../services/fipeService';

export interface FipeSnapshot {
  tipo: FipeTipoVeiculo;
  marca: OptionType | null;
  ano: OptionType | null;
  modelo: OptionType | null;
  valor: number | null;
  codigoFipe: string;
  combustivel: string;
  mesReferencia: string;
}

const emptySnapshot: FipeSnapshot = {
  tipo: 'caminhao',
  marca: null,
  ano: null,
  modelo: null,
  valor: null,
  codigoFipe: '',
  combustivel: '',
  mesReferencia: '',
};

export function useFipeCascata(onError: (title: string, message: string) => void) {
  const [tipo, setTipo] = useState<OptionType | null>(null);
  const [marca, setMarca] = useState<OptionType | null>(null);
  const [ano, setAno] = useState<OptionType | null>(null);
  const [modelo, setModelo] = useState<OptionType | null>(null);
  const [valor, setValor] = useState<number | null>(null);
  const [valorDetalhe, setValorDetalhe] = useState<FipeValor | null>(null);

  const [marcaOpcoes, setMarcaOpcoes] = useState<OptionType[]>([]);
  const [anoOpcoes, setAnoOpcoes] = useState<OptionType[]>([]);
  const [modeloOpcoes, setModeloOpcoes] = useState<OptionType[]>([]);

  const [loadingMarcas, setLoadingMarcas] = useState(false);
  const [loadingAnos, setLoadingAnos] = useState(false);
  const [loadingModelos, setLoadingModelos] = useState(false);
  const [loadingValor, setLoadingValor] = useState(false);
  const [touched, setTouched] = useState(false);

  const tipoSlug = (tipo?.value === 'carro' ? 'carro' : 'caminhao') as FipeTipoVeiculo;

  const resetFilhosMarca = () => {
    setMarca(null);
    setAno(null);
    setModelo(null);
    setValor(null);
    setValorDetalhe(null);
    setAnoOpcoes([]);
    setModeloOpcoes([]);
  };

  const resetFilhosAno = () => {
    setAno(null);
    setModelo(null);
    setValor(null);
    setValorDetalhe(null);
    setModeloOpcoes([]);
  };

  const resetFilhosModelo = () => {
    setModelo(null);
    setValor(null);
    setValorDetalhe(null);
  };

  const handleTipoChange = useCallback(
    async (opt: OptionType | null) => {
      setTipo(opt);
      setTouched(true);
      resetFilhosMarca();
      setMarcaOpcoes([]);
      if (!opt?.value) return;
      setLoadingMarcas(true);
      try {
        const marcas = await listarMarcasFipe(opt.value as FipeTipoVeiculo);
        setMarcaOpcoes(fipeOptionsToSelect(marcas));
      } catch (err) {
        onError('FIPE', err instanceof Error ? err.message : 'Erro ao buscar marcas.');
        setMarcaOpcoes([]);
      } finally {
        setLoadingMarcas(false);
      }
    },
    [onError]
  );

  const handleMarcaChange = useCallback(
    async (opt: OptionType | null) => {
      setMarca(opt);
      setTouched(true);
      resetFilhosAno();
      if (!opt?.value || !tipo?.value) return;
      setLoadingAnos(true);
      try {
        const anos = await listarAnosFipe(tipoSlug, opt.value);
        setAnoOpcoes(fipeOptionsToSelect(anos, 'ano'));
      } catch (err) {
        onError('FIPE', err instanceof Error ? err.message : 'Erro ao buscar anos.');
        setAnoOpcoes([]);
      } finally {
        setLoadingAnos(false);
      }
    },
    [onError, tipo?.value, tipoSlug]
  );

  const handleAnoChange = useCallback(
    async (opt: OptionType | null) => {
      setAno(opt);
      setTouched(true);
      resetFilhosModelo();
      if (!opt?.value || !tipo?.value || !marca?.value) return;
      setLoadingModelos(true);
      try {
        const modelos = await listarModelosFipe(tipoSlug, marca.value, opt.value);
        setModeloOpcoes(fipeOptionsToSelect(modelos));
      } catch (err) {
        onError('FIPE', err instanceof Error ? err.message : 'Erro ao buscar modelos.');
        setModeloOpcoes([]);
      } finally {
        setLoadingModelos(false);
      }
    },
    [onError, tipo?.value, marca?.value, tipoSlug]
  );

  const handleModeloChange = useCallback(
    async (opt: OptionType | null) => {
      setModelo(opt);
      setTouched(true);
      setValor(null);
      setValorDetalhe(null);
      if (!opt?.value || !tipo?.value || !marca?.value || !ano?.value) return;
      setLoadingValor(true);
      try {
        const detalhe = await consultarValorFipe(tipoSlug, marca.value, opt.value, ano.value);
        setValorDetalhe(detalhe);
        setValor(parseValorFipe(detalhe.Valor));
      } catch (err) {
        onError('FIPE', err instanceof Error ? err.message : 'Erro ao consultar o valor FIPE.');
      } finally {
        setLoadingValor(false);
      }
    },
    [onError, tipo?.value, marca?.value, ano?.value, tipoSlug]
  );

  const hydrateSnapshot = (snap: Partial<FipeSnapshot>) => {
    setTouched(false);
    if (snap.tipo) setTipo({ value: snap.tipo, label: snap.tipo === 'carro' ? 'Carro' : 'Caminhão' });
    if (snap.marca) {
      setMarca(snap.marca);
      setMarcaOpcoes(prev => (prev.some(o => o.value === snap.marca!.value) ? prev : [snap.marca!, ...prev]));
    }
    if (snap.ano) {
      setAno(snap.ano);
      setAnoOpcoes(prev => (prev.some(o => o.value === snap.ano!.value) ? prev : [snap.ano!, ...prev]));
    }
    if (snap.modelo) {
      setModelo(snap.modelo);
      setModeloOpcoes(prev => (prev.some(o => o.value === snap.modelo!.value) ? prev : [snap.modelo!, ...prev]));
    }
    if (snap.valor != null) setValor(snap.valor);
  };

  const resetAll = () => {
    setTouched(false);
    setTipo(null);
    resetFilhosMarca();
    setMarcaOpcoes([]);
  };

  const snapshot: FipeSnapshot = {
    tipo: tipoSlug,
    marca,
    ano,
    modelo,
    valor,
    codigoFipe: valorDetalhe?.CodigoFipe || '',
    combustivel: valorDetalhe?.Combustivel || '',
    mesReferencia: valorDetalhe?.MesReferencia || '',
  };

  const anoModeloNumero = ano ? parseAnoFipe(ano.value).anoModelo : null;
  const completo = !!(tipo && marca && ano && modelo);

  return {
    tipo,
    marca,
    ano,
    modelo,
    valor,
    valorDetalhe,
    marcaOpcoes,
    anoOpcoes,
    modeloOpcoes,
    loadingMarcas,
    loadingAnos,
    loadingModelos,
    loadingValor,
    handleTipoChange,
    handleMarcaChange,
    handleAnoChange,
    handleModeloChange,
    hydrateSnapshot,
    resetAll,
    snapshot,
    anoModeloNumero,
    completo,
    touched,
    emptySnapshot,
  };
}
