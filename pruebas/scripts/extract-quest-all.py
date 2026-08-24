#!/usr/bin/env python3
"""Extrae la metadata de los 167 HTML de quest a quest-all.json."""
import re, json, glob, os

OUT = {}
files = sorted(glob.glob('pruebas/raw/quest/all/*.html'))
for f in files:
    slug = os.path.basename(f)[:-5]
    src = open(f, encoding='utf-8', errors='ignore').read()
    def grab(pattern, group=1, default=None):
        m = re.search(pattern, src)
        return m.group(group) if m else default

    rec = {
        'slug': slug,
        'code': grab(r'code:"([^"]+)"'),
        'ourCode': grab(r'ourCode:"([^"]+)"'),
        'name': grab(r'name:"([^"]+)"'),
        'basic': grab(r'basic:(true|false)') == 'true',
        'count': int(grab(r'basic:(?:true|false),count:(\d+)', default=0) or 0),
        'slotIsolated': int(grab(r'slotIsolated:(\d+)', default=0) or 0),
        'patterns': json.loads(grab(r'patterns:(\[[^\]]*\])', default='[]') or '[]'),
        'setup': grab(r'selectedSetup:"([^"]+)"'),
        'grandTotal': int(grab(r'grandTotal:(\d+)', default=0) or 0),
    }
    # filas: alg + algid + auf + disturbs + reduces + uses
    rows = []
    for m in re.finditer(r'\{alg:"([^"]+)",algid:"([^"]*)",auf:"([^"]*)",disturbs:"([^"]*)",reduces:(\[[^\]]*\])', src):
        rows.append({
            'alg': m.group(1),
            'algid': m.group(2),
            'auf': m.group(3),
            'disturbs': m.group(4),
            # notación JS (claves sin comillas) — lo guardamos crudo
            'reducesRaw': m.group(5),
        })
    rec['rows'] = rows
    rec['nRows'] = len(rows)
    OUT[slug] = rec

json.dump(OUT, open('pruebas/raw/quest/quest-all.json', 'w'), ensure_ascii=False, indent=1)
print('extraidos:', len(OUT))
nobasic = sum(1 for r in OUT.values() if not r['basic'])
nobasicSetup = sum(1 for r in OUT.values() if not r['basic'] and r['setup'])
nobasicRows = sum(1 for r in OUT.values() if not r['basic'] and r['nRows'])
print(f'advanced: {nobasic}, con setup: {nobasicSetup}, con rows: {nobasicRows}')
# sin setup
nosetup = [s for s, r in OUT.items() if not r['setup']]
print('sin setup:', nosetup)
# tamaños de rows
import collections
cnt = collections.Counter(r['nRows'] for r in OUT.values() if not r['basic'])
print('rows por caso advanced (min/max):', min(cnt), max(cnt))
