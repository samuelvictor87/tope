# -*- coding: utf-8 -*-
"""One-off parser: CONTROLE TOPE + clientes_tope.xlsx -> SQL batches for clientes."""
from __future__ import annotations

import json
import re
import unicodedata
import uuid
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
CONTROLE = Path(r"C:\Users\samue\Downloads\CONTROLE TOPE.xlsx")
CLIENTES = Path(r"C:\Users\samue\Downloads\clientes_tope.xlsx")

BATCH_SIZE = 50

SENTINELS = {
    "CLIENTE",
    "N/A",
    "NA",
    "N.A",
    "N.A.",
    "VERIFICAR",
    "-",
    "—",
    "NONE",
    "NULL",
    "SEM",
    "TOPE",
    "VENDIDO",
    "REVENDA",
    "ROUBADO",
    "DEMONSTRACAO",
    "IMPLEMENTO",
}

STOP_TOKENS = {"DE", "DA", "DO", "DAS", "DOS", "E", "LTDA", "SA", "S", "A", "ME", "EPP", "SPE", "LTDA."}

# CONTROLE name (normalized prefix) -> catalog search substring
ALIASES: dict[str, str] = {
    "LVE LOCADORA": "LVE - LOCADORA DE VEICULOS",
    "GRI KOLETA": "GRI KOLETA - GERENCIAMENTO",
    "LOGISTICA AMBIENTAL DE SAO PAULO": "LOGISTICA AMBIENTAL DE SAO PAULO",
    "SUSTENTARE VARRICAO PMSP": "SUSTENTARE SANEAMENTO",
    "SUSTENTARE SANEAMENTO": "SUSTENTARE SANEAMENTO",
    "BRUMA COMERCIO": "BRUMA COMERCIO DE PNEUS",
    "VEOLIA SERVICOS AMBIENTAIS": "VEOLIA SERVICOS AMBIENTAIS",
    "CPLU FBF": "CPLU SPE",
    "CPLU - FBF": "CPLU SPE",
    "ESTRE NOVA": "ESTRE AMBIENTAL",
    "CRVR RIOGRANDENSE": "CRVR - RIOGRANDENSE",
    "AGILIX": "AGILIX SERVICOS LOGISTICOS",
    "FENIX": "ELETRONICA FENIX",
    "RENOSUL": "RENOSUL RENOVADORA",
    "RANI LOG": "RANI LOGISTICA",
    "LSP REIS FRIOZER": "LSP REIS TRANSPORTES",
    "MAX DRIVE PNEUS LTDA BRUMA": "MAX DRIVE PNEUS",
    "YOUGREEN COOPERATIVA": "YOUGREEN COOP",
    "GLOBALSHIP CEDIDO PARA SANTOS PORT AUTHORITY": "GLOBALSHIP",
    "MINASAGRO PARTICIPACOES E EMPREENDIMENTOS": "MINASAGRO PARTICIPACOES",
    "FTI LOGISTICA E TRANSPORTE": "FTI LOGISTICA",
    "CONSORCIO REGIONAL PARA SOLUCOES AMBIENTAIS CORSAM": "CORSAM",
}

# CNPJs already in Supabase clientes (digits only)
EXISTING_CNPJS = {
    "51903449000109",
    "51903449000108",
    "23965472000184",
    "49517995000151",
    "41546515156155",
}


def strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def norm_name(s: str | None) -> str:
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ""
    t = strip_accents(str(s).upper())
    t = re.sub(r"[^A-Z0-9 ]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def norm_cnpj_digits(v) -> str | None:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, float):
        s = str(int(v))
    else:
        s = re.sub(r"\D", "", str(v))
    if len(s) < 11:
        return None
    return s.zfill(14) if len(s) <= 14 else s[:14]


def fmt_cnpj(digits: str) -> str:
    d = re.sub(r"\D", "", digits)
    if len(d) != 14:
        return digits
    return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:14]}"


def validar_cnpj(cnpj: str) -> bool:
    clean = re.sub(r"\D", "", cnpj)
    if len(clean) != 14:
        return False
    if re.fullmatch(r"(\d)\1{13}", clean):
        return False
    nums = [int(c) for c in clean]
    w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    s = sum(n * w for n, w in zip(nums[:12], w1)) % 11
    d1 = 0 if s < 2 else 11 - s
    if d1 != nums[12]:
        return False
    s = sum(n * w for n, w in zip(nums[:13], w2)) % 11
    d2 = 0 if s < 2 else 11 - s
    return d2 == nums[13]


def sig_tokens(s: str) -> list[str]:
    return [t for t in s.split() if t not in STOP_TOKENS and len(t) > 2]


