#!/usr/bin/env bash
#
# Smoke test for PTA - validates analyzer output contracts
#
# This script:
# 1. Runs analyzer on a tiny fixture repo
# 2. Validates operate.json and target_howto.json using Python validator
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> PTA Smoke Test"
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

error() {
    echo -e "${RED}ERROR: $*${NC}" >&2
    exit 1
}

info() {
    echo -e "${GREEN}$*${NC}"
}

# Check prerequisites
command -v python3 >/dev/null 2>&1 || error "python3 not found"

# Create tiny fixture repo if it doesn't exist
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

# Validate outputs using Python validator
info "Validating outputs against schemas..."
python3 -m server.analyzer.src.validate_outputs "$OUTPUT_DIR" || error "Validation failed"

echo
info "==> Smoke test PASSED ✅"
echo
echo "Output directory: $OUTPUT_DIR"
echo "Review outputs:"
echo "  - $OUTPUT_DIR/operate.json"
echo "  - $OUTPUT_DIR/target_howto.json"
echo

exit 0

