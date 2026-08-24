import json

d = json.load(open('pruebas/generated/cuberoot-solves.json', encoding='utf-8'))
items = [x for x in (d if isinstance(d, list) else list(d.values())) if isinstance(x, dict)]
print('total cuberoot solves:', len(items))

target = "R2 F L' U B2 L2 D F' R' D' B2 D F L' D' F2 U2"

print('\n=== Solves de Liam Walton ===')
for x in items:
    if 'liam' in str(x.get('solver', '')).lower():
        print('id:', x.get('id'), '| solver:', x.get('solver'), '| time:', x.get('time'), '| date:', x.get('date'))
        print('  scramble:', x.get('scramble'))
        print('  steps:', json.dumps(x.get('steps', []), ensure_ascii=False)[:1500])
        print()

print('\n=== Búsqueda por scramble exacto ===')
for x in items:
    if x.get('scramble') == target:
        print('ENCONTRADO id:', x.get('id'), '| solver:', x.get('solver'), '| time:', x.get('time'))
        print(json.dumps(x, ensure_ascii=False)[:4000])
        break
else:
    print('no encontrado')

print('\n=== Muestra de estructura de un solve con steps ===')
for x in items:
    if x.get('steps'):
        print('keys:', list(x.keys()))
        print('steps[0]:', json.dumps(x['steps'][0], ensure_ascii=False)[:500])
        break
