#!/usr/bin/env bash
#
# Smoke test for PTA - validates analyzer output contracts
#
# This script:
# 1. Runs analyzer on a tiny fixture repo
# 2. Validates operate.json and target_howto.json against schemas
# 3. Ensures outputs contain required metadata fields
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> PTA Smoke Test"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

error() {
    echo -e "${RED}ERROR: $*${NC}" >&2
    exit 1
}

info() {
    echo -e "${GREEN}$*${NC}"
}

warn() {
    echo -e "${YELLOW}$*${NC}"
}

# Check prerequisites
command -v python3 >/dev/null 2>&1 || error "python3 not found"
command -v node >/dev/null 2>&1 || error "node not found"

# Create tiny fixture repo for testing
FIXTURE_DIR="$ROOT_DIR/server/analyzer/fixtures/tiny_repo"
if [ ! -d "$FIXTURE_DIR" ]; then
    info "Creating tiny fixture repo..."
    mkdir -p "$FIXTURE_DIR"
    
    # Create minimal project files
    cat > "$FIXTURE_DIR/package.json" << 'EOF'
{
  "name": "test-project",
  "version": "1.0.0",
  "scripts": {
    "dev": "node server.js",
    "start": "node server.js"
  }
}
EOF
    
    cat > "$FIXTURE_DIR/server.js" << 'EOF'
const http = require('http');
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World\n');
}).listen(PORT);

console.log(`Server running on port ${PORT}`);
EOF
    
    cat > "$FIXTURE_DIR/README.md" << 'EOF'
# Test Project

A minimal test project for smoke testing.

## Setup

```bash
npm install
npm run dev
```
EOF
    
    info "✓ Fixture repo created at $FIXTURE_DIR"
fi

# Run analyzer
OUTPUT_DIR="$ROOT_DIR/out/smoke-test-$(date +%s)"
mkdir -p "$OUTPUT_DIR"

info "Running analyzer on fixture repo..."
info "  Input: $FIXTURE_DIR"
info "  Output: $OUTPUT_DIR"

cd "$ROOT_DIR"

python3 -m server.analyzer.analyzer_cli analyze "$FIXTURE_DIR" \
    --output-dir "$OUTPUT_DIR" \
    --no-llm \
    2>&1 | tee "$OUTPUT_DIR/analyzer.log" || error "Analyzer failed"

# Check outputs exist
info "Checking outputs exist..."
[ -f "$OUTPUT_DIR/operate.json" ] || error "operate.json not found"
[ -f "$OUTPUT_DIR/target_howto.json" ] || error "target_howto.json not found"
info "✓ Both outputs exist"

# Validate against schemas using Python
info "Validating outputs against schemas..."

python3 -c "
import json
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path.cwd()))

from server.analyzer.src.schema_validator import (
    validate_operate_json,
    validate_target_howto_json
)

output_dir = Path('$OUTPUT_DIR')

# Validate operate.json
with open(output_dir / 'operate.json') as f:
    operate = json.load(f)

errors = validate_operate_json(operate)
if errors:
    print(f'❌ operate.json validation failed:')
    for err in errors:
        print(f'  - {err}')
    sys.exit(1)

print('✓ operate.json validates against schema')

# Validate target_howto.json
with open(output_dir / 'target_howto.json') as f:
    howto = json.load(f)

errors = validate_target_howto_json(howto)
if errors:
    print(f'❌ target_howto.json validation failed:')
    for err in errors:
        print(f'  - {err}')
    sys.exit(1)

print('✓ target_howto.json validates against schema')

# Check required metadata fields
required_fields = ['schema_version', 'tool_version', 'generated_at']

for field in required_fields:
    if field not in operate:
        print(f'❌ operate.json missing required field: {field}')
        sys.exit(1)
    if field not in howto:
        print(f'❌ target_howto.json missing required field: {field}')
        sys.exit(1)

print(f'✓ All required metadata fields present')

# Check howto has target field
if 'target' not in howto:
    print(f'❌ target_howto.json missing target field')
    sys.exit(1)

if 'mode' not in howto['target'] or 'identifier' not in howto['target']:
    print(f'❌ target_howto.json target must have mode and identifier')
    sys.exit(1)

print(f'✓ target_howto.json has proper target structure')

print()
print('✅ All validations passed!')
" || error "Schema validation failed"

info "✓ Schema validation passed"

echo
info "==> Smoke test PASSED ✅"
echo
echo "Output directory: $OUTPUT_DIR"
echo "Review outputs:"
echo "  - $OUTPUT_DIR/operate.json"
echo "  - $OUTPUT_DIR/target_howto.json"
echo

exit 0
