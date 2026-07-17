// utils/financialUtils.ts — TOPE
// Funções financeiras puras: VPL, TIR, Goal Seek via template Excel
import JSZip from 'jszip';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface TemplateData {
  flowsCache: number[];     // Fluxo líquido por mês (linha 63 da aba Cashflow)
  rentasCache: number[];    // Aluguel por mês (linha 28)
  financCache: number[];    // Financiamento por mês (linha 11)
  precoCache: number;       // Preço mensal do template (H66)
  nMeses: number;           // Último mês com dados + 1
}

export interface GoalSeekParams {
  templateData: TemplateData;
  tmaAnual: number;                // TMA anual (ex: 0.30 = 30%)
  parcelaMensal: number;           // Parcela PRICE calculada
  prazoFinanciamento: number;      // Prazo do financiamento em meses
  valorLiquidoFinalVenda: number;  // Valor líquido final da alienação
}

export interface CashFlowDisplayEntry {
  mes: number;
  fluxoLiquido: number;
  acumulado: number;
  aluguelBruto: number;     // Aluguel bruto (antes de tributos)
  custos: number;           // Total de custos (negativo)
}

export interface GoalSeekResult {
  precoMensalAluguel: number;
  vpl: number;
  tirMensal: number | null;
  tmaMensal: number;
  cashFlowDisplay: CashFlowDisplayEntry[];
}

// ─── Funções Financeiras Puras ──────────────────────────────────────────────

/**
 * Calcula o Valor Presente Líquido (VPL / NPV).
 * Usa a convenção do Excel: o primeiro valor é descontado por (1+rate)^1.
 * 
 * @param rate  Taxa de desconto por período (ex: TMA mensal)
 * @param cashFlows  Array de fluxos de caixa [CF0, CF1, CF2, ...]
 * @returns VPL calculado
 */
export function calcNPV(rate: number, cashFlows: number[]): number {
  let npv = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    npv += cashFlows[t] / Math.pow(1 + rate, t + 1);
  }
  return npv;
}

/**
 * Calcula a Taxa Interna de Retorno (TIR / IRR) via Newton-Raphson.
 * 
 * @param cashFlows  Array de fluxos de caixa (deve ter pelo menos 1 positivo e 1 negativo)
 * @param guess      Chute inicial (default: 0.1 = 10%)
 * @returns Taxa que zera o VPL, ou null se não convergir
 */
export function calcIRR(cashFlows: number[], guess: number = 0.1): number | null {
  const MAX_ITER = 100;
  const TOLERANCE = 1e-10;

  let rate = guess;

  for (let i = 0; i < MAX_ITER; i++) {
    let npv = 0;
    let dnpv = 0; // derivada

    for (let t = 0; t < cashFlows.length; t++) {
      const factor = Math.pow(1 + rate, t + 1);
      npv += cashFlows[t] / factor;
      dnpv -= (t + 1) * cashFlows[t] / (factor * (1 + rate));
    }

    if (Math.abs(dnpv) < 1e-14) return null; // derivada muito pequena

    const newRate = rate - npv / dnpv;

    if (Math.abs(newRate - rate) < TOLERANCE) {
      return newRate;
    }

    rate = newRate;

    // Evitar rates impossíveis
    if (rate < -0.99) rate = -0.99;
    if (rate > 10) rate = 10;
  }

  return null; // não convergiu
}

// ─── Utilitários XML ────────────────────────────────────────────────────────

/**
 * Lê o valor numérico de uma célula no XML da aba Excel.
 */
export function lerCelulaXml(xml: string, ref: string): number {
  const cellRegex = new RegExp(
    `<c\\s+r="${ref}"[^>]*(?<!/)>([\\s\\S]*?)</c>`
  );
  const cellMatch = xml.match(cellRegex);
  if (!cellMatch) return 0;
  const vMatch = cellMatch[1].match(/<v>([^<]*)<\/v>/);
  return vMatch ? parseFloat(vMatch[1]) : 0;
}

/**
 * Localiza e lê o XML de uma aba pelo nome dentro do ZIP do Excel.
 */
