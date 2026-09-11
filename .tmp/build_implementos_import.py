# -*- coding: utf-8 -*-
"""One-off parser: CONTROLE TOPE.xlsx -> SQL batches for frota implementos."""
from __future__ import annotations

import json
import re
import uuid
from collections import Counter
from datetime import date, datetime
from pathlib import Path

import openpyxl

ROOT = Path(r"C:\Users\Administrador\Documents\App\tope\.tmp")
XLSX = Path(r"C:\Users\Administrador\Downloads\CONTROLE TOPE.xlsx")
VEHICLES_MCP = Path(
    r"C:\Users\Administrador\.cursor\projects\c-Users-Administrador-Documents-App-tope\agent-tools\e71ab3b4-e0f0-447e-9543-d3746e6dfb2a.txt"
)

IMPLEMENTADORAS = [
    ("5128d7c1-0cbe-4a18-82e2-71c182582208", "4TRUCK"),
    ("dfc26fa7-5334-4d51-ae6a-bd274630c4c2", "AGILIX"),
    ("d241ed9f-001f-4af2-a274-d09623180e1f", "ALENCAR"),
    ("bf8eea15-cdf4-4fec-8728-a47013feb800", "BEXTRA"),
    ("acdca8ba-9f87-40c8-a772-0f9ccd18ea3e", "BRASCAR"),
    ("080d5277-29da-47ed-a53b-a433a4be428a", "BUSA"),
    ("07fea100-b40a-4d21-af50-01c1a093dd11", "CINOMATIC"),
    ("1a813f68-be48-4584-944c-8169d68bebae", "DHOLLANDA"),
    ("7a0c8421-967f-4251-bdbd-539c79a24472", "ECOSOL"),
    ("afb0c939-5dc5-4d68-a14f-2d901233701c", "EDARP"),
    ("4166b486-a286-4d81-98bc-9d173feb19f6", "ENVESP"),
    ("4f2e44e8-9eb0-408f-acaf-cba1fc615566", "EURO VAC"),
    ("6e7b3228-f4ae-40c3-96e9-655b87515172", "FACCHINI"),
    ("fbb8a7c4-d5bb-43ea-8897-d22247990aac", "GC BRASIL"),
    ("01ae8e17-059a-40bf-a7d9-b862404e4dd7", "GRIMALDI"),
    ("0199d68a-9f6f-4879-a316-347f8a54719c", "HB GARRAS"),
    ("718152ef-1540-42c7-ace6-9a0bcd1c5a6e", "HBZ"),
    ("a11f12a1-5e05-4af4-95ca-83910dcd5639", "HI AB BRASIL"),
    ("a0543d31-4682-4b38-8cdd-6b39757631f6", "HYVA"),
    ("6fe7fb0f-0226-423e-a9f4-d6ce73eaa58e", "IMPACTO"),
    ("13cb7351-b169-4e6e-aa79-79be2c06850f", "INFINITTY"),
    ("7209145c-88fd-4fff-826b-fbbf656d7394", "KABI INDUSTRIA"),
    ("8e911670-170a-4528-a811-620e0c272b6f", "L AND M"),
    ("62a3518f-a331-4618-a01c-4add415d73fb", "LIEBHERR"),
    ("4ee58087-2cd0-452e-afc9-c1348143f0cd", "MANSIL"),
    ("eda53713-1f66-4f40-ba16-f0d4620d0538", "MASAL"),
    ("2b5e6b32-0c35-4b96-bcb7-600ccd0b4317", "MAX FORT"),
    ("3841bb06-48ec-4f79-9cf0-e16b217b6eb5", "NEXT"),
    ("6acf5cbb-561f-4f4f-9cb9-5a067a3b5811", "PETRIUN"),
    ("98c87219-af74-4e55-873c-bdc36eab18d9", "PHD"),
    ("24a93b7e-d9ba-4e82-95dc-c5052f681493", "PLANALTO"),
    ("1e09a9be-2282-4211-941e-c82f6e41efa4", "RANDON"),
    ("664a8fa9-c40c-468c-b4ae-73c359753f36", "REP INDUSTRIA"),
    ("6ef37c74-a569-401c-a57d-b26ab61e8b0e", "REP INDUSTRIA PAVAN"),
    ("24e8eed7-2773-49cc-868c-4faa5fc36591", "RODA DE OURO"),
    ("31374f57-698b-4737-b237-520c61ba2844", "RODOTEC"),
    ("11076517-c31b-4396-905c-77ca6b5b43a3", "S.C.A"),
    ("76e9dad4-9952-411c-aa26-825e55434bf8", "SIBRAVAC"),
    ("560b1d29-8422-4ba4-b074-70274f937172", "SL IMPLEMENTOS"),
    ("4caa6759-f81e-4b8b-92dc-4d051b2e18ca", "TANESFIL"),
    ("c342b991-c25b-48c4-ba35-b65d22221db6", "TECNICA BASCO"),
    ("9b781b9e-c968-410c-9390-dc79ab9cc658", "TKA"),
    ("2a29552b-5691-46c5-a265-2e365afb2b8a", "TRUCK POINT"),
    ("b9ef1856-7af4-4034-b625-49e8a4f708f6", "USIMECA"),
    ("07090267-25a4-45e7-872b-bd1fed5f6a8e", "ZOOMLION"),
]

