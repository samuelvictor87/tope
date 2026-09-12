# -*- coding: utf-8 -*-
"""Vínculo FIPE em massa: agrupa modelos iguais, 1 consulta FIPE por combinação."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ROOT.parent


def load_dotenv() -> None:
    for name in (".env.local", ".env"):
        path = PROJECT_ROOT / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)
CACHE_PATH = ROOT / "fipe_match_cache.json"
REPORT_JSON = ROOT / "fipe_vinculo_report.json"
REPORT_TXT = ROOT / "fipe_vinculo_report.txt"

FIPE_BASE = "https://veiculos.fipe.org.br/api/veiculos"
FIPE_TIMEOUT = 15
FIPE_RETRIES = 3
FIPE_BACKOFF = (2, 4, 8)
THROTTLE_MS = 350
BATCH_PAUSE_SEC = 7
MAX_CONSECUTIVE_TIMEOUTS = 5

MARCA_SCORE_MIN = 0.85
MODELO_SCORE_MIN = 0.65
MODELO_MARGIN_MIN = 0.15

MARCA_ALIASES: dict[str, str] = {
    "VW": "VOLKSWAGEN",
    "V W": "VOLKSWAGEN",
    "MB": "MERCEDES-BENZ",
    "MERCEDES": "MERCEDES-BENZ",
    "MERCEDES BENZ": "MERCEDES-BENZ",
    "IVECO": "IVECO",
    "SCANIA": "SCANIA",
    "VOLVO": "VOLVO",
    "MAN": "MAN",
    "FORD": "FORD",
    "DAF": "DAF",
    "HYUNDAI": "HYUNDAI",
    "INTERNATIONAL": "INTERNATIONAL",
    "INTER": "INTERNATIONAL",
}


@dataclass
class VeiculoRow:
    id: str
    placa: str
    chassi: str
    backup_marca: str | None
    backup_modelo_texto: str | None
    backup_ano_modelo: int | None
    backup_caminhao_id: str | None
    tipo_veiculo: str | None
    ano_fabricacao: int | None


@dataclass
class GrupoModelo:
    key: str
    tipo: str
    marca_raw: str
    modelo_raw: str
    ano: int | None
    caminhao_id: str | None
    veiculos: list[VeiculoRow] = field(default_factory=list)


@dataclass
class MatchResult:
    ok: bool
    erro: str | None = None
    payload: dict[str, Any] | None = None
    debug: dict[str, Any] = field(default_factory=dict)


class FipeProxyClient:
    """Consulta FIPE via Edge Function (contorna bloqueio Cloudflare)."""

    def __init__(self, url: str, service_key: str, anon_key: str = "") -> None:
        self.url = url.rstrip("/")
        self.service_key = service_key
        self.anon_key = anon_key or service_key
        self._marcas: dict[str, list[dict[str, str]]] = {}
        self._anos: dict[str, list[dict[str, str]]] = {}
        self._modelos: dict[str, list[dict[str, str]]] = {}

    def _invoke(self, body: dict[str, str]) -> Any:
        payload = json.dumps(body).encode()
        req = urllib.request.Request(
            f"{self.url}/functions/v1/fipe-proxy",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.service_key}",
                "apikey": self.anon_key,
            },
            method="POST",
        )
        last_err: Exception | None = None
        for attempt in range(FIPE_RETRIES):
            try:
                with urllib.request.urlopen(req, timeout=FIPE_TIMEOUT) as resp:
                    parsed = json.loads(resp.read().decode())
                    if parsed.get("error"):
                        raise RuntimeError(str(parsed["error"]))
                    return parsed.get("data")
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, RuntimeError) as err:
                last_err = err
                if attempt < FIPE_RETRIES - 1:
                    time.sleep(FIPE_BACKOFF[attempt] if attempt < len(FIPE_BACKOFF) else 8)
        raise RuntimeError(f"fipe-proxy falhou após {FIPE_RETRIES} tentativas: {last_err}")

    def marcas(self, codigo_tipo: str) -> list[dict[str, str]]:
        if codigo_tipo not in self._marcas:
            self._marcas[codigo_tipo] = self._invoke({"action": "marcas", "codigoTipoVeiculo": codigo_tipo}) or []
            time.sleep(THROTTLE_MS / 1000)
        return self._marcas[codigo_tipo]

    def anos(self, codigo_tipo: str, codigo_marca: str) -> list[dict[str, str]]:
        cache_key = f"{codigo_tipo}:{codigo_marca}"
        if cache_key not in self._anos:
            self._anos[cache_key] = self._invoke({
                "action": "anos",
                "codigoTipoVeiculo": codigo_tipo,
                "codigoMarca": codigo_marca,
            }) or []
            time.sleep(THROTTLE_MS / 1000)
        return self._anos[cache_key]

    def modelos(self, codigo_tipo: str, codigo_marca: str, ano: str) -> list[dict[str, str]]:
        cache_key = f"{codigo_tipo}:{codigo_marca}:{ano}"
        if cache_key not in self._modelos:
            self._modelos[cache_key] = self._invoke({
                "action": "modelos",
                "codigoTipoVeiculo": codigo_tipo,
                "codigoMarca": codigo_marca,
                "ano": ano,
            }) or []
            time.sleep(THROTTLE_MS / 1000)
        return self._modelos[cache_key]

    def valor(self, codigo_tipo: str, codigo_marca: str, codigo_modelo: str, ano: str) -> dict[str, Any]:
        data = self._invoke({
            "action": "valor",
            "codigoTipoVeiculo": codigo_tipo,
            "codigoMarca": codigo_marca,
            "codigoModelo": codigo_modelo,
            "ano": ano,
        })
        time.sleep(THROTTLE_MS / 1000)
        return data if isinstance(data, dict) else {}


class FipeClient:
    def __init__(self) -> None:
        self._tabela: str | None = None
        self._tabela_at = 0.0
        self._marcas: dict[str, list[dict[str, str]]] = {}
        self._anos: dict[str, list[dict[str, str]]] = {}
        self._modelos: dict[str, list[dict[str, str]]] = {}

    def _post(self, path: str, params: dict[str, Any]) -> Any:
        data = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None and v != ""}).encode()
        req = urllib.request.Request(
            f"{FIPE_BASE}/{path}",
            data=data,
            headers={
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "Origin": "https://veiculos.fipe.org.br",
                "Referer": "https://veiculos.fipe.org.br/",
                "X-Requested-With": "XMLHttpRequest",
            },
            method="POST",
        )
        last_err: Exception | None = None
        for attempt in range(FIPE_RETRIES):
            try:
                with urllib.request.urlopen(req, timeout=FIPE_TIMEOUT) as resp:
                    return json.loads(resp.read().decode())
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
                last_err = err
                if attempt < FIPE_RETRIES - 1:
                    time.sleep(FIPE_BACKOFF[attempt] if attempt < len(FIPE_BACKOFF) else 8)
        raise RuntimeError(f"FIPE {path} falhou após {FIPE_RETRIES} tentativas: {last_err}")

    def tabela(self) -> str:
        now = time.time()
        if self._tabela and now - self._tabela_at < 3600:
            return self._tabela
        rows = self._post("ConsultarTabelaDeReferencia", {})
        first = rows[0] if isinstance(rows, list) and rows else {}
        codigo = str(first.get("Codigo") or first.get("codigo") or "")
        if not codigo:
            raise RuntimeError("Tabela de referência FIPE indisponível.")
        self._tabela = codigo
        self._tabela_at = now
        return codigo

    @staticmethod
    def _extract_list(payload: Any, key: str) -> list[dict[str, str]]:
        if isinstance(payload, list):
            return [r for r in payload if isinstance(r, dict) and "Value" in r]
        if isinstance(payload, dict) and isinstance(payload.get(key), list):
            return payload[key]
        return []

    def marcas(self, codigo_tipo: str) -> list[dict[str, str]]:
        if codigo_tipo not in self._marcas:
            data = self._post("ConsultarMarcas", {
                "codigoTabelaReferencia": self.tabela(),
                "codigoTipoVeiculo": codigo_tipo,
            })
            self._marcas[codigo_tipo] = self._extract_list(data, "Modelos")
            time.sleep(THROTTLE_MS / 1000)
        return self._marcas[codigo_tipo]

    def anos(self, codigo_tipo: str, codigo_marca: str) -> list[dict[str, str]]:
        cache_key = f"{codigo_tipo}:{codigo_marca}"
        if cache_key not in self._anos:
            data = self._post("ConsultarModelos", {
                "codigoTabelaReferencia": self.tabela(),
                "codigoTipoVeiculo": codigo_tipo,
                "codigoMarca": codigo_marca,
                "codigoModelo": "",
                "ano": "",
                "codigoTipoCombustivel": "",
                "anoModelo": "",
                "modeloCodigoExterno": "",
            })
            self._anos[cache_key] = self._extract_list(data, "Anos")
            time.sleep(THROTTLE_MS / 1000)
        return self._anos[cache_key]

    def modelos(self, codigo_tipo: str, codigo_marca: str, ano: str) -> list[dict[str, str]]:
        cache_key = f"{codigo_tipo}:{codigo_marca}:{ano}"
        if cache_key not in self._modelos:
            ano_modelo, combustivel = ano.split("-", 1) if "-" in ano else (ano, "")
            data = self._post("ConsultarModelosAtravesDoAno", {
                "codigoTabelaReferencia": self.tabela(),
                "codigoTipoVeiculo": codigo_tipo,
                "codigoMarca": codigo_marca,
                "codigoModelo": "",
                "ano": ano,
                "codigoTipoCombustivel": combustivel,
                "anoModelo": ano_modelo,
                "modeloCodigoExterno": "",
            })
            self._modelos[cache_key] = self._extract_list(data, "Modelos")
            time.sleep(THROTTLE_MS / 1000)
        return self._modelos[cache_key]

    def valor(self, codigo_tipo: str, codigo_marca: str, codigo_modelo: str, ano: str) -> dict[str, Any]:
        ano_modelo, combustivel = ano.split("-", 1) if "-" in ano else (ano, "")
        slug = "carro" if codigo_tipo == "1" else "caminhao"
        data = self._post("ConsultarValorComTodosParametros", {
            "codigoTabelaReferencia": self.tabela(),
            "codigoMarca": codigo_marca,
            "codigoModelo": codigo_modelo,
            "codigoTipoVeiculo": codigo_tipo,
            "anoModelo": ano_modelo,
            "codigoTipoCombustivel": combustivel,
            "tipoVeiculo": slug,
            "modeloCodigoExterno": "",
            "tipoConsulta": "tradicional",
        })
        time.sleep(THROTTLE_MS / 1000)
        return data if isinstance(data, dict) else {}


def strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def normalize_text(text: str | None) -> str:
    if not text:
        return ""
    s = strip_accents(str(text).upper())
    s = re.sub(r"[^A-Z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def normalize_marca(text: str | None) -> str:
    n = normalize_text(text)
    for alias, target in MARCA_ALIASES.items():
        if n == alias or n.startswith(alias + " "):
            return target
    if n.startswith("VW "):
        return "VOLKSWAGEN"
    return n


def tokenize_modelo(text: str | None) -> set[str]:
    n = normalize_text(text)
    n = re.sub(r"^VW\s+", "", n)
    n = re.sub(r"^VOLKSWAGEN\s+", "", n)
    tokens = {t for t in n.split() if len(t) >= 2 and not t.isalpha() or t.isdigit() or len(t) >= 3}
    nums = re.findall(r"\d+", n)
    tokens.update(nums)
    return tokens


def score_text(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    if a in b or b in a:
        return 0.92
    return SequenceMatcher(None, a, b).ratio()


def score_modelo(query: str, label: str) -> float:
    q_tokens = tokenize_modelo(query)
    l_norm = normalize_text(label)
    if not q_tokens:
        return score_text(normalize_text(query), l_norm)
    hits = sum(1 for t in q_tokens if t in l_norm.split() or t in l_norm)
    token_score = hits / max(len(q_tokens), 1)
    text_score = score_text(normalize_text(query), l_norm)
    return max(token_score * 0.75 + text_score * 0.25, text_score)


def parse_valor_fipe(valor: str | None) -> float | None:
    if not valor:
        return None
    digits = re.sub(r"[^\d,-]", "", valor).replace(".", "").replace(",", ".")
    try:
        return float(digits)
    except ValueError:
        return None


def infer_tipo_veiculo(tipo: str | None, modelo_raw: str | None) -> str:
    if tipo in ("carro", "caminhao"):
        return tipo
    m = normalize_text(modelo_raw)
    if any(k in m for k in ("SAVEIRO", "GOL", "FOX", "VOYAGE", "POLO", "VIRTUS")):
        return "carro"
    return "caminhao"


def codigo_tipo(tipo: str | None) -> tuple[str, str]:
    if tipo == "carro":
        return "1", "carro"
    return "3", "caminhao"


def resolve_ano(veiculo: VeiculoRow) -> int | None:
    if veiculo.backup_ano_modelo:
        return int(veiculo.backup_ano_modelo)
    if veiculo.ano_fabricacao:
        return int(veiculo.ano_fabricacao)
    return None


def group_key(veiculo: VeiculoRow) -> str:
    ano = resolve_ano(veiculo)
    if veiculo.backup_caminhao_id:
        return f"cat:{veiculo.backup_caminhao_id}:ano:{ano or 'null'}"
    tipo = veiculo.tipo_veiculo or "caminhao"
    marca = normalize_marca(veiculo.backup_marca)
    modelo = normalize_text(veiculo.backup_modelo_texto)
    return f"txt:{tipo}:{marca}:{modelo}:ano:{ano or 'null'}"


def build_grupos(veiculos: list[VeiculoRow]) -> list[GrupoModelo]:
    buckets: dict[str, GrupoModelo] = {}
    for v in veiculos:
        key = group_key(v)
        if key not in buckets:
            buckets[key] = GrupoModelo(
                key=key,
                tipo=infer_tipo_veiculo(v.tipo_veiculo, v.backup_modelo_texto),
                marca_raw=v.backup_marca or "",
                modelo_raw=v.backup_modelo_texto or "",
                ano=resolve_ano(v),
                caminhao_id=v.backup_caminhao_id,
                veiculos=[],
            )
        buckets[key].veiculos.append(v)
    return list(buckets.values())


def pick_marca(fipe: FipeClient, codigo_tipo_veiculo: str, marca_raw: str) -> tuple[dict[str, str] | None, list[tuple[str, float]]]:
    marcas = fipe.marcas(codigo_tipo_veiculo)
    target = normalize_marca(marca_raw)
    scored = [(m, score_text(target, normalize_text(m.get("Label")))) for m in marcas]
    scored.sort(key=lambda x: x[1], reverse=True)
    best = scored[0] if scored else (None, 0.0)
    if best[0] and best[1] >= MARCA_SCORE_MIN:
        return best[0], [(m.get("Label", ""), s) for m, s in scored[:5]]
    return None, [(m.get("Label", ""), s) for m, s in scored[:5]]


def pick_ano(anos: list[dict[str, str]], ano: int | None, prefer_diesel: bool = True) -> dict[str, str] | None:
    if ano is None:
        return None
    year_str = str(ano)
    matches = [a for a in anos if str(a.get("Label")) == year_str or str(a.get("Value", "")).startswith(year_str + "-")]
    if not matches:
        return None
    if prefer_diesel:
        diesel = [a for a in matches if str(a.get("Value", "")).endswith("-3")]
        if diesel:
            return diesel[0]
    return matches[0]


def pick_modelo(modelos: list[dict[str, str]], modelo_raw: str) -> tuple[dict[str, str] | None, list[tuple[str, float]]]:
    scored = [(m, score_modelo(modelo_raw, m.get("Label", ""))) for m in modelos]
    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:5]
    if not scored:
        return None, []
    best_m, best_s = scored[0]
    second_s = scored[1][1] if len(scored) > 1 else 0.0
    if best_s >= MODELO_SCORE_MIN and (best_s - second_s) >= MODELO_MARGIN_MIN:
        return best_m, [(m.get("Label", ""), s) for m, s in top]
    return None, [(m.get("Label", ""), s) for m, s in top]


def match_grupo(fipe: FipeClient, grupo: GrupoModelo) -> MatchResult:
    if not grupo.modelo_raw and not grupo.caminhao_id:
        return MatchResult(ok=False, erro="sem_dados_backup")
    if not grupo.marca_raw and not grupo.caminhao_id:
        return MatchResult(ok=False, erro="sem_dados_backup")

    codigo_tipo_v, tipo_slug = codigo_tipo(grupo.tipo)
    marca_fipe, marca_candidatos = pick_marca(fipe, codigo_tipo_v, grupo.marca_raw)
    if not marca_fipe:
        return MatchResult(ok=False, erro="marca_nao_encontrada", debug={"marca_raw": grupo.marca_raw, "candidatos": marca_candidatos})

    anos = fipe.anos(codigo_tipo_v, str(marca_fipe["Value"]))
    ano_fipe = pick_ano(anos, grupo.ano, prefer_diesel=(tipo_slug == "caminhao"))
    if not ano_fipe:
        return MatchResult(ok=False, erro="falha_ano", debug={"ano": grupo.ano, "marca": marca_fipe.get("Label")})

    modelos = fipe.modelos(codigo_tipo_v, str(marca_fipe["Value"]), str(ano_fipe["Value"]))
    modelo_fipe, modelo_candidatos = pick_modelo(modelos, grupo.modelo_raw)
    if not modelo_fipe:
        return MatchResult(ok=False, erro="modelo_ambiguo", debug={"modelo_raw": grupo.modelo_raw, "candidatos": modelo_candidatos})

    valor_data = fipe.valor(codigo_tipo_v, str(marca_fipe["Value"]), str(modelo_fipe["Value"]), str(ano_fipe["Value"]))
    ano_modelo_num = grupo.ano
    if ano_modelo_num is None and valor_data.get("AnoModelo"):
        try:
            ano_modelo_num = int(valor_data["AnoModelo"])
        except (TypeError, ValueError):
            pass

    payload = {
        "tipo_veiculo": tipo_slug,
        "marca": valor_data.get("Marca") or marca_fipe.get("Label"),
        "modelo_texto": valor_data.get("Modelo") or modelo_fipe.get("Label"),
        "ano_modelo": ano_modelo_num,
        "valor_fipe": parse_valor_fipe(valor_data.get("Valor")),
        "fipe_codigo": valor_data.get("CodigoFipe"),
        "fipe_codigo_marca": str(marca_fipe["Value"]),
        "fipe_codigo_modelo": str(modelo_fipe["Value"]),
        "fipe_codigo_ano": str(ano_fipe["Value"]),
        "fipe_combustivel": valor_data.get("Combustivel"),
        "fipe_mes_referencia": valor_data.get("MesReferencia"),
        "fipe_vinculo_status": "automatico",
        "fipe_vinculo_erro": None,
        "fipe_vinculo_em": datetime.now(timezone.utc).isoformat(),
    }
    return MatchResult(ok=True, payload=payload, debug={
        "marca_fipe": marca_fipe.get("Label"),
        "ano_fipe": ano_fipe.get("Value"),
        "modelo_fipe": modelo_fipe.get("Label"),
    })


class SupabaseRest:
    def __init__(self, url: str, key: str) -> None:
        self.url = url.rstrip("/")
        self.key = key

    def _request(self, method: str, path: str, *, params: dict | None = None, body: Any = None) -> Any:
        qs = urllib.parse.urlencode(params or {})
        full = f"{self.url}/rest/v1/{path}" + (f"?{qs}" if qs else "")
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(
            full,
            data=data,
            headers={
                "apikey": self.key,
                "Authorization": f"Bearer {self.key}",
                "Content-Type": "application/json",
                "Prefer": "return=minimal",
            },
            method=method,
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status == 204:
                return None
            raw = resp.read().decode()
            return json.loads(raw) if raw else None

    def fetch_veiculos(self, placa: str | None = None) -> list[VeiculoRow]:
        out: list[VeiculoRow] = []
        offset = 0
        page_size = 1000
        while True:
            params: dict[str, str] = {
                "select": "id,placa,chassi,backup_marca,backup_modelo_texto,backup_ano_modelo,backup_caminhao_id,tipo_veiculo,ano_fabricacao",
                "fipe_codigo": "is.null",
                "or": "(fipe_vinculo_status.eq.pendente,fipe_vinculo_status.eq.falha)",
                "limit": str(page_size),
                "offset": str(offset),
            }
            if placa:
                params["placa"] = f"eq.{placa}"
            rows = self._request("GET", "frota_veiculos", params=params) or []
            if not rows:
                break
            for r in rows:
                if not (r.get("backup_modelo_texto") or r.get("backup_caminhao_id")):
                    continue
                out.append(VeiculoRow(
                    id=str(r["id"]),
                    placa=r.get("placa") or "",
                    chassi=r.get("chassi") or "",
                    backup_marca=r.get("backup_marca"),
                    backup_modelo_texto=r.get("backup_modelo_texto"),
                    backup_ano_modelo=r.get("backup_ano_modelo"),
                    backup_caminhao_id=str(r["backup_caminhao_id"]) if r.get("backup_caminhao_id") else None,
                    tipo_veiculo=r.get("tipo_veiculo"),
                    ano_fabricacao=r.get("ano_fabricacao"),
                ))
            if len(rows) < page_size:
                break
            offset += page_size
        return out

    def update_grupo(self, ids: list[str], payload: dict[str, Any]) -> None:
        if not ids:
            return
        id_list = ",".join(ids)
        self._request("PATCH", "frota_veiculos", params={"id": f"in.({id_list})"}, body=payload)

    def mark_falha(self, ids: list[str], erro: str) -> None:
        self._request("PATCH", "frota_veiculos", params={"id": f"in.({','.join(ids)})"}, body={
            "fipe_vinculo_status": "falha",
            "fipe_vinculo_erro": erro,
            "fipe_vinculo_em": datetime.now(timezone.utc).isoformat(),
        })


def load_cache() -> dict[str, Any]:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: dict[str, Any]) -> None:
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def sql_escape(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def emit_sql_updates(path: Path, updates: list[tuple[list[str], dict[str, Any]]]) -> None:
    lines: list[str] = []
    for ids, payload in updates:
        if not ids or not payload:
            continue
        sets = ", ".join(f"{k} = {sql_escape(v)}" for k, v in payload.items())
        id_list = ", ".join(sql_escape(i) for i in ids)
        lines.append(f"UPDATE public.frota_veiculos SET {sets} WHERE id IN ({id_list});")
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def load_veiculos_json(path: Path) -> list[VeiculoRow]:
    rows = json.loads(path.read_text(encoding="utf-8"))
    out: list[VeiculoRow] = []
    for r in rows:
        if not (r.get("backup_modelo_texto") or r.get("backup_caminhao_id")):
            continue
        out.append(VeiculoRow(
            id=str(r["id"]),
            placa=r.get("placa") or "",
            chassi=r.get("chassi") or "",
            backup_marca=r.get("backup_marca"),
            backup_modelo_texto=r.get("backup_modelo_texto"),
            backup_ano_modelo=r.get("backup_ano_modelo"),
            backup_caminhao_id=str(r["backup_caminhao_id"]) if r.get("backup_caminhao_id") else None,
            tipo_veiculo=r.get("tipo_veiculo"),
            ano_fabricacao=r.get("ano_fabricacao"),
        ))
    return out


def main() -> int:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Vínculo FIPE em massa (agrupado por modelo)")
    parser.add_argument("--apply", action="store_true", help="Gravar no banco (padrão: dry-run)")
    parser.add_argument("--limit", type=int, default=0, help="Limitar N grupos (0 = todos)")
    parser.add_argument("--batch-size", type=int, default=40, help="Grupos por lote")
    parser.add_argument("--placa", type=str, default="", help="Processar só esta placa")
    parser.add_argument("--input-json", type=str, default="", help="Arquivo JSON com veículos (pula fetch Supabase)")
    parser.add_argument("--emit-sql", type=str, default="", help="Gravar UPDATEs SQL neste arquivo")
    parser.add_argument("--group-stats", action="store_true", help="Só exibe estatísticas de agrupamento (sem FIPE)")
    args = parser.parse_args()

    sb: SupabaseRest | None = None
    if args.input_json:
        veiculos = load_veiculos_json(Path(args.input_json))
        if args.placa.strip():
            placa = args.placa.strip().upper()
            veiculos = [v for v in veiculos if v.placa.upper() == placa]
    else:
        url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")
        if not url or not key:
            print("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ou use --input-json.", file=sys.stderr)
            return 1
        sb = SupabaseRest(url, key)
        veiculos = sb.fetch_veiculos(placa=args.placa.strip() or None)
    grupos = build_grupos(veiculos)
    if args.limit > 0:
        grupos = grupos[: args.limit]

    if args.group_stats:
        print(f"Veículos: {len(veiculos)}")
        print(f"Grupos únicos: {len(grupos)}")
        for g in sorted(grupos, key=lambda x: -len(x.veiculos))[:10]:
            print(f"  {len(g.veiculos):4d} | {g.modelo_raw} | ano {g.ano}")
        return 0

    cache = load_cache()
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "https://ogtwxynlynrvffjdkpir.supabase.co"
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY") or ""
    anon_key = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY") or ""
    if service_key:
        fipe: FipeProxyClient | FipeClient = FipeProxyClient(supabase_url, service_key, anon_key)
        print("Usando fipe-proxy (service role).")
    else:
        fipe = FipeClient()
        print("AVISO: sem service role — tentando FIPE direto (pode falhar com 403).")

    stats = defaultdict(int)
    details: list[dict[str, Any]] = []
    sql_updates: list[tuple[list[str], dict[str, Any]]] = []
    consecutive_timeouts = 0
    cache_before = set(load_cache().keys())

    for batch_idx, batch_start in enumerate(range(0, len(grupos), args.batch_size)):
        batch = grupos[batch_start : batch_start + args.batch_size]
        if batch_idx > 0:
            print(f"Pausa entre lotes ({BATCH_PAUSE_SEC}s)...")
            time.sleep(BATCH_PAUSE_SEC)

        for grupo in batch:
            stats["grupos"] += 1
            stats["veiculos"] += len(grupo.veiculos)
            ids = [v.id for v in grupo.veiculos]
            placas = [v.placa or v.chassi or v.id[:8] for v in grupo.veiculos]

            if grupo.key in cache:
                cached = cache[grupo.key]
                result = MatchResult(ok=cached.get("ok", False), erro=cached.get("erro"), payload=cached.get("payload"), debug=cached.get("debug", {}))
                print(f"[cache] {grupo.key} -> {'OK' if result.ok else result.erro}")
            else:
                try:
                    result = match_grupo(fipe, grupo)
                    consecutive_timeouts = 0
                    cache[grupo.key] = {
                        "ok": result.ok,
                        "erro": result.erro,
                        "payload": result.payload,
                        "debug": result.debug,
                    }
                    save_cache(cache)
                except RuntimeError as err:
                    consecutive_timeouts += 1
                    print(f"[erro FIPE] {grupo.key}: {err}", file=sys.stderr)
                    if consecutive_timeouts >= MAX_CONSECUTIVE_TIMEOUTS:
                        print("Muitos timeouts seguidos — pausando. Relance o script para retomar.", file=sys.stderr)
                        break
                    result = MatchResult(ok=False, erro="fipe_timeout", debug={"message": str(err)})

            entry = {
                "grupo": grupo.key,
                "placas": placas,
                "veiculos": len(grupo.veiculos),
                "marca_raw": grupo.marca_raw,
                "modelo_raw": grupo.modelo_raw,
                "ano": grupo.ano,
                "ok": result.ok,
                "erro": result.erro,
                "debug": result.debug,
            }
            details.append(entry)

            if result.ok:
                stats["vinculados"] += len(grupo.veiculos)
                stats["grupos_ok"] += 1
                if result.payload:
                    sql_updates.append((ids, result.payload))
                if args.apply and result.payload:
                    if sb:
                        sb.update_grupo(ids, result.payload)
                    print(f"[apply] {len(ids)} veículos <- {result.payload.get('modelo_texto')}")
                else:
                    print(f"[dry-run OK] {len(ids)} veículos <- {result.payload.get('modelo_texto') if result.payload else '?'}")
            else:
                stats["falha"] += len(grupo.veiculos)
                stats[f"falha_{result.erro or 'desconhecida'}"] += len(grupo.veiculos)
                fail_payload = {
                    "fipe_vinculo_status": "falha",
                    "fipe_vinculo_erro": result.erro or "desconhecida",
                    "fipe_vinculo_em": datetime.now(timezone.utc).isoformat(),
                }
                sql_updates.append((ids, fail_payload))
                if args.apply:
                    if sb:
                        sb.mark_falha(ids, result.erro or "desconhecida")
                print(f"[{'apply' if args.apply else 'dry-run'} FALHA] {result.erro} — {placas[:3]}")

        if consecutive_timeouts >= MAX_CONSECUTIVE_TIMEOUTS:
            break

    summary_lines = [
        f"Modo: {'apply' if args.apply else 'dry-run'}",
        f"Veículos: {stats['veiculos']}",
        f"Grupos únicos: {stats['grupos']}",
        f"Consultas FIPE (cache miss): {len(set(cache.keys()) - cache_before)}",
        f"Vinculados: {stats['vinculados']} (em {stats['grupos_ok']} grupos)",
        f"Falhas: {stats['falha']}",
    ]
    for k, v in sorted(stats.items()):
        if k.startswith("falha_") and k != "falha":
            summary_lines.append(f"  {k}: {v}")

    report = {"summary": dict(stats), "details": details, "generated_at": datetime.now(timezone.utc).isoformat()}
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    REPORT_TXT.write_text("\n".join(summary_lines) + "\n", encoding="utf-8")
    if args.emit_sql:
        emit_sql_updates(Path(args.emit_sql), sql_updates)
        print(f"SQL emitido: {args.emit_sql} ({len(sql_updates)} grupos)")
    print("\n".join(summary_lines))
    print(f"Relatório: {REPORT_TXT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
