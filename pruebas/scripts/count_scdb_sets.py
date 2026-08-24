"""Count cases per SCDB HTML dump (used to map which 3x3 sets we already have)."""
import glob
import re

for f in sorted(glob.glob("*.html")):
    src = open(f, encoding="utf-8", errors="ignore").read()
    blocks = re.findall(r'<div class="row singlealgorithm[^"]*"[^>]*>', src)
    title_m = re.search(r"<title>([^<]*)", src)
    title = title_m.group(1).strip() if title_m else ""
    print(f"{f:38s} | cases: {len(blocks):4d} | {title}")
