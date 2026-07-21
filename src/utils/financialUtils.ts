// utils/financialUtils.ts — TOPE
// Funções financeiras puras: VPL, TIR, Goal Seek via template Excel
import JSZip from 'jszip';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface TemplateData {
  flowsCache: number[];     // Fluxo líquido por mês (linha 63 da aba Cashflow)
  rentasCache: number[];    // Aluguel por mês (linha 28)
  financCache: number[];    // Financiamento por mês (linha 11)
  naoOperCache: number[];   // Não Operacional por mês (linha 60 — contém venda do ativo)
  custosCache: number[];    // Custos operacionais por mês (linha 13 — IPVA, seguro, manut.)
  precoCache: number;       // Preço mensal do template (H66)
  templateVehicleValue: number; // Valor total do veículo do template (Dados C29 + C30)
  nMeses: number;           // Último mês com dados + 1
  firstReajusteOffset: number; // Offset para cálculo do reajuste: 0 = aplica em mês 12, 1 = aplica em mês 13
}

export interface GoalSeekParams {
  templateData: TemplateData;
  tmaAnual: number;                // TMA anual (ex: 0.30 = 30%)
  parcelaMensal: number;           // Parcela PRICE calculada
  prazoFinanciamento: number;      // Prazo do financiamento em meses
  valorLiquidoFinalVenda: number;  // Valor líquido final da alienação
  reajusteAnual: number;           // Reajuste anual do aluguel (ex: 0.04 = 4%)
  valorCompraTotal: number;        // Valor total de compra do veículo do usuário (caminhão + implemento)
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
  const flowsCache = cols.map(c => lerCelulaXml(xml, `${c}63`));    // fluxo líquido
  const rentasCache = cols.map(c => lerCelulaXml(xml, `${c}28`));   // aluguel mensal
  const financCache = cols.map(c => lerCelulaXml(xml, `${c}11`));   // financiamento mensal
  const naoOperCache = cols.map(c => lerCelulaXml(xml, `${c}60`));  // não operacional (venda do ativo)
  const custosCache = cols.map(c => lerCelulaXml(xml, `${c}13`));   // custos operacionais (IPVA, seg, manut)
  const precoCache = lerCelulaXml(xml, 'H66') || 1;                 // preço do template

  // Ler valor total do veículo do template (Dados C29 + C30)
  const abaDados = await resolverAbaNoZip(zip, 'Dados');
  let templateVehicleValue = 297000; // fallback padrão
  if (abaDados) {
    const c29 = lerCelulaXml(abaDados.xml, 'C29');
    const c30 = lerCelulaXml(abaDados.xml, 'C30');
    templateVehicleValue = c29 + c30;
  }

  // Determinar nMeses (range do VPL do Excel)
  // O VPL no Excel vai de H63 até a coluna da venda do ativo (naoOper > threshold).
  // Fluxos após a venda são informativos e ficam fora do cálculo do VPL.
  const VENDA_THRESHOLD = 10000;
  let ultimoMesVenda = -1;
  for (let t = 0; t < cols.length; t++) {
    if (naoOperCache[t] > VENDA_THRESHOLD) {
      ultimoMesVenda = t;
    }
  }
  // Se encontrou venda, o range vai até a coluna da venda (inclusive)
  // Se não encontrou, usa o último mês com qualquer dado
  let ultimoMes = 0;
  if (ultimoMesVenda >= 0) {
    ultimoMes = ultimoMesVenda;
  } else {
    for (let t = cols.length - 1; t >= 0; t--) {
      if (flowsCache[t] !== 0 || rentasCache[t] !== 0) {
        ultimoMes = t;
        break;
      }
    }
  }
  const nMeses = ultimoMes + 1;

  // Detectar offset do reajuste: em qual mês de operação o template começa a aplicar reajuste?
  // Template 12m: aplica em mês 12 de operação → offset = 0 (floor com -firstRentMonth)
  // Templates 24m+: aplicam em mês 13 de operação → offset = 1
  // Detectado automaticamente lendo o template.
  let firstRentMonth = -1;
  let baseRenta = 0;
  let firstReajusteOffset = 1; // default: reajuste a partir do mês 13 (como 24m/36m)
  for (let t = 0; t < cols.length; t++) {
    if (rentasCache[t] > 0 && firstRentMonth === -1) {
      firstRentMonth = t;
      baseRenta = rentasCache[t];
    }
    if (firstRentMonth >= 0 && rentasCache[t] > baseRenta * 1.005) {
      // Encontrou o primeiro mês com reajuste
      const mesOp = t - firstRentMonth + 1; // mês de operação (começa em 1)
      // Se o reajuste inicia no mês 12 de operação (ex: template 12m), precisamos de offset = 1.
      // Se inicia no mês 13 de operação (ex: templates 24m, 36m), precisamos de offset = 0.
      firstReajusteOffset = mesOp % 12 === 0 ? 1 : 0;
      break;
    }
  }

