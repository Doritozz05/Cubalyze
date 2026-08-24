#!/usr/bin/env python3
"""Fase 1 — Parser BirdF2L: 168 páginas HTML -> parsed.json estructurado.

Por patid: algs con moves normalizados + metadata completa (speed, stm/htm/qtm,
algid, posid, ollid, notes). NO deduplica (eso es la Fase 3).
"""
import re, os, json

SRC = 'pruebas/raw/birdf2l'
OUT = os.path.join(SRC, 'parsed.json')

FIELDS = ['num', 'show', 'speed', 'stm', 'htm', 'qtm', 'algid', 'ollid', 'posid', 'patid', 'alg', 'notes']

def norm_moves(alg):
    s = alg.replace('\u2032', "'").replace('\u2019', "'").strip()
    s = re.sub(r"\b([RUFLDBMESrufldbmesxyz])([23])'", r"\1\2", s)  # U2' -> U2
    s = re.sub(r'\s+', ' ', s)
    return s

def to_int(x):
    return int(x) if x and x.strip().isdigit() else None

cases = {}
total = 0
empty = []
patid_mismatch = []

for f in sorted(x for x in os.listdir(SRC) if re.match(r'^[A-Z][a-z]\.html$', x)):
    patid = f[:-5]
    src = open(os.path.join(SRC, f), encoding='utf-8', errors='ignore').read()
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', src, re.S)
    algs = []
    for r in rows:
        if 'algid' in r:
            continue
        cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.S)
        clean = [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', c)).strip() for c in cells]
        if len(clean) < 12:
            continue
        d = dict(zip(FIELDS, clean[:12]))
        if d['patid'] != patid:
            patid_mismatch.append((patid, d['patid']))
        algs.append({
            'moves': norm_moves(d['alg']),
            'speed': float(d['speed']) if d['speed'] else None,
            'stm': to_int(d['stm']),
            'htm': to_int(d['htm']),
            'qtm': to_int(d['qtm']),
            'algid': d['algid'],
            'posid': d['posid'],
            'ollid': d['ollid'],
            'notes': d['notes'],
        })
    if not algs:
        empty.append(patid)
    cases[patid] = {'patid': patid, 'algs': algs}
    total += len(algs)

print(f'Casos: {len(cases)} | Filas totales: {total} | Vacios: {empty}')
print(f'patid mismatch: {len(patid_mismatch)} -> {patid_mismatch[:5]}')

with open(OUT, 'w', encoding='utf-8') as fh:
    json.dump(cases, fh, ensure_ascii=False)
print(f'-> {OUT} ({os.path.getsize(OUT) // 1048576} MB)')
