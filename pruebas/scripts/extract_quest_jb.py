"""Parser con balanceo de profundidad para el objeto 'rows' de quest (pagina Jb)."""
import re, json

src = open("pruebas/raw/quest/speedcube.quest_algorithms_f2l_jb.html", encoding="utf-8", errors="ignore").read()
scripts = [s for s in re.findall(r"<script[^>]*>(.*?)</script>", src, re.S) if "frVotes" in s]
blob = scripts[0]

def balanced(blob, i):
    """desde blob[i] (una llave/parche de apertura), devuelve el texto balanceado hasta su cierre"""
    open_ch = blob[i]
    close_ch = "}" if open_ch == "{" else "]"
    depth = 0
    in_str = False
    out = ""
    j = i
    while j < len(blob):
        ch = blob[j]
        if ch == '"' and blob[j - 1] != "\\":
            in_str = not in_str
        if not in_str:
            if ch == open_ch:
                depth += 1
            elif ch == close_ch:
                depth -= 1
                if depth == 0:
                    return out + ch
        out += ch
        j += 1
    return out

# --- objeto rows ---
ri = blob.find("rows: {")
rows_obj = balanced(blob, blob.find("{", ri))

# claves de nivel 1: buscar "key: [ o "key: {" a profundidad 1
def parse_groups(obj):
    groups = {}
    i = 0
    depth = 0
    in_str = False
    while i < len(obj):
        ch = obj[i]
        if ch == '"':
            in_str = not in_str
        if not in_str:
            if ch in "{[":
                depth += 1
                i += 1
                continue
            if ch in "}]":
                depth -= 1
                i += 1
                continue
            if depth == 1:
                m = re.match(r"([A-Za-z0-9_]+)\s*:\s*([\[{])", obj[i:])
                if m:
                    key = m.group(1)
                    val = balanced(obj, i + m.end(1) + m.end(2) - 1)
                    groups[key] = val
                    i += m.end(2)
                    i = obj.find(val, i) + len(val)
                    continue
        i += 1
    return groups

groups = parse_groups(rows_obj)
print(f"grupos top-level de rows: {list(groups.keys())}")
for k, v in groups.items():
    n = v.count("{") - v.count("{}")
    print(f"  {k}: {len(re.findall(chr(123) + chr(34) + 'alg' + chr(34), v))} filas (len {len(v)})")

# --- extraer cada fila de un grupo (array de objetos) ---
def parse_rows(arr_text):
    rows = []
    i = 0
    while i < len(arr_text):
        if arr_text[i] == "{":
            obj = balanced(arr_text, i)
            rows.append(obj)
            i += len(obj)
        else:
            i += 1
    return rows

main = groups.get("a", "")
if main:
    print(f"\n=== GRUPO 'a' (lista principal) ===")
    rows = parse_rows(main)
    print(f"filas: {len(rows)}")
    for n, r in enumerate(rows, 1):
        def bal(k):
            m = re.search(k + r":\s*(\[[^\]]*\]|\"((?:[^\"\\\\]|\\\\.)*)\"|-?[0-9]+)", r)
            return m.group(1) if m and m.group(1) else m.group(2) if m else "-"
        print(f"{n:2d}. {bal('alg'):<24} auf={bal('auf'):<4} frV={bal('frVotes'):<6} brV={bal('brVotes'):<6} uses={bal('uses'):<7} cub={bal('cubers'):<5} front={bal('frontUses'):<6} back={bal('backUses'):<6} score={bal('score'):<4}/{bal('scoreBack'):<4} disturbs={bal('disturbs'):<12} algid={bal('algid')}")

# metadata
print("\n=== metadata ===")
for kw in ["code", "ourCode", "name", "count", "slotIsolated", "grandTotal", "selectedSetup", "basic"]:
    m = re.search(kw + r":\s*(\"[^\"]*\"|-?[0-9]+|true|false)", blob)
    if m:
        print(f"  {kw} = {m.group(1)}")
m = re.search(r"patterns:\s*(\[[^\]]*\])", blob)
print(f"  patterns = {m.group(1) if m else '-'}")
m = re.search(r"total:\s*(\{[^}]*\})", blob)
print(f"  total = {m.group(1) if m else '-'}")
