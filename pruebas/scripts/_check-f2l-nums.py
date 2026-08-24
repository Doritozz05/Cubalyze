import re

s = open("packages/algorithm-db/src/seed/cfop-f2l.ts", encoding="utf-8").read()

# Split cases by caseNumber
cases = re.split(r"(?=      caseNumber: \")", s)
for chunk in cases:
    m = re.search(r'caseNumber: "([^"]+)"', chunk)
    if not m:
        continue
    num = m.group(1)
    if num in ("F2L 1", "F2L 37", "F2L 38", "F2L 39", "F2L 40", "F2L 41", "F2L 42"):
        algs = re.findall(r'moves: \[([^\]]+)\]', chunk)
        setups = re.findall(r'setupScramble: "([^"]+)"', chunk)
        print(f"=== {num} ===  setup={setups[0] if setups else '?'}")
        for a in algs[:4]:
            moves = re.findall(r'"([^"]+)"', a)
            print("   ", " ".join(moves))
        print()
