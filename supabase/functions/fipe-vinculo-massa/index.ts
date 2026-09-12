import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const FIPE_BASE = "https://veiculos.fipe.org.br/api/veiculos";
const THROTTLE_MS = 350;
const MARCA_SCORE_MIN = 0.85;
const MODELO_SCORE_MIN = 0.65;
const MODELO_MARGIN_MIN = 0.15;

const MARCA_ALIASES: Record<string, string> = {
  VW: "VOLKSWAGEN",
  MB: "MERCEDES-BENZ",
  MERCEDES: "MERCEDES-BENZ",
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-fipe-batch-key",
};

let tabelaCache: { codigo: string; fetchedAt: number } | null = null;
const marcasCache = new Map<string, FipeOption[]>();
const anosCache = new Map<string, FipeOption[]>();
const modelosCache = new Map<string, FipeOption[]>();

interface FipeOption {
  Label: string;
  Value: string;
}

interface VeiculoRow {
  id: string;
  placa: string | null;
  backup_marca: string | null;
  backup_modelo_texto: string | null;
  backup_ano_modelo: number | null;
  backup_caminhao_id: string | null;
  tipo_veiculo: string | null;
  ano_fabricacao: number | null;
}

interface GrupoModelo {
  key: string;
  tipo: string;
  marcaRaw: string;
  modeloRaw: string;
  ano: number | null;
  ids: string[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripAccents(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "");
}

function normalizeText(text: string | null | undefined) {
  if (!text) return "";
  return stripAccents(text.toUpperCase()).replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeMarca(text: string | null | undefined) {
  const n = normalizeText(text);
  if (n.startsWith("VW ")) return "VOLKSWAGEN";
  return MARCA_ALIASES[n] || n;
}

function tokenizeModelo(text: string | null | undefined) {
  const n = normalizeText(text).replace(/^VW\s+/, "").replace(/^VOLKSWAGEN\s+/, "");
  const tokens = new Set<string>();
  for (const t of n.split(" ")) {
    if (t.length >= 2) tokens.add(t);
  }
  for (const m of n.match(/\d+/g) || []) tokens.add(m);
  return tokens;
}

function scoreText(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;
  const minLen = Math.min(a.length, b.length);
  let matches = 0;
  for (let i = 0; i < minLen; i++) if (a[i] === b[i]) matches++;
  return matches / Math.max(a.length, b.length);
}

function scoreModelo(query: string, label: string) {
  const qTokens = tokenizeModelo(query);
  const lNorm = normalizeText(label);
  if (qTokens.size === 0) return scoreText(normalizeText(query), lNorm);
  let hits = 0;
  for (const t of qTokens) if (lNorm.includes(t)) hits++;
  const tokenScore = hits / qTokens.size;
  const textScore = scoreText(normalizeText(query), lNorm);
  return Math.max(tokenScore * 0.75 + textScore * 0.25, textScore);
}

function parseValorFipe(valor?: string | null) {
  if (!valor) return null;
  const digits = valor.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  const num = Number(digits);
  return Number.isFinite(num) ? num : null;
}

async function fipePost(path: string, params: Record<string, string | number | undefined | null>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") body.set(k, String(v));
  }
  const res = await fetch(`${FIPE_BASE}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/json, text/javascript, */*; q=0.01",
      Origin: "https://veiculos.fipe.org.br",
      Referer: "https://veiculos.fipe.org.br/",
      "X-Requested-With": "XMLHttpRequest",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`FIPE ${path} ${res.status}`);
  return JSON.parse(text);
}

async function codigoTabelaReferencia() {
  const now = Date.now();
  if (tabelaCache && now - tabelaCache.fetchedAt < 3600000) return tabelaCache.codigo;
  const rows = await fipePost("ConsultarTabelaDeReferencia", {});
  const codigo = String(rows?.[0]?.Codigo ?? rows?.[0]?.codigo ?? "");
  if (!codigo) throw new Error("Tabela FIPE indisponível");
  tabelaCache = { codigo, fetchedAt: now };
  return codigo;
}

function extractList(payload: unknown, key: string): FipeOption[] {
  if (Array.isArray(payload)) return payload.filter((r) => r && typeof r === "object" && "Value" in r);
  if (payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>)[key])) {
    return (payload as Record<string, FipeOption[]>)[key];
  }
  return [];
}

async function listMarcas(codigoTipo: string) {
  if (marcasCache.has(codigoTipo)) return marcasCache.get(codigoTipo)!;
  const tabela = await codigoTabelaReferencia();
  const data = await fipePost("ConsultarMarcas", { codigoTabelaReferencia: tabela, codigoTipoVeiculo: codigoTipo });
  const rows = extractList(data, "Modelos");
  marcasCache.set(codigoTipo, rows);
  await sleep(THROTTLE_MS);
  return rows;
}

async function listAnos(codigoTipo: string, codigoMarca: string) {
  const key = `${codigoTipo}:${codigoMarca}`;
  if (anosCache.has(key)) return anosCache.get(key)!;
  const tabela = await codigoTabelaReferencia();
  const data = await fipePost("ConsultarModelos", {
    codigoTabelaReferencia: tabela,
    codigoTipoVeiculo: codigoTipo,
    codigoMarca,
    codigoModelo: "",
    ano: "",
    codigoTipoCombustivel: "",
    anoModelo: "",
    modeloCodigoExterno: "",
  });
  const rows = extractList(data, "Anos");
  anosCache.set(key, rows);
  await sleep(THROTTLE_MS);
  return rows;
}

async function listModelos(codigoTipo: string, codigoMarca: string, ano: string) {
  const key = `${codigoTipo}:${codigoMarca}:${ano}`;
  if (modelosCache.has(key)) return modelosCache.get(key)!;
  const tabela = await codigoTabelaReferencia();
  const [anoModelo, codigoTipoCombustivel = ""] = ano.split("-");
  const data = await fipePost("ConsultarModelosAtravesDoAno", {
    codigoTabelaReferencia: tabela,
    codigoTipoVeiculo: codigoTipo,
    codigoMarca,
    codigoModelo: "",
    ano,
    codigoTipoCombustivel,
    anoModelo,
    modeloCodigoExterno: "",
  });
  const rows = extractList(data, "Modelos");
  modelosCache.set(key, rows);
  await sleep(THROTTLE_MS);
  return rows;
}

async function consultarValor(codigoTipo: string, codigoMarca: string, codigoModelo: string, ano: string) {
  const tabela = await codigoTabelaReferencia();
  const [anoModelo, codigoTipoCombustivel = ""] = ano.split("-");
  const data = await fipePost("ConsultarValorComTodosParametros", {
    codigoTabelaReferencia: tabela,
    codigoMarca,
    codigoModelo,
    codigoTipoVeiculo: codigoTipo,
    anoModelo,
    codigoTipoCombustivel,
    tipoVeiculo: codigoTipo === "1" ? "carro" : "caminhao",
    modeloCodigoExterno: "",
    tipoConsulta: "tradicional",
  });
  await sleep(THROTTLE_MS);
  return data as Record<string, unknown>;
}

function inferTipoVeiculo(tipo: string | null, modeloRaw: string | null) {
  if (tipo === "carro" || tipo === "caminhao") return tipo;
  const m = normalizeText(modeloRaw);
  if (["SAVEIRO", "GOL", "FOX", "VOYAGE", "POLO", "VIRTUS"].some((k) => m.includes(k))) return "carro";
  return "caminhao";
}

function resolveAno(v: VeiculoRow) {
  return v.backup_ano_modelo ?? v.ano_fabricacao ?? null;
}

function groupKey(v: VeiculoRow) {
  const ano = resolveAno(v);
  if (v.backup_caminhao_id) return `cat:${v.backup_caminhao_id}:ano:${ano ?? "null"}`;
  const tipo = v.tipo_veiculo || "caminhao";
  return `txt:${tipo}:${normalizeMarca(v.backup_marca)}:${normalizeText(v.backup_modelo_texto)}:ano:${ano ?? "null"}`;
}

function buildGrupos(veiculos: VeiculoRow[]): GrupoModelo[] {
  const map = new Map<string, GrupoModelo>();
  for (const v of veiculos) {
    const key = groupKey(v);
    if (!map.has(key)) {
      map.set(key, {
        key,
        tipo: inferTipoVeiculo(v.tipo_veiculo, v.backup_modelo_texto),
        marcaRaw: v.backup_marca || "",
        modeloRaw: v.backup_modelo_texto || "",
        ano: resolveAno(v),
        ids: [],
      });
    }
    map.get(key)!.ids.push(v.id);
  }
  return [...map.values()];
}

function pickMarca(marcas: FipeOption[], marcaRaw: string) {
  const target = normalizeMarca(marcaRaw);
  const scored = marcas
    .map((m) => ({ m, s: scoreText(target, normalizeText(m.Label)) }))
    .sort((a, b) => b.s - a.s);
  if (!scored[0] || scored[0].s < MARCA_SCORE_MIN) return null;
  return scored[0].m;
}

function pickAno(anos: FipeOption[], ano: number | null) {
  if (ano == null) return null;
  const year = String(ano);
  const matches = anos.filter((a) => String(a.Label) === year || String(a.Value).startsWith(`${year}-`));
  if (!matches.length) return null;
  return matches.find((a) => String(a.Value).endsWith("-3")) || matches[0];
}

function pickModelo(modelos: FipeOption[], modeloRaw: string) {
  const scored = modelos
    .map((m) => ({ m, s: scoreModelo(modeloRaw, m.Label) }))
    .sort((a, b) => b.s - a.s);
  if (!scored[0] || scored[0].s < MODELO_SCORE_MIN) return null;
  const second = scored[1]?.s ?? 0;
  if (scored[0].s - second < MODELO_MARGIN_MIN) return null;
  return scored[0].m;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const batchKeyHeader = req.headers.get("X-Fipe-Batch-Key") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const expectedBatchKey = Deno.env.get("FIPE_BATCH_KEY") ?? "tope-fipe-batch-internal";
    const isServiceRole = serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`;
    const isBatchKey = batchKeyHeader === expectedBatchKey;
    if (!isServiceRole && !isBatchKey) {
      return json({ error: "Requer service role ou X-Fipe-Batch-Key." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run !== false;
    const limit = Number(body.limit || 0);
    const batchSize = Number(body.batch_size || 40);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceRoleKey,
    );

    const { data: veiculos, error } = await supabase
      .from("frota_veiculos")
      .select("id, placa, backup_marca, backup_modelo_texto, backup_ano_modelo, backup_caminhao_id, tipo_veiculo, ano_fabricacao")
      .is("fipe_codigo", null)
      .in("fipe_vinculo_status", ["pendente", "falha"])
      .or("backup_modelo_texto.not.is.null,backup_caminhao_id.not.is.null");

    if (error) return json({ error: error.message }, 500);

    let grupos = buildGrupos((veiculos || []) as VeiculoRow[]);
    if (limit > 0) grupos = grupos.slice(0, limit);

    const stats = { veiculos: 0, grupos: 0, vinculados: 0, falhas: 0, rate_limit: 0, gruposOk: 0 };
    const details: Record<string, unknown>[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < grupos.length; i++) {
      const grupo = grupos[i];
      stats.grupos++;
      stats.veiculos += grupo.ids.length;
      if (i > 0 && i % batchSize === 0) await sleep(7000);

      const codigoTipo = grupo.tipo === "carro" ? "1" : "3";
      try {
        const marcas = await listMarcas(codigoTipo);
        const marca = pickMarca(marcas, grupo.marcaRaw);
        if (!marca) throw new Error("marca_nao_encontrada");

        const anos = await listAnos(codigoTipo, String(marca.Value));
        const anoFipe = pickAno(anos, grupo.ano);
        if (!anoFipe) throw new Error("falha_ano");

        const modelos = await listModelos(codigoTipo, String(marca.Value), String(anoFipe.Value));
        const modelo = pickModelo(modelos, grupo.modeloRaw);
        if (!modelo) throw new Error("modelo_ambiguo");

        const valor = await consultarValor(codigoTipo, String(marca.Value), String(modelo.Value), String(anoFipe.Value));
        const payload = {
          tipo_veiculo: grupo.tipo,
          marca: String(valor.Marca || marca.Label),
          modelo_texto: String(valor.Modelo || modelo.Label),
          ano_modelo: grupo.ano,
          valor_fipe: parseValorFipe(String(valor.Valor || "")),
          fipe_codigo: valor.CodigoFipe || null,
          fipe_codigo_marca: String(marca.Value),
          fipe_codigo_modelo: String(modelo.Value),
          fipe_codigo_ano: String(anoFipe.Value),
          fipe_combustivel: valor.Combustivel || null,
          fipe_mes_referencia: valor.MesReferencia || null,
          fipe_vinculo_status: "automatico",
          fipe_vinculo_erro: null,
          fipe_vinculo_em: now,
        };

        stats.vinculados += grupo.ids.length;
        stats.gruposOk++;
        details.push({ grupo: grupo.key, ok: true, ids: grupo.ids.length, modelo: payload.modelo_texto });

        if (!dryRun) {
          const { error: upErr } = await supabase.from("frota_veiculos").update(payload).in("id", grupo.ids);
          if (upErr) throw new Error(upErr.message);
        }
      } catch (err) {
        const erro = err instanceof Error ? err.message : "desconhecida";
        const isRateLimit = erro.includes("429");
        if (isRateLimit) stats.rate_limit += grupo.ids.length;
        else stats.falhas += grupo.ids.length;
        details.push({ grupo: grupo.key, ok: false, erro, ids: grupo.ids.length, rate_limit: isRateLimit });
        if (!dryRun) {
          await supabase.from("frota_veiculos").update(
            isRateLimit
              ? { fipe_vinculo_status: "pendente", fipe_vinculo_erro: null, fipe_vinculo_em: null }
              : { fipe_vinculo_status: "falha", fipe_vinculo_erro: erro, fipe_vinculo_em: now },
          ).in("id", grupo.ids);
        }
      }
    }

    return json({ dry_run: dryRun, stats, details });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Falha no vínculo em massa." }, 500);
  }
});
