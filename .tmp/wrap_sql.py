# -*- coding: utf-8 -*-
from pathlib import Path

p = Path(r"C:\Users\Administrador\Documents\App\tope\.tmp")
TAG = "$tope$"

for f in sorted(p.glob("j_impl_*.json")):
    js = f.read_text(encoding="utf-8")
    sql = (
        "INSERT INTO frota_implementos (id, nome, valor, nf, implementadora_id, observacoes)\n"
        "SELECT * FROM jsonb_to_recordset("
        + TAG
        + js
        + TAG
        + ") AS x(id uuid, nome text, valor numeric, nf text, implementadora_id uuid, observacoes text);\n"
    )
    dest = p / ("w_" + f.name.replace(".json", ".sql"))
    dest.write_text(sql, encoding="utf-8")
    print(dest.name, dest.stat().st_size, sql[70:110])

for f in sorted(p.glob("j_acop_*.json")):
    js = f.read_text(encoding="utf-8")
    sql = (
        "INSERT INTO frota_acoplamentos (veiculo_id, implemento_id, data_inicio)\n"
        "SELECT veiculo_id, implemento_id, CURRENT_DATE\n"
        "FROM jsonb_to_recordset("
        + TAG
        + js
        + TAG
        + ") AS x(veiculo_id uuid, implemento_id uuid);\n"
    )
    dest = p / ("w_" + f.name.replace(".json", ".sql"))
    dest.write_text(sql, encoding="utf-8")
    print(dest.name, dest.stat().st_size)

for f in sorted(p.glob("j_mov_*.json")):
    js = f.read_text(encoding="utf-8")
    sql = (
        "INSERT INTO frota_movimentacoes (veiculo_id, implemento_id, tipo, descricao)\n"
        "SELECT veiculo_id, implemento_id, tipo, descricao\n"
        "FROM jsonb_to_recordset("
        + TAG
        + js
        + TAG
        + ") AS x(veiculo_id uuid, implemento_id uuid, tipo text, descricao text);\n"
    )
    dest = p / ("w_" + f.name.replace(".json", ".sql"))
    dest.write_text(sql, encoding="utf-8")
    print(dest.name, dest.stat().st_size)