export async function resolverAbaNoZip(
  zip: JSZip,
  nomeAba: string
): Promise<{ xml: string; path: string } | null> {
  const workbookXmlStr = await zip.file('xl/workbook.xml')?.async('string');
  if (!workbookXmlStr) return null;

  const wbDoc = new DOMParser().parseFromString(workbookXmlStr, 'application/xml');
  const sheets = wbDoc.getElementsByTagName('sheet');
  let rId = '';
  for (let i = 0; i < sheets.length; i++) {
    if (sheets[i].getAttribute('name') === nomeAba) {
      rId = sheets[i].getAttribute('r:id') ||
        sheets[i].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || '';
      break;
    }
  }
  if (!rId) return null;

  const relsXmlStr = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  if (!relsXmlStr) return null;

  const relsDoc = new DOMParser().parseFromString(relsXmlStr, 'application/xml');
  const rels = relsDoc.getElementsByTagName('Relationship');
  let sheetPath = '';
  for (let i = 0; i < rels.length; i++) {
    if (rels[i].getAttribute('Id') === rId) {
      sheetPath = 'xl/' + rels[i].getAttribute('Target');
      break;
    }
  }
  if (!sheetPath) return null;

  const sheetXml = await zip.file(sheetPath)?.async('string');
  return sheetXml ? { xml: sheetXml, path: sheetPath } : null;
}

/**
 * Substitui o valor de uma célula no XML da aba Excel.
 */
export function substituirValorCelula(xml: string, celRef: string, novoValor: number): string {
  // 1. Tentar encontrar a tag normal <c r="REF" ...>...</c> (não self-closing)
  const normalRegex = new RegExp(`(<c\\s[^>]*?r="${celRef}"[^>]*(?<!/)>)([\\s\\S]*?)(</c>)`);
  const normalMatch = xml.match(normalRegex);

  if (normalMatch) {
    const inner = normalMatch[2];
    let newInner = '';
    if (inner.includes('<v>')) {
      newInner = inner.replace(/<v>[^<]*<\/v>/, `<v>${novoValor}</v>`);
    } else {
      newInner = inner + `<v>${novoValor}</v>`;
    }
    return xml.replace(normalRegex, `${normalMatch[1]}${newInner}${normalMatch[3]}`);
  }

  // 2. Tentar encontrar a tag self-closing <c r="REF" .../>
  const selfClosingRegex = new RegExp(`(<c\\s[^>]*?r="${celRef}"[^>]*?)/>`);
  const selfMatch = xml.match(selfClosingRegex);
  if (selfMatch) {
    return xml.replace(selfClosingRegex, `${selfMatch[1]}><v>${novoValor}</v></c>`);
  }

  return xml;
}

// ─── Leitura dos Dados do Template ──────────────────────────────────────────

/**
 * Gera os nomes das colunas Excel de H (idx 7) a AV (idx 47).
 * Total: 41 colunas = meses 0 a 40.
 */
function gerarColunas(): string[] {
  const cols: string[] = [];
  for (let i = 7; i <= 47; i++) {
    if (i < 26) cols.push(String.fromCharCode(65 + i));
    else cols.push('A' + String.fromCharCode(65 + i - 26));
  }
  return cols;
}

/**
 * Carrega e parseia os valores cacheados da aba Cashflow do template Excel.
 * 
 * @param zip  JSZip com o template carregado
 * @returns Dados do template (fluxos, aluguéis, financiamento, preço)
 */
export async function readTemplateCashFlowData(zip: JSZip): Promise<TemplateData> {
  const abaCashflow = await resolverAbaNoZip(zip, 'Cashflow');
  if (!abaCashflow) {
    throw new Error('Aba "Cashflow" não encontrada no template.');
  }

  const xml = abaCashflow.xml;
  const cols = gerarColunas();

  // Ler valores cacheados de cada mês
  const flowsCache = cols.map(c => lerCelulaXml(xml, `${c}63`));  // fluxo líquido
  const rentasCache = cols.map(c => lerCelulaXml(xml, `${c}28`)); // aluguel mensal
  const financCache = cols.map(c => lerCelulaXml(xml, `${c}11`)); // financiamento mensal
  const precoCache = lerCelulaXml(xml, 'H66') || 1;               // preço do template

  // Encontrar último mês com dados
  let ultimoMes = 0;
  for (let t = cols.length - 1; t >= 0; t--) {
    if (flowsCache[t] !== 0 || rentasCache[t] !== 0) {
      ultimoMes = t;
      break;
    }
  }
  const nMeses = ultimoMes + 1;

  return { flowsCache, rentasCache, financCache, precoCache, nMeses };
}

// ─── Goal Seek ──────────────────────────────────────────────────────────────

/**
 * Executa o Goal Seek analítico para encontrar o preço mensal de locação
 * que faz VPL = 0, usando dados do template Excel.
 * 
 * Abordagem: O VPL é linear em P (preço mensal), então:
 *   VPL = P × coefP + constVPL = 0
 *   P = -constVPL / coefP
 * 
 * Para cada mês COM aluguel, o fluxo é decomposto em:
 *   flow = (renta/precoCache) × P × netFator - financiamento - custosExtras
 * 
 * Onde custosExtras (IPVA, seguro, etc.) são extraídos implicitamente do template.
 */
