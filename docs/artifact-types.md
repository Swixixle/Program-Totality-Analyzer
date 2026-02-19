# Artifact Type Key

**Source of truth for all artifact domains and types that RR analyzes.**

RR performs static, evidence-bound analysis of software artifacts. Every finding is anchored to `file:line:hash` references. Epistemic labels reflect evidence quality, not runtime guarantees:
- In `operate.json`: EVIDENCED/INFERRED/UNKNOWN
- In `claims.json`: VERIFIED/INFERRED/UNKNOWN (where VERIFIED means hash-verified source snippet)

## Supported Artifact Types

| Domain | Artifact Type | File Patterns | Example | Status | Epistemic Notes |
|--------|---------------|---------------|---------|--------|-----------------|
| App | Source Code | `*.ts`, `*.js`, `*.py`, `*.go`, `*.java`, `*.rb`, `*.rs`, `*.c`, `*.cpp`, `*.cs`, `*.php` | `server/index.ts`, `main.py` | SUPPORTED | Structural parsing only; no runtime behavior analysis |
| App | Config | `*.yml`, `*.yaml`, `*.json`, `*.env.example`, `*.config.*`, `*.toml`, `*.ini` | `package.json`, `.env.example`, `tsconfig.json` | SUPPORTED | Detects configuration structure; does not validate runtime correctness |
| Infra | Terraform | `*.tf`, `*.tfvars`, `*.tf.json` | `main.tf`, `variables.tfvars` | SUPPORTED | Resource declarations extracted; no state/plan analysis |
| Infra | Kubernetes | `k8s/**/*.yaml`, `*-deployment.yaml`, `*-service.yaml`, `*-ingress.yaml`, `*.k8s.yaml` | `deployment.yaml`, `k8s/service.yaml` | SUPPORTED | Manifest structure parsing; heuristic folder/filename conventions |
| Data | dbt Models | `models/**/*.sql`, `dbt_project.yml`, `*.sql` (in models/) | `models/staging/users.sql` | EXPERIMENTAL | Folder-based conventions; best-effort SQL parsing |
| Data | SQL Scripts | `migrations/**/*.sql`, `schema/**/*.sql`, `*.sql` | `migrations/001_create_users.sql` | EXPERIMENTAL | Basic SQL structure detection; no query execution |
| ML | Pipelines | `ml/**/*.py`, `training/**/*.py`, `pipelines/**/*.py` | `ml/train.py`, `pipelines/preprocessing.py` | EXPERIMENTAL | Heuristic folder patterns; framework-agnostic |
| ML | Model Configs | `ml/**/*.yaml`, `ml/**/*.json`, `*.model.json`, `model.config.*` | `ml/model_config.yaml`, `bert.model.json` | EXPERIMENTAL | Config structure parsing; no model validation |
| ML | Prompts | `prompts/**/*.{json,yaml,md,txt}`, `*.prompt.*` | `prompts/system.md`, `chat.prompt.json` | EXPERIMENTAL | Template/text extraction; no LLM behavior analysis |
| Policy | OPA/Rego | `*.rego`, `policy/**/*.rego` | `policy/authz.rego`, `rules.rego` | EXPERIMENTAL | Package/rule declaration detection; no policy evaluation |
| Policy | Sentinel | `*.sentinel`, `policies/**/*.sentinel` | `policies/cost_limit.sentinel` | PLANNED | Not yet implemented |

## Status Definitions

- **SUPPORTED**: Production-ready. Reliably extracts structure from these artifacts.
- **EXPERIMENTAL**: Functional but uses heuristic patterns (folder names, filename conventions). May produce false positives/negatives.
- **PLANNED**: Roadmap item. Not yet implemented.

## Limitations

- **Static analysis only**: RR reads source files and configs. It cannot observe runtime behavior, network traffic, database queries, or live application state.
- **Heuristic folder conventions**: For domains like Data, ML, and Policy, RR relies on common folder patterns (`models/`, `ml/`, `prompts/`, `policy/`). If your project uses non-standard layouts, some artifacts may not be detected.
- **Best-effort parsing**: RR extracts structure (functions, classes, resource blocks, SQL table names) but does not validate syntax correctness or semantic meaning.
- **No security guarantees**: RR is not a security scanner, vulnerability detector, or compliance certification tool. It reports structural observations with file:line evidence, not security assessments.
- **Framework-agnostic**: RR does not assume specific frameworks (e.g., TensorFlow vs PyTorch, Airflow vs Prefect). It detects files that match common ML/data patterns but cannot infer framework-specific behavior.
- **No runtime verification**: Labels like "VERIFIED" or "EVIDENCED" mean "anchored to a hash-verified source snippet," not "proven correct at runtime."

## Evidence Model

All findings reference:
- **File path**: Relative to project root
- **Line range**: 1-indexed
- **Snippet hash**: First 12 hex chars of SHA-256 of stripped line(s)
- **Epistemic label**: 
  - In `operate.json`: EVIDENCED (hash-verified), INFERRED (pattern-based), or UNKNOWN (missing evidence)
  - In `claims.json`: VERIFIED (hash-verified), INFERRED (pattern-based), or UNKNOWN (missing evidence)

Example evidence object:
```json
{
  "path": "server/index.ts",
  "line_start": 92,
  "line_end": 92,
  "snippet_hash": "75d345a78f84",
  "display": "server/index.ts:92"
}
```

**Note**: For single-line findings, `line_start` and `line_end` are identical. For multi-line evidence (e.g., a function spanning lines 10-15), `line_start` and `line_end` have different values.

## Adding New Artifact Types

To extend RR's artifact coverage:

1. Add file patterns to the analyzer's scan rules
2. Implement structural extractors (no LLM required for deterministic extraction)
3. Update this table with Status = EXPERIMENTAL
4. Test against real-world projects with the new artifact type
5. Promote to SUPPORTED after validation

See `docs/ARCHITECTURE.md` for analyzer component details.