  return { flowsCache, rentasCache, financCache, naoOperCache, custosCache, precoCache, templateVehicleValue, nMeses, firstReajusteOffset };
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
 * Classificação de meses:
 *   - VENDA: naoOperCache[t] > 10.000 → substituir pelo valorLiquidoFinalVenda do usuário
 *   - ALUGUEL: rentasCache[t] > 0 → decompor proporcionalmente ao preço
 *   - SEM_ALG: demais → ajustar diferença de financiamento
 */
export function goalSeekFromTemplate(params: GoalSeekParams): GoalSeekResult {
  const {
    templateData,
    tmaAnual,
    parcelaMensal,
    prazoFinanciamento,
    valorLiquidoFinalVenda,
    reajusteAnual,
    valorCompraTotal,
  } = params;

  const { flowsCache, rentasCache, financCache, naoOperCache, custosCache, precoCache, templateVehicleValue, nMeses, firstReajusteOffset } = templateData;

  // ── Calcular diferença de custos IPVA/Licenciamento (escalam com valor do veículo) ──
  // Fórmula do Licenciamento no template Excel:
  //   Ano 1: (veículo × 0.015 × 0.97) + 600
  //   Ano 2: (veículo × 0.015 × 0.97) + 150
  //   Ano N≥3: (veículo × 0.85^(N-2) × 0.015 × 0.97) + 150
  // Os custos aparecem em meses específicos (aniversários anuais do contrato).
  // Aqui calculamos a DIFERENÇA entre custo do usuário e custo do template para cada mês.
  const custosDiff: Record<number, number> = {};
  if (valorCompraTotal > 0 && templateVehicleValue > 0 && Math.abs(valorCompraTotal - templateVehicleValue) > 1) {
    for (let t = 0; t < nMeses; t++) {
      const custoTemplate = custosCache[t];
      if (custoTemplate > 100) { // meses com custo significativo (IPVA/licenciamento)
        // Recalcular o custo para o veículo do usuário
        // Extrair a componente fixa (doc) e a componente variável (IPVA)
        const ipvaTemplate = custoTemplate - (t < 3 ? 600 : 150); // Ano 1 = doc 600, demais = 150
        if (ipvaTemplate > 0) {
          // Fator IPVA = (valorVeiculo × 0.015 × 0.97)
          // O IPVA do template e do usuário seguem a mesma degradação FIPE (0.85^n)
          // Então: ipvaUsuario / ipvaTemplate = valorCompraTotal / templateVehicleValue
          const ipvaUsuario = ipvaTemplate * (valorCompraTotal / templateVehicleValue);
          const docFixo = custoTemplate - ipvaTemplate; // componente fixa (600 ou 150)
          const custoUsuario = ipvaUsuario + docFixo;
          custosDiff[t] = custoUsuario - custoTemplate;
        }
      }
    }
  }

  // Calcular TMA mensal
  const tmaMensal = Math.pow(1 + tmaAnual, 1 / 12) - 1;

  // Tributos sobre aluguel (Lucro Presumido):
  // IR(15%×32%) + CSLL(9%×32%) + AdicIR(3.2%) = 10.88%
  const netFator = 1 - (0.15 * 0.32 + 0.09 * 0.32 + 0.032); // 0.8912

  // Threshold para detectar venda do ativo na Row 60 (Não Operacional)
  const VENDA_THRESHOLD = 10000;

  // Detectar primeiro mês com renda para calcular o ano de reajuste
  let firstRentMonth = -1;
  for (let t = 0; t < nMeses; t++) {
    if (rentasCache[t] > 0) { firstRentMonth = t; break; }
  }

  // ── Decomposição linear: VPL = P × coefP + constVPL = 0 ──
  // IMPORTANTE: Usa o reajuste do SISTEMA (não o do template) para coefP.
  // O template pode ter reajuste diferente (ex: 3%), enquanto o sistema usa 4%.
  // constVPL é independente do reajuste (só depende de custos fixos).
  let coefP = 0;
  let constVPL = 0;

  for (let t = 0; t < nMeses; t++) {
    const df = 1 / Math.pow(1 + tmaMensal, t + 1); // fator de desconto
    const renta = rentasCache[t];
    const flow = flowsCache[t];
    const financMes = financCache[t];
    const naoOper = naoOperCache[t];
    // Nosso financiamento: ativo nos meses 1..prazoFinanciamento
    const nossaFinanc = (t >= 1 && t <= prazoFinanciamento) ? parcelaMensal : 0;

    // Calcular o multiplicador de reajuste para este mês:
    // Usa reajusteAnual do SISTEMA, composto anualmente a partir do firstRentMonth.
    // O offset é detectado do template:
    //   offset=0: reajuste aplica em mês 12 de operação (inclusive) — template 12m
    //   offset=1: reajuste aplica em mês 13 de operação (inclusive) — templates 24m+
    // Ano 0 (meses sem reajuste): ratio = 1.0
    // Ano 1 (após 1 ano completo): ratio = (1 + reajuste)
    const ratio = (renta > 0 && firstRentMonth >= 0)
      ? Math.pow(1 + reajusteAnual, Math.floor((t - firstRentMonth + firstReajusteOffset) / 12))
      : 0;

    // Ajuste de custos IPVA/Licenciamento para o veículo do usuário
    const custoExtra = custosDiff[t] || 0;

    if (naoOper > VENDA_THRESHOLD) {
      // ── Mês com VENDA do ativo (detectado via Row 60 Não Operacional) ──
      const flowSemVenda = flow - naoOper;
      if (renta > 0) {
        // Mês com venda E aluguel
        coefP += ratio * netFator * df;
        constVPL += (flowSemVenda + financMes - nossaFinanc - renta * netFator - custoExtra) * df;
      } else {
        // Mês com venda SEM aluguel
        constVPL += (flowSemVenda + financMes - nossaFinanc - custoExtra) * df;
      }
      // Adicionar o valor de venda do USUÁRIO
      constVPL += valorLiquidoFinalVenda * df;
    } else if (renta > 0) {
      // ── Mês COM aluguel (sem venda) ──
      coefP += ratio * netFator * df;
      constVPL += (flow + financMes - nossaFinanc - renta * netFator - custoExtra) * df;
    } else {
      // ── Mês SEM aluguel e SEM venda ──
      constVPL += (flow + financMes - nossaFinanc - custoExtra) * df;
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
    const naoOper = naoOperCache[t];
    const nossaFinanc = (t >= 1 && t <= prazoFinanciamento) ? parcelaMensal : 0;
    const custoExtra = custosDiff[t] || 0;

    // Reajuste anual do sistema para este mês (mesmo offset detectado do template)
    const ratio = (renta > 0 && firstRentMonth >= 0)
      ? Math.pow(1 + reajusteAnual, Math.floor((t - firstRentMonth + firstReajusteOffset) / 12))
      : 0;

    let fluxoLiquido: number;
    let aluguelBruto = 0;
    let custos = 0;

    if (naoOper > VENDA_THRESHOLD) {
      // ── Mês com VENDA ──
      const flowSemVenda = flow - naoOper;
      if (renta > 0) {
        aluguelBruto = precoMensalAluguel * ratio;
        const aluguelLiquido = aluguelBruto * netFator;
        const custosExtras = renta * netFator - financMes - flowSemVenda;
        custos = -(nossaFinanc + custosExtras + custoExtra);
        fluxoLiquido = aluguelLiquido + custos + valorLiquidoFinalVenda;
      } else {
        custos = flowSemVenda + financMes - nossaFinanc - custoExtra;
        fluxoLiquido = custos + valorLiquidoFinalVenda;
      }
    } else if (renta > 0) {
      // ── Mês COM aluguel ──
      aluguelBruto = precoMensalAluguel * ratio;
      const aluguelLiquido = aluguelBruto * netFator;
      const custosExtras = renta * netFator - financMes - flow;
      custos = -(nossaFinanc + custosExtras + custoExtra);
      fluxoLiquido = aluguelLiquido + custos;
    } else {
      // ── Mês SEM aluguel ──
      aluguelBruto = 0;
      custos = flow + financMes - nossaFinanc - custoExtra;
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