def should_skip_name(raw: str) -> bool:
    n = norm_name(raw)
    if not n or n in SENTINELS:
        return True
    u = raw.upper()
    if "REVENDA" in u and "DESMOBILIZ" in u:
        return True
    if u.startswith("GRI (PROJETO"):
        return True
    if u.startswith("REVENDA ("):
        return True
    return False


def split_endereco(endereco: str | None) -> tuple[str | None, str | None]:
    if not endereco or (isinstance(endereco, float) and pd.isna(endereco)):
        return None, None
    s = str(endereco).strip()
    m = re.match(r"^(.+?)[,\s]+(\d+[A-Za-z]?)\s*$", s)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return s, None


def fmt_cep(v) -> str | None:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, float):
        s = str(int(v)).zfill(8)
    else:
        s = re.sub(r"\D", "", str(v)).zfill(8)
    if len(s) != 8:
        return str(v).strip() or None
    return f"{s[:5]}-{s[5:]}"


def fmt_phone(v) -> str | None:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v).strip()
    if not s or s.lower() == "nan":
        return None
    digits = re.sub(r"\D", "", s)
    if not digits:
        return s
    if len(digits) == 11:
        return f"({digits[:2]}) {digits[2:3]} {digits[3:7]}-{digits[7:]}"
    if len(digits) == 10:
        return f"({digits[:2]}) {digits[2:6]}-{digits[6:]}"
    return s


def fmt_ie(v) -> str | None:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    s = str(v).strip()
    if not s or s.lower() == "nan":
        return None
    if isinstance(v, float) and v == int(v):
        return str(int(v))
    return s


def sql_str(v: str | None) -> str:
    if v is None:
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def completeness(row: pd.Series) -> int:
    score = 0
    for col in ("EMAIL", "TELEFONE", "ENDERECO", "CEP", "BAIRRO", "SIM_MUNICIPIO"):
        val = row.get(col)
        if val is not None and not (isinstance(val, float) and pd.isna(val)):
            if str(val).strip():
                score += 1
    return score


def pick_best(candidates: pd.DataFrame) -> pd.Series:
    c = candidates.copy()
    c["_cnpj"] = c["INSCRICAO_FEDERAL"].apply(norm_cnpj_digits)
    c["_matriz"] = c["_cnpj"].apply(lambda x: bool(isinstance(x, str) and x.endswith("0001")))
    c["_score"] = c.apply(completeness, axis=1)
    c = c.sort_values(["_matriz", "_score"], ascending=[False, False])
    return c.iloc[0]


def find_match(raw_name: str, cat: pd.DataFrame) -> tuple[pd.Series | None, str]:
    n = norm_name(raw_name)
    if not n:
        return None, "empty"

    exact = cat[cat["n"] == n]
    if len(exact):
        return pick_best(exact), "exact"

    for alias_key, search in ALIASES.items():
        if n.startswith(alias_key) or alias_key in n:
            hits = cat[cat["RAZAO_SOCIAL"].astype(str).str.upper().str.contains(
                strip_accents(search).upper(), na=False, regex=False
            )]
            if len(hits):
                return pick_best(hits), f"alias:{alias_key}"

    pref = n[:20]
    prefix_hits = cat[cat["n"].str.startswith(pref) | cat["n"].str.contains(re.escape(pref[:12]), na=False, regex=True)]
    if len(prefix_hits) == 1:
        return prefix_hits.iloc[0], "prefix"
    if len(prefix_hits) > 1:
        return pick_best(prefix_hits), "prefix_multi"

    toks = sig_tokens(n)[:4]
    if len(toks) >= 2:
        mask = pd.Series(True, index=cat.index)
        for t in toks[:3]:
            mask &= cat["n"].str.contains(re.escape(t), na=False, regex=True)
        hits = cat[mask]
        if len(hits) >= 1:
            return pick_best(hits), "tokens"

    return None, "no_match"


