# Program Totality Analyzer

A static-artifact-anchored analysis tool that generates technical dossiers for software projects. It extracts what a system is, how to run it, what it needs, and what it cannot determine — with every claim citing `file:line` evidence backed by SHA-256 snippet hashes.

**Scope limitation:** PTA analyzes static artifacts only (source files, config, lockfiles). It does not observe runtime behavior, prove correctness, or guarantee security. Claims labeled VERIFIED mean "anchored to a hash-verified source snippet," not "proven true at runtime."

## What It Does

Given a software project (GitHub repo, local folder, or Replit workspace), the analyzer produces:

| File | Contents |
|------|----------|
| `operate.json` | Operator dashboard: boot commands, integration points, deployment config, readiness scores, gaps with severity. Deterministic, evidence-bound. Every item is EVIDENCED, INFERRED, or UNKNOWN. |
| `target_howto.json` | Legacy: evidence-scoped run steps. Prefer `operate.json` for operator workflows. |
| `claims.json` | Verifiable claims about the system, each with file:line evidence and confidence scores |
| `coverage.json` | Scan metadata: files scanned, files skipped, Replit detection evidence |
| `replit_profile.json` | Replit-specific: port binding, secrets, external APIs, observability (only in Replit mode) |
| `DOSSIER.md` | Human-readable markdown dossier summarizing all findings |
| `index.json` | Full file index of scanned files |
| `packs/` | Evidence packs (docs, config, code, ops) used during analysis |

## Live Static CI Feed

Event-driven static analysis triggered by GitHub push and pull request events. When a webhook fires, PTA creates a CI run, shallow-clones the repo at the exact commit SHA, runs the analyzer, and stores artifacts under `out/ci/<run_id>/`. A web UI at `/ci` shows run status and results.

### What it is

- Automated static analysis triggered by GitHub push/PR webhooks
- Creates `ci_runs` + `ci_jobs` records, processes them via a background worker, stores artifacts under `out/ci/<run_id>/`
- Provides a searchable UI feed at `/ci` with real-time polling
- Supports manual enqueue for testing without webhooks
- Deduplicates: same owner/repo/SHA within 6 hours reuses the existing run

### What it is NOT

- Not runtime monitoring, tracing, or telemetry
- Not a security scanner or SCA tool
- Not a CI/CD runner replacement (it does not build, test, or deploy your code)
- Not a compliance certification tool

### Quick Setup

1. **Set secrets**: `GITHUB_WEBHOOK_SECRET` (required), `GITHUB_TOKEN` (for private repos)
2. **Add GitHub webhook**: Point to `https://<your-app-domain>/api/webhooks/github` with content type `application/json`, secret matching your env var, events: Push + Pull requests
3. **Worker runs automatically**: The background worker starts on server boot and polls every 5 seconds
4. **View results**: Navigate to `/ci` in the web UI

See `replit.md` for detailed setup and troubleshooting, or `docs/API.md` for endpoint documentation.

### API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/webhooks/github` | GitHub webhook receiver (HMAC-SHA256 verified) |
| `GET` | `/api/ci/runs?owner=&repo=&limit=` | List CI runs for a repo |
| `GET` | `/api/ci/runs/:id` | Get single CI run details |
| `POST` | `/api/ci/enqueue` | Manual trigger for testing |
| `POST` | `/api/ci/worker/tick` | Process one queued job (fallback) |
| `GET` | `/api/ci/health` | Job counts by status + last completed run |

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `GITHUB_WEBHOOK_SECRET` | Yes (for webhooks) | HMAC-SHA256 signature verification |
| `GITHUB_TOKEN` | For private repos | Git clone authentication |
| `CI_TMP_DIR` | No (default: `/tmp/ci`) | Temporary directory for cloned repos |
| `ANALYZER_TIMEOUT_MS` | No (default: 600000) | Analyzer process timeout in ms |

### Data Model

- **`ci_runs`**: `id` (uuid), `repoOwner`, `repoName`, `ref`, `commitSha`, `eventType`, `status` (QUEUED/RUNNING/SUCCEEDED/FAILED), `createdAt`, `startedAt`, `finishedAt`, `error`, `outDir`, `summaryJson`
- **`ci_jobs`**: `id` (uuid), `runId` (fk), `status` (READY/LEASED/DONE/DEAD), `attempts`, `leasedUntil`, `lastError`

### Operational Notes

- **Deduplication**: Same (owner, repo, SHA) within 6 hours returns the existing run instead of creating a duplicate
- **Retry logic**: Jobs retry up to 3 attempts. After 3 failures, the job is marked DEAD and the run is marked FAILED
- **Job leasing**: Uses `FOR UPDATE SKIP LOCKED` with 5-minute lease timeout for concurrency safety
- **Signature verification**: Validates `X-Hub-Signature-256` header using HMAC-SHA256 with timing-safe comparison

## Install

```bash
pip install -e .
```

This registers the `pta` command. Alternatively, run as a module or directly:

```bash
python -m server.analyzer.src --help
python server/analyzer/analyzer_cli.py --help
```

## Replit Demo (1-click Portal)

For quick access to the analyzer UI, use the **Replit Portal** link:

### Local Development
```bash
npm run dev
```

Then navigate to: `http://localhost:5000/portal`

### Replit Deployment

Access the analyzer directly using the portal URL:

```
https://<your-replit-app-domain>/portal
```

The portal provides a stable entry point that redirects to the analyzer UI. You can:
- Analyze GitHub repositories by entering a URL
- Analyze the current Replit workspace with one click
- View previous analysis results
- Access the CI Feed for automated webhook-triggered analysis

**Note:** The portal route (`/portal`) automatically redirects to the main analyzer interface at `/`.

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