VALUE_COLS = {
    32: "NEXT",
    33: "FACCHINI",
    34: "TANESFIL",
    35: "KABI INDUSTRIA",
    36: "RODOTEC",
    37: "HBZ",
    38: "GRIMALDI",
    39: "USIMECA",
    40: "DHOLLANDA",
    41: "ALENCAR",
    42: "LIEBHERR",
    43: "ZOOMLION",
    44: "TECNICA BASCO",
    45: "4TRUCK",
    46: "ENVESP",
    47: "RANDON",
    48: "HYVA",
    49: "TRUCK POINT",
    50: "PHD",
    51: "ECOSOL",
    52: "HI AB BRASIL",
    53: "PETRIUN",
    54: "IMPACTO",
    55: "CINOMATIC",
    56: "MAX FORT",
    57: "BEXTRA",
    58: "SIBRAVAC",
    59: "REP INDUSTRIA",
    60: "BRASCAR",
    61: "RODA DE OURO",
    62: "PLANALTO",
    63: "HB GARRAS",
    64: "MANSIL",
    65: "REP INDUSTRIA. PAVAN",
    66: "TKA",
    67: "BUSA",
    68: "EDARP",
    69: "MASAL",
    70: "S.C.A",
    71: "SL IMPLEMENTOS",
    72: "AGILIX",
    73: "GC BRASIL",
    74: "EURO VAC",
    75: "INFINITTY",
    76: "L & M",
}

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
}

FAKE_PLATES = {
    "VERIFICAR",
    "POLINGUIDASTE",
    "GUINDASTE",
    "POLIDUPLO",
    "POLIDUPLO",
    "IMPLEMENTO",
    "SEMIRREBOQUE",
    "EMPILHADEIRA",
    "POLI DUPLO",
}

ALIASES = {
    "L AND M": "L AND M",
    "BASCO": "TECNICA BASCO",
    "TECNICA BASCO": "TECNICA BASCO",
    "TRUCKPOINT": "TRUCK POINT",
    "TRUCK POINT": "TRUCK POINT",
    "SCA": "S.C.A",
    "S C A": "S.C.A",
    "SL EQUIPAMENTO": "SL IMPLEMENTOS",
    "SL EQUIPAMENTOS": "SL IMPLEMENTOS",
    "MAX": "MAX FORT",
    "MAX FORT": "MAX FORT",
    "HIAB": "HI AB BRASIL",
    "HI AB": "HI AB BRASIL",
    "HI AB BRASIL": "HI AB BRASIL",
    "RANDOM": "RANDON",
    "RODA DEOURO": "RODA DE OURO",
    "RODA DE OURO": "RODA DE OURO",
    "EUROVAC": "EURO VAC",
    "EURO VAC": "EURO VAC",
    "CINOMATIC DO BRASIL IND COM MAQUINAS LTDA": "CINOMATIC",
    "REP INDUSTRIA PAVAN": "REP INDUSTRIA PAVAN",
    "HBGARRAS": "HB GARRAS",
    "HB GARRAS": "HB GARRAS",
}


