import json
import re
from pathlib import Path

src = Path(r"C:\Users\samue\.cursor\projects\c-Users-samue-Documents-App-tope\agent-tools\21279a76-28ea-4213-bca6-6acf8bae6781.txt")
outer = json.loads(src.read_text(encoding="utf-8"))
text = outer["result"] if isinstance(outer, dict) and "result" in outer else src.read_text(encoding="utf-8")
match = re.search(r"<untrusted-data-[^>]+>\n(\[.*\])\n</untrusted-data", text, re.S)
if not match:
    raise SystemExit("Não encontrou bloco JSON no export MCP.")
data = json.loads(match.group(1))
rows = data[0]["json_agg"]
out = Path(__file__).resolve().parent / "fipe_veiculos_pending.json"
out.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")
print(f"Exportados {len(rows)} veículos -> {out}")