This mode requires no API keys and produces reproducible results. It generates `operate.json` and readiness scoring without any LLM involvement. It extracts:
- Package scripts (dev, build, start)
- Lockfile-based install commands
- Environment variable references (names only, never values)
- Port binding configuration
- External API usage
- Replit platform detection
- Operational gaps with severity ratings
- Readiness scores (boot, integrate, deploy)

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

### Gap Severity

Operational gaps in `operate.json` include a severity rating:
- **high** — blocks boot or core execution
- **medium** — impacts deployment maturity
- **low** — best-practice or observability improvements

### Verification

Snippet hashes are re-checked against source files: the analyzer re-reads the cited line range, strips whitespace, hashes the result, and confirms it matches the claimed hash. Claims that fail hash verification are capped at confidence 0.20 and marked `"status": "unverified"`.

**Important:** Hash verification confirms that a snippet exists at the cited location. It does not prove that the code behaves as described, is secure, or is free of bugs. PTA is not a security scanner, compliance certification tool, or correctness prover.

### Whitespace Policy

Lines are stripped (trimmed) before hashing. This normalizes indentation differences across editors and formatters. Both evidence creation and verification use the same canonicalization.

## Limitations

- **Static only**: PTA analyzes source files, config, and lockfiles. It cannot observe runtime behavior, network traffic, or live state.
- **No security guarantees**: PTA is not a security scanner, vulnerability detector, or SCA tool. It reports structural observations, not security assessments.
- **Evidence scope**: "EVIDENCED" means a snippet hash matched a source location. It does not mean the code works correctly, is secure, or meets any compliance standard.
- **LLM outputs are interpretive**: When using LLM mode, semantic analysis outputs carry confidence scores and are labeled as LLM-generated. They are not deterministic and should not be treated as ground truth.
- **CI Feed is static analysis**: The CI Feed triggers static analysis on push/PR events. It does not run tests, build artifacts, or deploy code.

## Security & Trust

- **Webhook signature verification**: All incoming GitHub webhooks are verified using HMAC-SHA256 with the `X-Hub-Signature-256` header and timing-safe comparison. Invalid signatures are rejected with 401.
- **No secrets in repo**: All sensitive values (`GITHUB_WEBHOOK_SECRET`, `GITHUB_TOKEN`, API keys) are set via environment variables / Replit Secrets. Never committed to source.
- **Symlink protection**: Every path component is checked. If any component in the path tree is a symlink, the file is rejected.
- **Path containment**: All resolved paths must remain within the project root (`relative_to()` check after `resolve()`).
- **Binary detection**: Null bytes in the first 4KB trigger rejection before text decoding.
- **Traversal prevention**: `..` segments and absolute paths are rejected.
- **Secret safety**: Only environment variable names are extracted, never their values.
- **Self-skip**: The analyzer excludes its own source files from analysis to prevent false-positive pattern matches.

## Output Files

### `operate.json`

Operator dashboard model with:
- `boot` -- install, dev, prod commands and port bindings, each with evidence tier
- `integrate` -- endpoints, env vars, auth mechanisms with evidence
- `deploy` -- Docker, platform hints, CI/CD, build commands with evidence
- `readiness` -- scores (0-100) for boot, integrate, deploy categories with reasons
- `gaps` -- operational gaps with severity (high/medium/low), rank, and action
- `runbooks` -- numbered step sequences for local_dev, production, and integration
- `snapshot` -- observability, migrations, and architectural metadata

All items carry a status of EVIDENCED, INFERRED, or UNKNOWN. EVIDENCED items include file:line references and SHA-256 snippet hashes. UNKNOWN items include an `unknown_reason`.

### `target_howto.json` (legacy)

Legacy operator manual. Prefer `operate.json` for operator workflows. Contains:
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

## Architecture

Two strictly separated layers:

1. **Structural layer** (deterministic) — file indexing, pattern matching, evidence extraction. Outputs are reproducible and hash-verified against source artifacts.
2. **Semantic layer** (LLM-powered, optional) — architecture interpretation, risk assessment, integration analysis. Outputs are labeled as LLM-generated and carry confidence scores, not deterministic guarantees.

The `--no-llm` flag gives you only the structural layer. The semantic layer adds interpretation but is namespaced separately and never contaminates structural evidence.

See `docs/ARCHITECTURE.md` for a detailed component diagram including the CI Feed pipeline.

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

### CI Feed: 401 on webhook delivery

The `GITHUB_WEBHOOK_SECRET` env var does not match the secret configured in GitHub, or the env var is not set. Verify both sides match exactly.

### CI Feed: Jobs stuck in DEAD

The worker attempted 3 times and failed each time. Common causes: invalid commit SHA, private repo without `GITHUB_TOKEN`, analyzer crash. Check the `error` field on the run and the `lastError` on the job.

### CI Feed: No runs showing

Verify you are searching with the correct owner/repo (case-sensitive). If using webhooks, check GitHub's webhook delivery log for successful 200 responses.

## Running Tests

```bash
bash scripts/smoke_test.sh
```

## Git Operations

### Rebase Resolution

If you encounter Git rebase issues, use the automated resolution script:

```bash
# Automatically resolve rebase (completes or safely aborts)
bash scripts/fix-rebase.sh

# Prefer to abort the rebase
bash scripts/fix-rebase.sh --abort
```

For detailed manual procedures, see:
- [`docs/REBASE_RESOLUTION_GUIDE.md`](docs/REBASE_RESOLUTION_GUIDE.md) — Complete manual and automated resolution procedures
- [`REBASE_VERIFICATION_REPORT.md`](REBASE_VERIFICATION_REPORT.md) — Repository state verification documentation

## License

MIT
