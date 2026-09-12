import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const FIPE_BASE = "https://veiculos.fipe.org.br/api/veiculos";
const TABLE_TTL_MS = 60 * 60 * 1000;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let tabelaCache: { codigo: string; fetchedAt: number } | null = null;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formBody(params: Record<string, string | number | undefined | null>) {
  const data = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    data.set(key, String(value));
  }
  return data;
}

async function fipePost(path: string, params: Record<string, string | number | undefined | null>) {
  const res = await fetch(`${FIPE_BASE}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Accept: "application/json, text/javascript, */*; q=0.01",
      Origin: "https://veiculos.fipe.org.br",
      Referer: "https://veiculos.fipe.org.br/",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: formBody(params),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`FIPE ${path} ${res.status}: ${text.slice(0, 280)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`FIPE ${path} retornou JSON inválido.`);
  }
}

async function codigoTabelaReferencia(): Promise<string> {
  const now = Date.now();
  if (tabelaCache && now - tabelaCache.fetchedAt < TABLE_TTL_MS) {
    return tabelaCache.codigo;
  }
  const rows = await fipePost("ConsultarTabelaDeReferencia", {});
  const first = Array.isArray(rows) ? rows[0] : null;
  const codigo = first?.Codigo ?? first?.codigo;
  if (codigo == null) throw new Error("Não foi possível obter a tabela de referência FIPE.");
  tabelaCache = { codigo: String(codigo), fetchedAt: now };
  return tabelaCache.codigo;
}

function parseAno(ano: string) {
  const [anoModelo, combustivel] = String(ano).split("-");
  return { anoModelo, codigoTipoCombustivel: combustivel || "" };
}

function tipoVeiculoSlug(codigoTipoVeiculo: string) {
  if (codigoTipoVeiculo === "1") return "carro";
  if (codigoTipoVeiculo === "2") return "moto";
  return "caminhao";
}

function extractAnos(payload: unknown): Array<{ Label: string; Value: string }> {
  if (Array.isArray(payload)) {
    return payload.filter((row) => row && typeof row === "object" && "Value" in row);
  }
  if (payload && typeof payload === "object" && Array.isArray((payload as { Anos?: unknown }).Anos)) {
    return (payload as { Anos: Array<{ Label: string; Value: string }> }).Anos;
  }
  return [];
}

function extractModelos(payload: unknown): Array<{ Label: string; Value: string }> {
  if (Array.isArray(payload)) {
    return payload.filter((row) => row && typeof row === "object" && "Value" in row);
  }
  if (payload && typeof payload === "object" && Array.isArray((payload as { Modelos?: unknown }).Modelos)) {
    return (payload as { Modelos: Array<{ Label: string; Value: string }> }).Modelos;
  }
  return [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado." }, 401);

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const isServiceRole = serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`;

    if (!isServiceRole) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) return json({ error: "Não autenticado." }, 401);

      const { data: profile } = await supabase
        .from("usuarios")
        .select("id")
        .eq("usuario_id", authData.user.id)
        .maybeSingle();
      if (!profile) return json({ error: "Perfil inválido." }, 403);
    }

    const body = await req.json();
    const action = String(body.action || "");
    const codigoTipoVeiculo = String(body.codigoTipoVeiculo || "");
    const tabela = await codigoTabelaReferencia();

    if (action === "marcas") {
      if (!codigoTipoVeiculo) return json({ error: "codigoTipoVeiculo é obrigatório." }, 400);
      const data = await fipePost("ConsultarMarcas", {
        codigoTabelaReferencia: tabela,
        codigoTipoVeiculo,
      });
      return json({ data: extractModelos(data) });
    }

    if (action === "anos") {
      const codigoMarca = String(body.codigoMarca || "");
      if (!codigoTipoVeiculo || !codigoMarca) {
        return json({ error: "codigoTipoVeiculo e codigoMarca são obrigatórios." }, 400);
      }
      const data = await fipePost("ConsultarModelos", {
        codigoTabelaReferencia: tabela,
        codigoTipoVeiculo,
        codigoMarca,
        codigoModelo: "",
        ano: "",
        codigoTipoCombustivel: "",
        anoModelo: "",
        modeloCodigoExterno: "",
      });
      return json({ data: extractAnos(data) });
    }

    if (action === "modelos") {
      const codigoMarca = String(body.codigoMarca || "");
      const ano = String(body.ano || "");
      if (!codigoTipoVeiculo || !codigoMarca || !ano) {
        return json({ error: "codigoTipoVeiculo, codigoMarca e ano são obrigatórios." }, 400);
      }
      const { anoModelo, codigoTipoCombustivel } = parseAno(ano);
      const data = await fipePost("ConsultarModelosAtravesDoAno", {
        codigoTabelaReferencia: tabela,
        codigoTipoVeiculo,
        codigoMarca,
        codigoModelo: "",
        ano,
        codigoTipoCombustivel,
        anoModelo,
        modeloCodigoExterno: "",
      });
      return json({ data: extractModelos(data) });
    }

    if (action === "valor") {
      const codigoMarca = String(body.codigoMarca || "");
      const codigoModelo = String(body.codigoModelo || "");
      const ano = String(body.ano || "");
      if (!codigoTipoVeiculo || !codigoMarca || !codigoModelo || !ano) {
        return json({ error: "Parâmetros incompletos para consultar o valor FIPE." }, 400);
      }
      const { anoModelo, codigoTipoCombustivel } = parseAno(ano);
      const data = await fipePost("ConsultarValorComTodosParametros", {
        codigoTabelaReferencia: tabela,
        codigoMarca,
        codigoModelo,
        codigoTipoVeiculo,
        anoModelo,
        codigoTipoCombustivel,
        tipoVeiculo: tipoVeiculoSlug(codigoTipoVeiculo),
        modeloCodigoExterno: "",
        tipoConsulta: "tradicional",
      });
      return json({ data });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao consultar a FIPE.";
    return json({ error: message }, 500);
  }
});
