#!/usr/bin/env bash
set -euo pipefail

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "=== Smoke Test: Program Totality Analyzer ==="

echo "[1/4] Testing CLI help..."
python server/analyzer/analyzer_cli.py --help > /dev/null
echo "  PASS: --help exits cleanly"

echo "[2/4] Running deterministic analysis (--no-llm)..."
python server/analyzer/analyzer_cli.py analyze --replit --no-llm -o "$TMP/out"
echo "  PASS: analysis completed"

echo "[3/4] Checking output files..."
for f in target_howto.json coverage.json claims.json index.json DOSSIER.md replit_profile.json; do
  if [ ! -f "$TMP/out/$f" ]; then
    echo "  FAIL: missing $f"
    exit 1
  fi
done
echo "  PASS: all expected files present"

echo "[4/4] Validating no invalid evidence (line_start < 1)..."
python3 - "$TMP/out" <<'PY'
import json, glob, sys
paths = glob.glob(sys.argv[1] + "/**/*.json", recursive=True)
bad = []
def walk(x, where=""):
    if isinstance(x, dict):
        if "line_start" in x and isinstance(x["line_start"], int) and x["line_start"] < 1:
            bad.append((where, x))
        for k, v in x.items():
            walk(v, where + f".{k}")
    elif isinstance(x, list):
        for i, v in enumerate(x):
            walk(v, where + f"[{i}]")
for p in paths:
    try:
        j = json.load(open(p))
    except Exception:
        continue
    walk(j, p)
if bad:
    print(f"  FAIL: {len(bad)} invalid evidence entries found")
    for w, e in bad[:5]:
        print(f"    {w}: {e}")
    sys.exit(1)
print("  PASS: zero invalid evidence entries")
PY

echo ""
echo "=== ALL SMOKE TESTS PASSED ==="
