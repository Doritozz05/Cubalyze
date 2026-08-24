#!/usr/bin/env python3
"""Inventario del dataset BirdF2L descargado en pruebas/raw/birdf2l.
Genera un resumen completo + inventory.json para decisiones posteriores."""
import re, html, os, json
from collections import Counter

DIR = 'pruebas/raw/birdf2l'
files = sorted(f for f in os.listdir(DIR) if f.endswith('.html') and f != 'index.html')

fields = ['num', 'show', 'speed', 'stm', 'htm', 'qtm', 'algid', 'ollid', 'posid', 'patid', 'alg', 'notes']
all_rows = []
per_case = {}
notes = Counter()
algs_set = set()
bad_patid = []

for f in files:
    src = open(os.path.join(DIR, f), encoding='utf-8', errors='ignore').read()
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', src, re.S)
    data = [r for r in rows if 'algid' not in r and '<td' in r]
    case_rows = []
    for r in data:
        cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.S)
        clean = [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', c)).strip() for c in cells]
        if len(clean) >= 12:
            row = dict(zip(fields, clean[:12]))
            case_rows.append(row)
            all_rows.append(row)
            algs_set.add(row['alg'])
            if row['notes']:
                notes[row['notes']] += 1
    code = f[:-5]
    patid = case_rows[0]['patid'] if case_rows else None
    if patid and patid != code:
        bad_patid.append((code, patid))
    per_case[code] = len(case_rows)

print('=== INVENTARIO BIRDF2L ===')
print(f'Paginas: {len(files)}')
print(f'Filas totales (algs crudos): {len(all_rows)}')
print(f'Algs unicos por texto: {len(algs_set)}')
print(f'Casos con datos: {sum(1 for v in per_case.values() if v > 0)}')
print(f'Casos vacios: {sum(1 for v in per_case.values() if v == 0)}')
print(f'patid != filename: {bad_patid}')

by_size = sorted(per_case.items(), key=lambda x: -x[1])
print('\n=== TOP 10 por n de algs (mas comun) ===')
for c, n in by_size[:10]:
    print(f'  {c}: {n}')
print('=== BOTTOM 10 (mas raros) ===')
for c, n in by_size[-10:]:
    print(f'  {c}: {n}')

print(f'\n=== NOTES/TRIGGERS UNICOS: {len(notes)} ===')
for n, c in notes.most_common(40):
    print(f'  {c:6d}  {n!r}')

print(f'\nSpeed presente en {sum(1 for r in all_rows if r["speed"])} filas')
print(f'posid vacio en {sum(1 for r in all_rows if not r["posid"])} filas')
print(f'algid duplicados: {len(all_rows) - len(set(r["algid"] for r in all_rows))}')

# guardar inventario para el pipeline
inv = {
    'total_pages': len(files),
    'total_rows': len(all_rows),
    'unique_algs_text': len(algs_set),
    'per_case': per_case,
    'top_cases': [c for c, _ in by_size[:20]],
    'notes_sample': notes.most_common(60),
}
with open(os.path.join(DIR, 'inventory.json'), 'w', encoding='utf-8') as fh:
    json.dump(inv, fh, ensure_ascii=False, indent=1)
print(f'\n-> inventory.json guardado ({len(json.dumps(inv))//1024} KB)')