export function goalSeekFromTemplate(params: GoalSeekParams): GoalSeekResult {
  const {
    templateData,
    tmaAnual,
    parcelaMensal,
    prazoFinanciamento,
    valorLiquidoFinalVenda,
  } = params;

  const { flowsCache, rentasCache, financCache, precoCache, nMeses } = templateData;

  // Calcular TMA mensal
  const tmaMensal = Math.pow(1 + tmaAnual, 1 / 12) - 1;

  // Tributos sobre aluguel (Lucro Presumido):
  // IR(15%×32%) + CSLL(9%×32%) + AdicIR(3.2%) = 10.88%
  const netFator = 1 - (0.15 * 0.32 + 0.09 * 0.32 + 0.032); // 0.8912

  // ── Decomposição linear: VPL = P × coefP + constVPL = 0 ──
  let coefP = 0;
  let constVPL = 0;

  for (let t = 0; t < nMeses; t++) {
    const df = 1 / Math.pow(1 + tmaMensal, t + 1); // fator de desconto
    const renta = rentasCache[t];
    const flow = flowsCache[t];
    const financMes = financCache[t];
    // Nosso financiamento: ativo nos meses 1..prazoFinanciamento
    const nossaFinanc = (t >= 1 && t <= prazoFinanciamento) ? parcelaMensal : 0;

    if (renta > 0) {
      // Mês COM aluguel — decompor custos e reconstruir com novo P
      // coeficiente de P: proporção do aluguel × netFator × desconto
      coefP += (renta / precoCache) * netFator * df;
      // constante: custos fixos (exceto aluguel)
      constVPL += (flow + financMes - nossaFinanc - renta * netFator) * df;
    } else if (t === nMeses - 1 && flow > 1000) {
      // Último mês com venda — usar nosso valor calculado
      constVPL += valorLiquidoFinalVenda * df;
    } else {
      // Mês SEM aluguel — ajustar diferença de financiamento
      constVPL += (flow + financMes - nossaFinanc) * df;
    }
  }

  // Resolver: P = -constVPL / coefP
  const precoMensalAluguel = coefP > 0
    ? Math.round((-constVPL / coefP) * 100) / 100
    : 0;

  // ── Reconstruir o fluxo de caixa com o preço calculado ──
  const cashFlowValues: number[] = [];
  const cashFlowDisplay: CashFlowDisplayEntry[] = [];
  let acumulado = 0;

  for (let t = 0; t < nMeses; t++) {
    const renta = rentasCache[t];
    const flow = flowsCache[t];
    const financMes = financCache[t];
    const nossaFinanc = (t >= 1 && t <= prazoFinanciamento) ? parcelaMensal : 0;

    let fluxoLiquido: number;
    let aluguelBruto = 0;
    let custos = 0;

    if (renta > 0) {
      // Mês COM aluguel — recalcular com novo preço
      const proporcao = renta / precoCache; // proporção do aluguel do template
      aluguelBruto = precoMensalAluguel * proporcao;
      const aluguelLiquido = aluguelBruto * netFator;
      // Custos extras do template (IPVA, seguro, etc.)
      const custosExtras = renta * netFator - financMes - flow;
      custos = -(nossaFinanc + custosExtras);
      fluxoLiquido = aluguelLiquido + custos;
    } else if (t === nMeses - 1 && flow > 1000) {
      // Último mês (venda)
      aluguelBruto = 0;
      custos = 0;
      fluxoLiquido = valorLiquidoFinalVenda;
    } else {
      // Mês SEM aluguel
      aluguelBruto = 0;
      custos = flow + financMes - nossaFinanc;
      fluxoLiquido = custos;
    }

    acumulado += fluxoLiquido;
    cashFlowValues.push(fluxoLiquido);
    cashFlowDisplay.push({
      mes: t,
      fluxoLiquido,
      acumulado,
      aluguelBruto,
      custos,
    });
  }

  // Calcular VPL do fluxo reconstruído (deve ser ≈ 0)
  const vpl = calcNPV(tmaMensal, cashFlowValues);

  // Calcular TIR
  const tirMensal = calcIRR(cashFlowValues, tmaMensal > 0 ? tmaMensal : 0.02);

  return {
    precoMensalAluguel,
    vpl,
    tirMensal,
    tmaMensal,
    cashFlowDisplay,
  };
}
