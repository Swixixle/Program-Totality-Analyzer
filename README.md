# Program Totality Analyzer

A static-artifact-anchored analysis tool that generates technical dossiers for software projects. It extracts what a system is, how to run it, what it needs, and what it cannot determine — with every claim citing `file:line` evidence backed by SHA-256 snippet hashes.

**Scope limitation:** PTA analyzes static artifacts only (source files, config, lockfiles). It does not observe runtime behavior, prove correctness, or guarantee security. Claims labeled VERIFIED mean "anchored to a hash-verified source snippet," not "proven true at runtime."

## What It Does

Given a software project (GitHub repo, local folder, or Replit workspace), the analyzer produces:

| File | Contents |
|------|----------|
| `target_howto.json` | Operator manual: prerequisites, install steps, config, dev/prod run commands, Replit execution profile |
| `claims.json` | Verifiable claims about the system, each with file:line evidence and confidence scores |
| `coverage.json` | Scan metadata: files scanned, files skipped, Replit detection evidence |
| `replit_profile.json` | Replit-specific: port binding, secrets, external APIs, observability (only in Replit mode) |
| `DOSSIER.md` | Human-readable markdown dossier summarizing all findings |
| `index.json` | Full file index of scanned files |
| `packs/` | Evidence packs (docs, config, code, ops) used during analysis |

## Install

```bash
pip install -e .
```

This registers the `pta` command. Alternatively, run as a module or directly:

```bash
python -m server.analyzer.src --help
python server/analyzer/analyzer_cli.py --help
```

### Dependencies

- Python 3.11+
- Required packages: `typer`, `rich`, `openai`, `gitpython`, `jsonschema`, `python-dotenv`, `pydantic`

## Usage

### Three Modes

**GitHub repository:**
```bash
pta analyze https://github.com/user/repo -o ./output
```

**Local folder:**
```bash
pta analyze ./path/to/project -o ./output
```

**Replit workspace (run from inside the workspace):**
```bash
pta analyze --replit -o ./output
```

### Deterministic Mode (`--no-llm`)

Skip all LLM calls and produce only deterministic, structurally-extracted outputs:

```bash
pta analyze --replit --no-llm -o ./output
```

This mode requires no API keys and produces reproducible results. It extracts:
- Package scripts (dev, build, start)
- Lockfile-based install commands
- Environment variable references (names only, never values)
- Port binding configuration
- External API usage
- Replit platform detection

### With LLM Analysis

For semantic analysis (architecture understanding, risk assessment, integration patterns):

```bash
pta analyze --replit -o ./output
```

Requires `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` environment variables.

### Scoping a Subdirectory

```bash
pta analyze https://github.com/user/monorepo --root packages/api -o ./output
```

## Evidence Model

Every claim in the output cites structured evidence:

```json
{
  "path": "server/index.ts",
  "line_start": 92,
  "line_end": 92,
  "snippet_hash": "75d345a78f84",
  "display": "server/index.ts:92"
}
```

- `path` -- file path relative to project root
- `line_start` / `line_end` -- 1-indexed line range (never 0)
- `snippet_hash` -- first 12 hex chars of SHA-256 of the stripped line(s)
- `display` -- human-readable location string

For file-existence evidence (e.g., lockfile detection):

```json
{
  "kind": "file_exists",
  "path": "package-lock.json",
  "snippet_hash": "053150b640a7",
  "display": "package-lock.json (file exists)"
}
```

### Verification

Snippet hashes are re-checked against source files: the analyzer re-reads the cited line range, strips whitespace, hashes the result, and confirms it matches the claimed hash. Claims that fail hash verification are capped at confidence 0.20 and marked `"status": "unverified"`.

**Important:** Hash verification confirms that a snippet exists at the cited location. It does not prove that the code behaves as described, is secure, or is free of bugs. PTA is not a security scanner, compliance certification tool, or correctness prover.

### Whitespace Policy

Lines are stripped (trimmed) before hashing. This normalizes indentation differences across editors and formatters. Both evidence creation and verification use the same canonicalization.

## Security

- **Symlink protection**: Every path component is checked. If any component in the path tree is a symlink, the file is rejected.
- **Path containment**: All resolved paths must remain within the project root (`relative_to()` check after `resolve()`).
- **Binary detection**: Null bytes in the first 4KB trigger rejection before text decoding.
- **Traversal prevention**: `..` segments and absolute paths are rejected.
- **Secret safety**: Only environment variable names are extracted, never their values.
- **Self-skip**: The analyzer excludes its own source files from analysis to prevent false-positive pattern matches.

## Output Files

### `target_howto.json`

Operator manual with:
- `prereqs` -- required runtimes
- `install_steps` -- with commands and evidence
- `config` -- environment variables with file:line references
- `run_dev` / `run_prod` -- start commands with evidence
- `replit_execution_profile` -- port binding, secrets, external APIs (Replit mode)
- `unknowns` -- things the analyzer could not determine
- `completeness` -- scoring with missing items

### `claims.json`

Array of verifiable claims:
- `statement` -- what is claimed
- `confidence` -- 0.0 to 1.0
- `evidence` -- array of evidence objects with `snippet_hash_verified: true/false`
- `status` -- `"evidenced"` or `"unverified"`

### `coverage.json`

- `mode_requested` / `mode` -- analysis mode
- `scanned` / `skipped` -- file counts
- `replit_detected` -- boolean
- `replit_detection_evidence` -- evidence for Replit detection
- `self_skip` -- analyzer self-exclusion details

## Troubleshooting

### "No module named 'core'"

Run from the repo root, or install with `pip install -e .`

### Missing `DATABASE_URL`

The analyzer itself does not need a database. `DATABASE_URL` appears in outputs because it detects the target project's database configuration. No action needed for the analyzer.

### Missing OpenAI environment variables

Only required when running without `--no-llm`. Set:
```bash
export AI_INTEGRATIONS_OPENAI_API_KEY=your-key
export AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
```

### "Port already in use"

The analyzer does not bind any ports. If you see port errors, they come from the target project's web server, not the analyzer.

## Architecture

Two strictly separated layers:

1. **Structural layer** (deterministic) — file indexing, pattern matching, evidence extraction. Outputs are reproducible and hash-verified against source artifacts.
2. **Semantic layer** (LLM-powered, optional) — architecture interpretation, risk assessment, integration analysis. Outputs are labeled as LLM-generated and carry confidence scores, not deterministic guarantees.

The `--no-llm` flag gives you only the structural layer. The semantic layer adds interpretation but is namespaced separately and never contaminates structural evidence.

## Running Tests

```bash
bash scripts/smoke_test.sh
```

## License

MIT
