# -*- coding: utf-8 -*-
import json
from pathlib import Path

p = Path(r"C:\Users\Administrador\Documents\App\tope\.tmp")


def split_tuples(sql: str):
    body = sql.split("VALUES", 1)[1].strip().rstrip(";").strip()
    rows = []
    i = 0
    n = len(body)
    while i < n:
        while i < n and body[i] in " \n\r\t,":
            i += 1
        if i >= n or body[i] != "(":
            break
        i += 1
        fields = []
        while i < n:
            while i < n and body[i] in " \n\t":
                i += 1
            if i >= n:
                break
            if body[i] == ")":
                i += 1
                break
            if body[i] == "'":
                i += 1
                buf = []
                while i < n:
                    if body[i] == "'" and i + 1 < n and body[i + 1] == "'":
                        buf.append("'")
                        i += 2
                        continue
                    if body[i] == "'":
                        i += 1
                        break
                    buf.append(body[i])
                    i += 1
                val = "".join(buf)
                if i < n and body.startswith("::uuid", i):
                    i += 6
                fields.append(val)
            elif body.startswith("NULL", i):
                fields.append(None)
                i += 4
                if i < n and body.startswith("::uuid", i):
                    i += 6
            elif body.startswith("CURRENT_DATE", i):
                fields.append("CURRENT_DATE")
                i += 12
            else:
                j = i
                while j < n and body[j] not in ",)":
                    j += 1
                num = body[i:j].strip()
                if "." in num:
                    fields.append(float(num))
                elif num:
                    fields.append(int(num))
                else:
                    fields.append(None)
                i = j
            while i < n and body[i] in " \t":
                i += 1
            if i < n and body[i] == ",":
                i += 1
        rows.append(fields)
    return rows


impl = []
for f in sorted(p.glob("ins_impl_*.sql")):
    for r in split_tuples(f.read_text(encoding="utf-8")):
        impl.append(
            {
                "id": r[0],
                "nome": r[1],
                "valor": r[2],
                "nf": r[3],
                "implementadora_id": r[4],
                "observacoes": r[5],
            }
        )

acop = []
for f in sorted(p.glob("ins_acop_*.sql")):
    for r in split_tuples(f.read_text(encoding="utf-8")):
        acop.append({"veiculo_id": r[0], "implemento_id": r[1]})

mov = []
for f in sorted(p.glob("ins_mov_*.sql")):
    for r in split_tuples(f.read_text(encoding="utf-8")):
        mov.append(
            {
                "veiculo_id": r[0],
                "implemento_id": r[1],
                "tipo": r[2],
                "descricao": r[3],
            }
        )

print("impl", len(impl), "acop", len(acop), "mov", len(mov))
print("sample impl", impl[0])
print("sample acop", acop[0])


def chunks(arr, size, prefix):
    n = 0
    for i in range(0, len(arr), size):
        (p / f"{prefix}_{n:02d}.json").write_text(
            json.dumps(arr[i : i + size], ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        n += 1
    return n


print("chunks", chunks(impl, 80, "j_impl"), chunks(acop, 120, "j_acop"), chunks(mov, 80, "j_mov"))