def row_to_client(raw_name: str, row: pd.Series, match_kind: str) -> dict | None:
    cnpj_digits = norm_cnpj_digits(row.get("INSCRICAO_FEDERAL"))
    if not cnpj_digits:
        return None
    if not validar_cnpj(cnpj_digits):
        return None

    endereco, numero = split_endereco(row.get("ENDERECO"))
    email = row.get("EMAIL")
    if pd.isna(email):
        email = None
    else:
        email = str(email).strip() or None

    return {
        "controle_name": raw_name,
        "match_kind": match_kind,
        "razao_social": str(row["RAZAO_SOCIAL"]).strip(),
        "cnpj": fmt_cnpj(cnpj_digits),
        "cnpj_digits": cnpj_digits,
        "inscricao_estadual": fmt_ie(row.get("INSCRICAO_ESTADUAL")),
        "contato_email": email,
        "contato_telefone": fmt_phone(row.get("TELEFONE")),
        "cep": fmt_cep(row.get("CEP")),
        "endereco": endereco,
        "numero": numero,
        "complemento": None if pd.isna(row.get("COMPLEMENTO")) else str(row["COMPLEMENTO"]).strip() or None,
        "bairro": None if pd.isna(row.get("BAIRRO")) else str(row["BAIRRO"]).strip() or None,
        "cidade": None if pd.isna(row.get("SIM_MUNICIPIO")) else str(row["SIM_MUNICIPIO"]).strip() or None,
        "estado": None if pd.isna(row.get("SIM_UF")) else str(row["SIM_UF"]).strip() or None,
    }


def client_sql(rec: dict) -> str:
    cid = str(uuid.uuid4())
    cols = [
        "id", "razao_social", "cnpj", "inscricao_estadual",
        "contato_email", "contato_telefone",
        "cep", "endereco", "numero", "complemento", "bairro", "cidade", "estado",
    ]
    vals = [
        f"'{cid}'::uuid",
        sql_str(rec["razao_social"]),
        sql_str(rec["cnpj"]),
        sql_str(rec.get("inscricao_estadual")),
        sql_str(rec.get("contato_email")),
        sql_str(rec.get("contato_telefone")),
        sql_str(rec.get("cep")),
        sql_str(rec.get("endereco")),
        sql_str(rec.get("numero")),
        sql_str(rec.get("complemento")),
        sql_str(rec.get("bairro")),
        sql_str(rec.get("cidade")),
        sql_str(rec.get("estado")),
    ]
    return f"INSERT INTO public.clientes ({', '.join(cols)}) VALUES ({', '.join(vals)});"


def main():
    ctrl = pd.read_excel(CONTROLE, sheet_name="Planilha1", header=1)
    cat = pd.read_excel(CLIENTES)
    cat["n"] = cat["RAZAO_SOCIAL"].apply(norm_name)

    raw_names = sorted(
        set(str(x).strip() for x in ctrl["CLIENTE"].dropna() if not should_skip_name(str(x).strip()))
    )

    matched: list[dict] = []
    no_match: list[str] = []
    skipped_sentinel = []
    skipped_existing: list[dict] = []
    skipped_invalid: list[tuple[str, str]] = []
    seen_cnpj: set[str] = set(EXISTING_CNPJS)

    for raw in raw_names:
        row, kind = find_match(raw, cat)
        if row is None:
            no_match.append(raw)
            continue
        client = row_to_client(raw, row, kind)
        if client is None:
            skipped_invalid.append((raw, "sem CNPJ valido"))
            continue
        digits = client["cnpj_digits"]
        if digits in seen_cnpj:
            skipped_existing.append(client)
            continue
        seen_cnpj.add(digits)
        matched.append(client)

    preview = {
        "summary": {
            "controle_unique": len(raw_names),
            "to_insert": len(matched),
            "no_match": len(no_match),
            "skipped_existing_cnpj": len(skipped_existing),
            "skipped_invalid": len(skipped_invalid),
        },
        "clients": matched,
        "no_match": no_match,
    }
    (ROOT / "clientes_import_preview.json").write_text(
        json.dumps(preview, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    lines = [
        "=== Clientes import report ===",
        f"Unique names in CONTROLE: {len(raw_names)}",
        f"To insert: {len(matched)}",
        f"No match: {len(no_match)}",
        f"Skipped (CNPJ already exists): {len(skipped_existing)}",
        f"Skipped (invalid CNPJ): {len(skipped_invalid)}",
        "",
        "--- No match ---",
    ]
    lines.extend(f"  {x}" for x in no_match)
    lines.extend(["", "--- Skipped existing ---"])
    for c in skipped_existing:
        lines.append(f"  {c['controle_name']} -> {c['cnpj']} ({c['razao_social'][:50]})")
    (ROOT / "clientes_import_report.txt").write_text("\n".join(lines), encoding="utf-8")

    batches = [matched[i : i + BATCH_SIZE] for i in range(0, len(matched), BATCH_SIZE)]
    for bi, batch in enumerate(batches, 1):
        sql_lines = [client_sql(r) for r in batch]
        (ROOT / f"ins_clientes_{bi:03d}.sql").write_text("\n".join(sql_lines) + "\n", encoding="utf-8")

    print(json.dumps(preview["summary"], indent=2))
    print(f"Wrote {len(batches)} SQL batch(es) to {ROOT}")


if __name__ == "__main__":
    main()
