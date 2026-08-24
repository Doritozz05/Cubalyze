#!/usr/bin/env python3
"""Medicion de dedupe real del dataset BirdF2L:
1) algs unicos por texto normalizado
2) estados unicos (posid sin variantes AUF) -> cuantos algs hay por estado
3) estimacion de unicos tras normalizar rotaciones iniciales"""
import re, os
from collections import Counter, defaultdict

DIR = 'pruebas/raw/birdf2l'
files = sorted(f for f in os.listdir(DIR) if f.endswith('.html') and f != 'index.html')

FIELDS = ['num', 'show', 'speed', 'stm', 'htm', 'qtm', 'algid', 'ollid', 'posid', 'patid', 'alg', 'notes']

def norm(alg):
    s = alg.replace('\u2032', "'").replace('\u2019', "'").strip()
    s = re.sub(r"\b([RUFLDBMESrufldbmesxyz])([23])'", r"\1\2", s)  # U2' -> U2
    toks = s.split()
    # quitar rotaciones iniciales (y/x/z y sus variantes) y finales
    while toks and toks[0] in ('y', "y'", 'y2', 'x', "x'", 'x2', 'z', "z'", 'z2', 'd', "d'", 'd2'):
        toks.pop(0)
    while toks and toks[-1] in ('y', "y'", 'y2', 'x', "x'", 'x2', 'z', "z'", 'z2', 'd', "d'", 'd2'):
        toks.pop()
    return ' '.join(toks)

def posid_state(posid):
    # posid "AaDcNdPj/Jb" -> primera parte; quitar letras del layer U (a,b,c,d,A,B,C,D) para ignorar AUF
    base = posid.split('/')[0] if '/' in posid else posid
    return re.sub(r'[a-dA-D]', '', base)

raw = 0
norm_uniq = set()
state_counter = Counter()
per_case = {}
state_per_case = {}

for f in files:
    src = open(os.path.join(DIR, f), encoding='utf-8', errors='ignore').read()
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', src, re.S)
    code = f[:-5]
    case_n = set()
    case_s = set()
    for r in rows:
        cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.S)
        clean = [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', c)).strip() for c in cells]
        if len(clean) >= 12:
            raw += 1
            alg = clean[10]
            pos = clean[8]
            n = norm(alg)
            norm_uniq.add((code, n))
            case_n.add(n)
            st = posid_state(pos)
            state_counter[(code, st)] += 1
            case_s.add(st)
    per_case[code] = len(case_n)
    state_per_case[code] = len(case_s)

print('=== DEDUPE REAL ===')
print(f'Filas crudas: {raw}')
print(f'Unicos por texto normalizado (sin rotaciones iniciales): {len(norm_uniq)}')
print(f'Estados unicos (posid sin AUF): {len(state_counter)}')
print(f'Ratio rows/estados: {raw / max(1, len(state_counter)):.1f} algs por estado')

algs_per_state = sorted(state_counter.values(), reverse=True)
print(f'\nAlgs por estado: top 5 = {algs_per_state[:5]}, mediana = {algs_per_state[len(algs_per_state)//2]}')
print(f'Estados con >50 algs: {sum(1 for v in state_counter.values() if v > 50)}')
print(f'Estados con >10 algs: {sum(1 for v in state_counter.values() if v > 10)}')
print(f'Estados con <=5 algs: {sum(1 for v in state_counter.values() if v <= 5)}')

by_case = sorted(per_case.items(), key=lambda x: -x[1])
print(f'\n=== Unicos por caso: top 5 ===')
for c, n in by_case[:5]:
    print(f'  {c}: {n} unicos (estados: {state_per_case[c]})')
print(f'=== Unicos por caso: bottom 5 ===')
for c, n in by_case[-5:]:
    print(f'  {c}: {n} unicos')

# algs por caso que ya tenemos (16/caso para los 41 basicos)
print(f'\nCaso medio: {sum(per_case.values())//len(per_case)} unicos por caso')
