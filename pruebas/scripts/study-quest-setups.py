# Estudio: setups de quest (13 paginas) vs nuestra taxonomia.
# Implementa CubeState minimo via facelets Kociemba para identificar pareja.
import re, glob, os, json

MATE_EDGE = [8,9,10,11,8,9,10,11]
MATE_CORNER = [-1,-1,-1,-1,7,4,5,6,4,5,6,7]

# Tablas Kociemba (igual que el verifier)
cornerFacelet = [[8,9,20],[6,18,38],[0,36,47],[2,45,11],[29,26,15],[27,44,24],[33,53,42],[35,17,51]]
edgeFacelet = [[5,10],[7,19],[3,37],[1,46],[32,16],[28,25],[30,43],[34,52],[23,12],[21,41],[50,39],[48,14]]
CCOL = [["U","R","F"],["U","F","L"],["U","L","B"],["U","B","R"],["D","F","R"],["D","L","F"],["D","B","L"],["D","R","B"]]
ECOL = [["U","R"],["U","F"],["U","L"],["U","B"],["D","R"],["D","F"],["D","L"],["D","B"],["F","R"],["F","L"],["B","L"],["B","R"]]

def norm(s):
    s = s.replace("'", "").replace("\u2032", "")
    # L2' -> L2 ; L' -> L1? No: aqui normalizamos quitando primas dobles.
    # Mejor: normalizar L2' => L2, y L' => L1 (movimiento simple).
    s = re.sub(r'([RLUDFBMES]w?|[rludbf])2', r'\1 2', s)
    s = re.sub(r'([RLUDFBMES]w?|[rludbf])', r'\1 1', s)
    toks = s.split()
    out = []
    for i in range(0, len(toks), 2):
        face, turns = toks[i], int(toks[i+1])
        out.append((face, turns % 4))
    return out

# ─── Aplicar movimientos a facelets (mapeo de ciclos) ─────────────────────
# Cada cara: ciclos de facelets. Simplificacion: usamos las permutaciones de
# la libreria real? No — implementamos rotacion de capa con aristas/esquinas.
# En su lugar usamos un enfoque mas simple: aplicar moves al estado de piezas
# via el algoritmo de rotacion. Para el estudio solo necesitamos cp/ep.

def apply_moves(moves, state):
    # state: dict con cp (lista 8), co, ep (lista 12), eo
    # Implementacion de rotaciones de capas para cubo 3x3 estandar.
    for face, turns in moves:
        if turns == 0: continue
        # Tablas de permutacion por capa (movimientos estandar)
        # Usamos el modelo conocido: cada giro permuta esquinas/aristas.
        pass

# ─── No: implementamos con libreria real via subprocess es inviable.
# Mejor: usamos el approach de facelets con rotaciones completas.
# Dado el tiempo, simplificamos el estudio usando UN motor Python propio.

# Rotaciones de capa en facelets 54 (indices Kociemba URFDLB = 0-53)
# cara U: 0-8, R: 9-17, F: 18-26, D: 27-35, L: 36-44, B: 45-53

def rot_face_cw(idx):
    return [idx[6],idx[3],idx[0],idx[7],idx[4],idx[1],idx[8],idx[5],idx[2]]

# Ciclos entre caras para cada giro (cara, [ (cara_src, indices), ... ])
# U: F(0,1,2)->L(0,1,2)->B(0,1,2)->R(0,1,2)->F   (pero con primas)
# Definimos U, D, R, L, F, B con sus ciclos estandar.

def permute(arr, cycles):
    out = arr[:]
    for a, b, c, d in cycles:
        va, vb, vc, vd = arr[a], arr[b], arr[c], arr[d]
        out[a], out[b], out[c], out[d] = vd, va, vb, vc
    return out

def face_cycle(face, direction):
    # returns list of (face_idx, positions) affected
    # Posiciones por cara (0-8):
    # 0 1 2
    # 3 4 5
    # 6 7 8
    pass

# ─── MOTOR COMPLETO (aristas+esquinas) ────────────────────────────────────
# Usamos el enfoque de "piezas" en vez de facelets: matrices cp/ep/co/eo.
# Permutaciones de capa:

def move_cube(cp, ep, co, eo, face, turns):
    # Tablas estandar (de cubing.js / min2phase)
    # Esquinas: cada giro permuta 4 esquinas + rota orientacion
    # Aristas: cada giro permuta 4 aristas + voltea orientacion
    T = {
      'U': ([0,1,2,3], [0,1,2,3], None),
      'D': ([4,5,6,7], [4,5,6,7], None),
      'R': ([0,3,7,4], [1,5,9,8], 'R'),
      'L': ([1,2,6,5], [2,6,10,9], 'L'),
      'F': ([0,1,5,4], [1,7,10,9], 'F'),
      'B': ([3,2,6,7], [3,6,11,10], 'B'),
    }
    # Corregir: las permutaciones de esquinas deben ser las reales.
    return cp, ep

print("placeholder")
