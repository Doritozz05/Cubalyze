"""Fase 4 (ligera): parsea el index de BirdF2L -> f2l-taxonomy.json.

Grupos (verificados antes contra quest):
  - Vj-only  (42): 'Cases involving Vj slot:'
  - Uf       (30): 'Cases involving Uf and Vj slots:'
  - Wn       (30): 'Cases involving Vj and Wn slots:'
  - Xr       (30): 'Cases involving Vj and Xr slots:'
  - 3slots   (36): 'Cases involving 3 slots:'
Uso: python pruebas/scripts/f2l_taxonomy.py
"""
import re, html, json

src = open("pruebas/raw/birdf2l/index.html", encoding="utf-8", errors="ignore").read()
text = re.sub(r"<script.*?</script>", "", src, flags=re.S)
text = re.sub(r"<[^>]+>", " ", text)
text = html.unescape(re.sub(r"\s+", " ", text))

SECTIONS = [
    ("Vj-only", "Cases involving Vj slot:", "Cases involving Uf and Vj"),
    ("Uf", "Cases involving Uf and Vj slots:", "Cases involving Vj and Wn"),
    ("Wn", "Cases involving Vj and Wn slots:", "Cases involving Vj and Xr"),
    ("Xr", "Cases involving Vj and Xr slots:", "Cases involving 3 slots"),
    ("3slots", "Cases involving 3 slots:", None),
]

tax = {}
for group, start, end in SECTIONS:
    i = text.find(start)
    j = text.find(end, i) if end else len(text)
    chunk = text[i + len(start):j]
    codes = sorted(set(re.findall(r"\b([A-Z][a-z])\b", chunk)))
    for c in codes:
        tax[c] = {"slotGroup": group}

out = "pruebas/raw/birdf2l/f2l-taxonomy.json"
json.dump({"groups": {g: 0 for g, _, _ in SECTIONS}, "cases": tax}, open(out, "w"), indent=1)
from collections import Counter
c = Counter(v["slotGroup"] for v in tax.values())
print(f"patrones: {len(tax)} | grupos: {dict(c)}")
print("ejemplos:", {k: v["slotGroup"] for k, v in list(tax.items())[:5]})
print(f"-> {out}")
