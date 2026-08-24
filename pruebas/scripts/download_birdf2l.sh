#!/usr/bin/env bash
# Descarga el dataset completo de BirdF2L (gh-pages) a pruebas/raw/birdf2l/
# Uso: bash pruebas/scripts/download_birdf2l.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DIR="$ROOT/pruebas/raw/birdf2l"
mkdir -p "$DIR"
cd "$DIR"

BASE="https://raw.githubusercontent.com/andydude/birdf2l/gh-pages/app"

# 1) Codigos de caso desde el index (patid: Jb, Mi, Ca, ...)
codes=$(grep -o 'href="[A-Za-z][a-z]\.html"' index.html | sed 's/href="//; s/\.html"//' | sort -u)
echo "Codigos encontrados en index: $(echo "$codes" | wc -l)"

# 2) Descargar solo las que faltan (paralelo)
missing=""
for c in $codes; do
  [ -f "$c.html" ] || missing="$missing $c"
done
echo "Faltantes: $(echo $missing | wc -w)"
if [ -n "$missing" ]; then
  echo "$missing" | tr ' ' '\n' | xargs -P 8 -I{} curl -s --max-time 60 --retry 3 \
    -A "Mozilla/5.0 (data-collection; educational)" \
    "$BASE/{}.html" -o "{}.html"
fi

# 3) Documentacion para atribucion (LGPL-3.0)
[ -f LICENSE ]  || curl -s --max-time 30 "https://raw.githubusercontent.com/andydude/birdf2l/gh-pages/LICENSE"  -o LICENSE
[ -f README.md ]|| curl -s --max-time 30 "https://raw.githubusercontent.com/andydude/birdf2l/gh-pages/README.md" -o README.md

# 4) Verificacion rapida
n=0; total=0; bad=0
for f in *.html; do
  n=$((n+1))
  sz=$(wc -c < "$f")
  total=$((total+sz))
  if [ "$sz" -lt 1000 ]; then echo "  SOSPECHOSO: $f ($sz bytes)"; bad=$((bad+1)); fi
done
echo "----"
echo "Archivos .html: $n | Tamano total: $(awk "BEGIN{printf \"%.1f\", $total/1048576}") MB | Sospechosos: $bad"