def norm_key(s: str | None) -> str:
    if not s:
        return ""
    t = str(s).upper().replace("&", "AND")
    t = t.replace(".", " ")
    t = re.sub(r"[^A-Z0-9 ]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def canonical_impl(name: str | None) -> str | None:
    key = norm_key(name)
    if not key or key in {norm_key(x) for x in SENTINELS}:
        return None
    if key in ALIASES:
        return ALIASES[key]
    # prefix match against DB names
    for _id, nome in IMPLEMENTADORAS:
        if norm_key(nome) == key:
            return nome
    for alias, target in ALIASES.items():
        if key.startswith(norm_key(alias) + " ") or key.startswith(norm_key(alias)):
            if len(key) - len(norm_key(alias)) < 8:
                return target
    return None


DB_BY_CANON = {norm_key(n): i for i, n in IMPLEMENTADORAS}


def impl_id(canon: str | None) -> str | None:
    if not canon:
        return None
    return DB_BY_CANON.get(norm_key(canon))


def money(v) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("R$", "").replace("\xa0", " ").strip()
    if not s or s in {"-", "—", "R$ -"}:
        return 0.0
    s = s.replace(" ", "")
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def cell(ws, r, c):
    v = ws.cell(r, c).value
    if v is None:
        return None
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    s = str(v).strip()
    return s if s else None


def split_impl_parts(text: str | None) -> list[str]:
    if not text:
        return []
    raw = text.strip()
    if raw.upper() in SENTINELS or raw.upper() == "N/A":
        return []
    parts = re.split(r"\s*/\s*|\s+-\s+", raw)
    out = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if p.upper() in SENTINELS:
            continue
        out.append(p)
    return out


def extract_nfs(nf_raw: str | None, impl_order: list[str], n: int) -> list[str | None]:
    result: list[str | None] = [None] * n
    if not nf_raw:
        return result
    s = str(nf_raw).strip()
    if s.upper() in SENTINELS:
        return result

    tagged = re.findall(r"([A-Za-z][A-Za-z0-9 .&]*)\s+NF\s+(\d+)", s, flags=re.I)
    if tagged and impl_order:
        by_impl = {}
        for name, num in tagged:
            can = canonical_impl(name)
            if can:
                by_impl[norm_key(can)] = num
        assigned = False
        for i, impl_name in enumerate(impl_order[:n]):
            can = canonical_impl(impl_name)
            if can and norm_key(can) in by_impl:
                result[i] = by_impl[norm_key(can)]
                assigned = True
        if assigned:
            return result

    if re.search(r"/", s) and s.upper() != "N/A":
        parts = [p.strip() for p in re.split(r"\s*/\s*", s) if p.strip()]
        parts = [re.sub(r"^(NF\s*)", "", p, flags=re.I).strip() for p in parts]
        for i in range(min(n, len(parts))):
            result[i] = parts[i] or None
        return result

    # single
    cleaned = re.sub(r"^(NF\s*)", "", s, flags=re.I).strip()
    if n == 1:
        result[0] = cleaned
    elif impl_order:
        result[0] = cleaned
    return result


def split_names(nome: str | None, n: int) -> list[str]:
    fallback = (nome or "").strip() or "Implemento"
    if n <= 1:
        return [fallback]
    if not nome:
        return [fallback] * n
    if " / " in nome:
        parts = [p.strip() for p in nome.split(" / ") if p.strip()]
        if len(parts) == n:
            return parts
    parts = [p.strip() for p in re.split(r"\s*/\s*", nome) if p.strip()]
    if len(parts) == n:
        return parts
    return [fallback] * n


def is_equip_row(modelo: str | None, chassi: str | None) -> bool:
    m = (modelo or "").upper()
    c = (chassi or "").upper()
    return (
        m in {"IMPLEMENTO", "REBOQUE"}
        or "ROLL ON" in m
        or m.startswith("EMPILHA")
        or c in {"IMPLEMENTO", "SEMIRREBOQUE", "EMPILHADEIRA"}
        or "EMPILHA" in c
    )


def parse_coupled_plate(nome: str | None) -> str | None:
    if not nome:
        return None
    m = re.search(
        r"(?:ACLOPADO|ACOPLADO)\s+NO\s+VEI[CÇ]ULO\s+([A-Z]{3}\d[A-Z0-9]{3,4})",
        nome.upper(),
    )
    return m.group(1) if m else None


def norm_placa(p: str | None) -> str:
    return re.sub(r"[^A-Z0-9]", "", (p or "").upper())


def sql_str(v: str | None) -> str:
    if v is None:
        return "NULL"
    return "'" + v.replace("'", "''") + "'"


def sql_num(v: float | None) -> str:
    if v is None:
        return "NULL"
    return f"{v:.2f}"


def load_vehicles():
    wrapper = json.loads(VEHICLES_MCP.read_text(encoding="utf-8"))
    raw = wrapper.get("result") or ""
    start = raw.find("[")
    end = raw.rfind("]")
    blob = raw[start : end + 1]
    outer = json.loads(blob)
    data = outer
    if isinstance(data, list) and data and isinstance(data[0], dict) and "json_agg" in data[0]:
        data = data[0]["json_agg"]
    elif isinstance(data, dict) and "json_agg" in data:
        data = data["json_agg"]
    by_placa: dict[str, dict] = {}
    by_chassi: dict[str, dict] = {}
    for v in data:
        p = norm_placa(v.get("placa"))
        c = norm_placa(v.get("chassi"))
        if p and p not in FAKE_PLATES:
            by_placa.setdefault(p, v)
        if c and len(c) >= 8:
            by_chassi.setdefault(c, v)
    return by_placa, by_chassi, len(data)


def find_vehicle(by_placa, by_chassi, placa, chassi, nome, equip):
    if equip:
        hint = parse_coupled_plate(nome)
        if hint:
            return by_placa.get(norm_placa(hint))
        return None
    np = norm_placa(placa)
    if np and np not in FAKE_PLATES and len(np) >= 6:
        hit = by_placa.get(np)
        if hit:
            return hit
    nc = norm_placa(chassi)
    if nc and len(nc) >= 8 and nc not in {"IMPLEMENTO", "SEMIRREBOQUE", "EMPILHADEIRA"}:
        return by_chassi.get(nc)
    return None


def main():
    by_placa, by_chassi, nveh = load_vehicles()
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb["Planilha1"]

    records = []
    unknown = Counter()
    skipped = 0
    n_one = n_multi = n_cliente = n_livre = n_acopla = 0
    mismatch = 0

    for r in range(3, ws.max_row + 1):
        placa = cell(ws, r, 3)
        chassi = cell(ws, r, 11)
        modelo = cell(ws, r, 16)
        impl_raw = cell(ws, r, 30)
        nf_raw = cell(ws, r, 31)
        nome_raw = cell(ws, r, 78)
        total = money(ws.cell(r, 77).value)

        vals = []
        for c, colname in VALUE_COLS.items():
            mv = money(ws.cell(r, c).value)
            if mv is not None and abs(mv) > 0.009:
                vals.append((colname, mv))

        has_anything = bool(nome_raw) or bool(vals) or (
            impl_raw and str(impl_raw).strip().upper() not in SENTINELS
        )
        if not has_anything:
            skipped += 1
            continue

        impl_parts_raw = split_impl_parts(impl_raw)
        # Prefer value columns as the list of implementos
        if vals:
            items_meta = []
            for colname, mv in vals:
                can = canonical_impl(colname)
                if not can:
                    unknown[colname] += 1
                items_meta.append({"col": colname, "canon": can, "valor": mv})
            n = len(items_meta)
            if n >= 2:
                n_multi += 1
            else:
                n_one += 1
            name_parts_n = len(impl_parts_raw) if len(impl_parts_raw) == n else n
            names = split_names(nome_raw, name_parts_n)
            nf_by_canon = {}
            name_by_canon = {}
            nfs = extract_nfs(nf_raw, [canonical_impl(p) or p for p in impl_parts_raw], max(n, len(impl_parts_raw) or n))
            for i, part in enumerate(impl_parts_raw):
                can = canonical_impl(part)
                if not can:
                    continue
                if i < len(nfs):
                    nf_by_canon[norm_key(can)] = nfs[i]
                if i < len(names):
                    name_by_canon[norm_key(can)] = names[i]
            names_by_count = split_names(nome_raw, n)
            for i, meta in enumerate(items_meta):
                can = meta["canon"]
                nf = None
                if can and norm_key(can) in nf_by_canon:
                    nf = nf_by_canon[norm_key(can)]
                elif n == 1:
                    nf = nfs[0] if nfs else None
                elif i < len(nfs) and not nf_by_canon:
                    nf = nfs[i]
                if can and norm_key(can) in name_by_canon:
                    nome = name_by_canon[norm_key(can)]
                else:
                    nome = names_by_count[i] if i < len(names_by_count) else (nome_raw or can or "Implemento")
                if not nome:
                    nome = can or "Implemento"
                iid = str(uuid.uuid4())
                records.append(
                    {
                        "id": iid,
                        "nome": nome[:500],
                        "valor": round(meta["valor"], 2),
                        "nf": (str(nf)[:80] if nf else None),
                        "implementadora_id": impl_id(can),
                        "implementadora": can,
                        "obs": f"import:row:{r}#{i}",
                        "row": r,
                        "placa": placa,
                        "chassi": chassi,
                        "modelo": modelo,
                    }
                )
            if vals and total is not None:
                s = sum(v for _, v in vals)
                if abs(s - (total or 0)) > 1.5:
                    mismatch += 1
        else:
            # no spend columns
            known_parts = []
            for part in impl_parts_raw:
                can = canonical_impl(part)
                if can:
                    known_parts.append(can)
                else:
                    if norm_key(part) not in {norm_key(x) for x in SENTINELS}:
                        unknown[part] += 1
            nome = (nome_raw or "").strip()
            if not nome and not known_parts:
                skipped += 1
                continue
            n_cliente += 1
            if known_parts:
                names = split_names(nome_raw, len(known_parts))
                nfs = extract_nfs(nf_raw, known_parts, len(known_parts))
                for i, can in enumerate(known_parts):
                    records.append(
                        {
                            "id": str(uuid.uuid4()),
                            "nome": (names[i] if i < len(names) else nome or can)[:500],
                            "valor": None,
                            "nf": (str(nfs[i])[:80] if i < len(nfs) and nfs[i] else None),
                            "implementadora_id": impl_id(can),
                            "implementadora": can,
                            "obs": f"import:row:{r}#{i}",
                            "row": r,
                            "placa": placa,
                            "chassi": chassi,
                            "modelo": modelo,
                        }
                    )
            else:
                if not nome:
                    skipped += 1
                    continue
                nf = None if not nf_raw or str(nf_raw).upper() in SENTINELS else str(nf_raw).strip()
                records.append(
                    {
                        "id": str(uuid.uuid4()),
                        "nome": nome[:500],
                        "valor": None,
                        "nf": (nf[:80] if nf else None),
                        "implementadora_id": None,
                        "implementadora": None,
                        "obs": f"import:row:{r}#0",
                        "row": r,
                        "placa": placa,
                        "chassi": chassi,
                        "modelo": modelo,
                    }
                )

    # resolve vehicles
    for rec in records:
        equip = is_equip_row(rec["modelo"], rec["chassi"])
        veh = find_vehicle(by_placa, by_chassi, rec["placa"], rec["chassi"], rec["nome"], equip)
        rec["veiculo_id"] = veh["id"] if veh else None
        rec["veiculo_placa"] = (veh or {}).get("placa")
        if rec["veiculo_id"]:
            n_acopla += 1
        else:
            n_livre += 1

    wb.close()

    # SQL batches
    impl_sqls = []
    acop_sqls = []
    mov_sqls = []
    BATCH = 40

    def flush_impl(buf):
        if not buf:
            return
        lines = []
        for rec in buf:
            lines.append(
                f"({sql_str(rec['id'])}::uuid, {sql_str(rec['nome'])}, {sql_num(rec['valor'])}, "
                f"{sql_str(rec['nf'])}, {sql_str(rec['implementadora_id'])}{'::uuid' if rec['implementadora_id'] else ''}, {sql_str(rec['obs'])})"
            )
        impl_sqls.append(
            "INSERT INTO frota_implementos (id, nome, valor, nf, implementadora_id, observacoes) VALUES\n"
            + ",\n".join(lines)
            + ";"
        )

    def flush_acop(buf):
        if not buf:
            return
        lines = []
        for rec in buf:
            lines.append(
                f"({sql_str(rec['veiculo_id'])}::uuid, {sql_str(rec['id'])}::uuid, CURRENT_DATE)"
            )
        acop_sqls.append(
            "INSERT INTO frota_acoplamentos (veiculo_id, implemento_id, data_inicio) VALUES\n"
            + ",\n".join(lines)
            + ";"
        )

    def flush_mov(buf):
        if not buf:
            return
        lines = []
        for rec in buf:
            placa_txt = rec.get("veiculo_placa") or rec.get("placa") or "sem placa"
            if rec.get("veiculo_id"):
                tipo = "acoplamento"
                desc = f"Acoplou {rec['nome'][:80]} no caminhão {placa_txt}"
                vid = sql_str(rec["veiculo_id"]) + "::uuid"
            else:
                tipo = "cadastro"
                desc = f"Cadastrou implemento {rec['nome'][:80]}"
                vid = "NULL"
            lines.append(
                f"({vid}, {sql_str(rec['id'])}::uuid, {sql_str(tipo)}, {sql_str(desc)})"
            )
        mov_sqls.append(
            "INSERT INTO frota_movimentacoes (veiculo_id, implemento_id, tipo, descricao) VALUES\n"
            + ",\n".join(lines)
            + ";"
        )

    buf = []
    for rec in records:
        buf.append(rec)
        if len(buf) >= BATCH:
            flush_impl(buf)
            buf = []
    flush_impl(buf)

    buf = [r for r in records if r["veiculo_id"]]
    chunk = []
    for rec in buf:
        chunk.append(rec)
        if len(chunk) >= BATCH:
            flush_acop(chunk)
            chunk = []
    flush_acop(chunk)

    chunk = []
    for rec in records:
        chunk.append(rec)
        if len(chunk) >= BATCH:
            flush_mov(chunk)
            chunk = []
    flush_mov(chunk)

    ROOT.mkdir(parents=True, exist_ok=True)
    (ROOT / "implementos.json").write_text(
        json.dumps(
            {
                "counts": {
                    "vehicles_loaded": nveh,
                    "records": len(records),
                    "skipped_empty": skipped,
                    "with_value_one": n_one,
                    "with_value_multi": n_multi,
                    "cliente_or_zero": n_cliente,
                    "acoplados": n_acopla,
                    "livres": n_livre,
                    "total_mismatch_rows": mismatch,
                    "unknown": dict(unknown),
                    "impl_sql_batches": len(impl_sqls),
                    "acop_sql_batches": len(acop_sqls),
                    "mov_sql_batches": len(mov_sqls),
                    "sum_valor": round(sum(r["valor"] or 0 for r in records), 2),
                    "with_implementadora": sum(1 for r in records if r["implementadora_id"]),
                    "without_implementadora": sum(1 for r in records if not r["implementadora_id"]),
                },
                "two_sample": [
                    r
                    for r in records
                    if r["obs"].startswith("import:row:44")
                    or r["obs"].startswith("import:row:45")
                    or r["obs"].startswith("import:row:49")
                ],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    for i, sql in enumerate(impl_sqls):
        (ROOT / f"ins_impl_{i:03d}.sql").write_text(sql, encoding="utf-8")
    for i, sql in enumerate(acop_sqls):
        (ROOT / f"ins_acop_{i:03d}.sql").write_text(sql, encoding="utf-8")
    for i, sql in enumerate(mov_sqls):
        (ROOT / f"ins_mov_{i:03d}.sql").write_text(sql, encoding="utf-8")

    def write_json_chunks(prefix, rows, mapper, size=100):
        n = 0
        for i in range(0, len(rows), size):
            payload = [mapper(r) for r in rows[i : i + size]]
            (ROOT / f"{prefix}_{n:02d}.json").write_text(
                json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            n += 1
        return n

    n_impl_json = write_json_chunks(
        "j_impl",
        records,
        lambda r: {
            "id": r["id"],
            "nome": r["nome"],
            "valor": r["valor"],
            "nf": r["nf"],
            "implementadora_id": r["implementadora_id"],
            "observacoes": r["obs"],
        },
    )
    n_acop_json = write_json_chunks(
        "j_acop",
        [r for r in records if r["veiculo_id"]],
        lambda r: {
            "veiculo_id": r["veiculo_id"],
            "implemento_id": r["id"],
        },
    )
    n_mov_json = write_json_chunks(
        "j_mov",
        records,
        lambda r: {
            "veiculo_id": r["veiculo_id"],
            "implemento_id": r["id"],
            "tipo": "acoplamento" if r["veiculo_id"] else "cadastro",
            "descricao": (
                f"Acoplou {r['nome'][:80]} no caminhão {r.get('veiculo_placa') or r.get('placa') or 'sem placa'}"
                if r["veiculo_id"]
                else f"Cadastrou implemento {r['nome'][:80]}"
            ),
        },
    )
    print("json_chunks", n_impl_json, n_acop_json, n_mov_json)

    print(json.dumps(json.loads((ROOT / "implementos.json").read_text(encoding="utf-8"))["counts"], indent=2))
    print("two_sample", json.dumps(json.loads((ROOT / "implementos.json").read_text(encoding="utf-8"))["two_sample"], indent=2, ensure_ascii=False)[:2000])


if __name__ == "__main__":
    main()
