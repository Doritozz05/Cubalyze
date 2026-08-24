import json, glob, os

# Localizar datasets de cuberoot
candidates = glob.glob('pruebas/generated/*.json') + glob.glob('pruebas/**/*.json', recursive=True)
print('JSONs candidatos:')
for c in sorted(set(candidates)):
    print('  ', c, os.path.getsize(c))

target_scramble = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2"

for path in sorted(set(candidates)):
    try:
        d = json.load(open(path, encoding='utf-8'))
    except Exception as e:
        continue
    items = d if isinstance(d, list) else list(d.values())
    items = [x for x in items if isinstance(x, dict)]
    if not items:
        continue
    for x in items:
        sc = x.get('scramble', '') or ''
        if sc == target_scramble:
            print('\n=== ENCONTRADO en', path, '===')
            print('id:', x.get('id'), '| solver:', x.get('solver'), '| time:', x.get('time'))
            print('keys:', list(x.keys()))
            print('scramble:', sc)
            steps = x.get('steps') or x.get('moves') or x.get('phases') or []
            print('steps:', json.dumps(steps, ensure_ascii=False)[:3000])
            raise SystemExit
print('\nNo encontrado por scramble; probando por url/id 2510...')
for path in sorted(set(candidates)):
    try:
        d = json.load(open(path, encoding='utf-8'))
    except Exception:
        continue
    items = d if isinstance(d, list) else list(d.values())
    items = [x for x in items if isinstance(x, dict)]
    if not items:
        continue
    for x in items:
        if str(x.get('id')) == '2510' or '2510' in str(x.get('url', '')):
            print('candidato en', path, '-> id:', x.get('id'), 'solver:', x.get('solver'), 'time:', x.get('time'), 'scramble:', x.get('scramble'))
