# Overview

**Program Totality Analyzer** — a full-stack web application that ingests software projects (via GitHub URL, local path, or live Replit workspace) and produces evidence-cited technical dossiers. The dossier covers what a target system is, how it works, how to use it, and what risks/unknowns exist. It combines a React frontend for submitting analysis requests and viewing results with an Express backend that manages projects/analyses in PostgreSQL and spawns a Python-based analyzer CLI for the actual code analysis.

## Replit Demo (1-click Portal)

### Quick Start

**Portal URL (Stable Entry Point):**
- Local development: `http://localhost:5000/portal`
- Replit deployment: `https://<your-replit-app-domain>/portal`

The `/portal` route provides a stable, bookmarkable link that redirects to the analyzer UI. Use this for:
- Direct access to the analyzer interface
- Sharing with team members or stakeholders
- Demo presentations
- Documentation links

### Running Locally

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser to `http://localhost:5000/portal`

3. You can now:
   - **Analyze GitHub repos**: Enter a GitHub repository URL
   - **Analyze this workspace**: Click "Analyze This Workspace" button
   - **View CI Feed**: Navigate to `/ci` for webhook-triggered runs
   - **Browse previous analyses**: Navigate to `/projects`

### UI Features

The analyzer home page includes:
- GitHub URL input for analyzing any public repository
- "Analyze This Workspace" button for instant Replit workspace analysis
- "Open Portal (Direct Link)" button showing the stable portal URL
- Real-time polling for analysis status updates

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Monorepo Structure

The project follows a three-zone monorepo pattern:

- **`client/`** — React SPA (frontend)
- **`server/`** — Express API (backend)
- **`shared/`** — Shared types, schemas, and route definitions used by both client and server

This avoids type drift between frontend and backend by sharing Zod schemas and TypeScript types from a single source of truth.

### Frontend (`client/src/`)

- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side router)
- **State/Data Fetching**: TanStack React Query with polling for analysis status updates
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (dark mode, cyan/neon aesthetic)
- **Animations**: Framer Motion for page transitions and loading states
- **Markdown Rendering**: react-markdown for displaying analysis dossiers
- **Build Tool**: Vite with React plugin

Key pages:
- `/` — Home page with URL input form and "Analyze Replit" button
- `/projects` — List of previous analyses
- `/projects/:id` — Detailed view of a specific analysis with tabs for dossier, claims, operator dashboard (operate.json), coverage, and unknowns
- `/ci` — Live Static CI Feed: searchable run list, manual enqueue, webhook setup info

Path aliases: `@/` maps to `client/src/`, `@shared/` maps to `shared/`, `@assets/` maps to `attached_assets/`.

### Backend (`server/`)

- **Framework**: Express 5 on Node.js
- **Language**: TypeScript, run via `tsx` in dev
- **API Pattern**: REST API under `/api/` prefix, route definitions shared via `shared/routes.ts`
- **Dev Server**: Vite middleware in development (HMR via `server/vite.ts`), static file serving in production (`server/static.ts`)
- **Build**: esbuild bundles server to `dist/index.cjs`; Vite builds client to `dist/public/`

Key API routes (defined in `server/routes.ts`):
- `GET /api/projects` — List all projects
- `POST /api/projects` — Create a new project (with mode: github/local/replit)
- `GET /api/projects/:id` — Get project details
- `GET /api/projects/:id/analysis` — Get analysis results
- `POST /api/projects/:id/analyze` — Trigger analysis (spawns Python CLI)

CI Feed API routes:
- `POST /api/webhooks/github` — GitHub webhook receiver (HMAC-SHA256 verified)
- `GET /api/ci/runs?owner=X&repo=Y&limit=N` — List CI runs for a repo
- `GET /api/ci/runs/:id` — Get single CI run details
- `POST /api/ci/enqueue` — Manual trigger {owner, repo, ref, commit_sha, event_type}
- `POST /api/ci/worker/tick` — Process one queued job (fallback worker)
- `GET /api/ci/health` — Job counts by status + last completed run

### Python Analyzer (`server/analyzer/`)

- **CLI**: `analyzer_cli.py` using Typer, supports three input modes:
  - GitHub URL (`analyze <url>`)
  - Local path (`analyze <path>`)
  - Replit workspace (`analyze --replit`)
- **Core**: `server/analyzer/src/analyzer.py` — orchestrates file acquisition, indexing, and LLM-powered analysis
- **Operate Module**: `server/analyzer/src/core/operate.py` — deterministic (no LLM) extraction of operational data into `operate.json`
  - Extracts boot commands, ports, integration points (endpoints, env vars, auth), deployment config, and runbook steps
  - Uses three evidence tiers: EVIDENCED (file:line + SHA-256 snippet hash), INFERRED, UNKNOWN (with unknown_reason)
  - Computes readiness scores (0-100) for boot, integrate, deploy categories
  - Identifies operational gaps with severity ratings
- **LLM Integration**: OpenAI API (via Replit AI Integrations env vars: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`)
- The Express server spawns the Python analyzer as a child process

### Database

- **Engine**: PostgreSQL (required, referenced via `DATABASE_URL` env var)
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-Zod validation
- **Schema** (`shared/schema.ts`):
  - `projects` — id, url, name, mode (github/local/replit), status (pending/analyzing/completed/failed), createdAt
  - `analyses` — id, projectId, dossier (markdown text), claims (jsonb), howto (jsonb), coverage (jsonb), unknowns (jsonb), operate (jsonb), createdAt
  - `ci_runs` — id (uuid), repoOwner, repoName, ref, commitSha, eventType, status (QUEUED/RUNNING/SUCCEEDED/FAILED), timestamps, error, outDir, summaryJson
  - `ci_jobs` — id (uuid), runId (fk→ci_runs), status (READY/LEASED/DONE/DEAD), attempts, leasedUntil, lastError
- **Chat models** (`shared/models/chat.ts`):
  - `conversations` — id, title, createdAt
  - `messages` — id, conversationId, role, content, createdAt
- **Migrations**: Drizzle Kit with `drizzle-kit push` for schema sync
- **Storage Layer**: `server/storage.ts` implements `IStorage` interface with `DatabaseStorage` class

### Replit Integrations (`server/replit_integrations/` and `client/replit_integrations/`)

Pre-built integration modules for AI features:
- **Chat** — Text-based conversation routes and storage using OpenAI
- **Audio** — Voice recording, playback, speech-to-text, text-to-speech with AudioWorklet
- **Image** — Image generation and editing via `gpt-image-1`
- **Batch** — Rate-limited batch processing with retries for LLM calls

These are utility modules that can be registered on the Express app as needed.

### Key Design Decisions

1. **Shared route definitions** — `shared/routes.ts` defines API contracts (paths, input schemas, response schemas) used by both frontend hooks and backend handlers. This ensures type safety across the stack.

2. **Python + Node hybrid** — The analyzer logic lives in Python (better ecosystem for code analysis, rich CLI output) while the web layer is Node/Express. The server spawns Python as a child process rather than using a microservice architecture, keeping deployment simple.

3. **Evidence-first analysis** — The analyzer is designed to cite file paths and line ranges for every claim. When evidence is missing, it must label findings as inference/unknown rather than hallucinate.

4. **Polling for status** — The frontend polls project status every 2 seconds while analysis is in progress, switching to static once completed/failed.

5. **Live Static CI Feed** — GitHub webhooks trigger automated static analysis runs. Static analysis only (no runtime telemetry). See `docs/ARCHITECTURE.md` for detailed component diagrams and `docs/API.md` for endpoint documentation.

## Live Static CI Feed — Operator Runbook

### What it is

Event-driven static analysis triggered by GitHub push/PR events. Creates `ci_runs` + `ci_jobs`, processes in background worker, stores artifacts under `out/ci/<run_id>/`. Provides a UI feed at `/ci`.

### What it is NOT

- Not runtime monitoring, tracing, or telemetry
- Not a security scanner or SCA tool
- Not a CI/CD runner replacement

### Secrets (Environment Variables)

Set these in the Replit Secrets tab (lock icon in sidebar):

| Variable | Required | Purpose |
|----------|----------|---------|
| `GITHUB_WEBHOOK_SECRET` | Yes (for webhooks) | HMAC-SHA256 signature verification |
| `GITHUB_TOKEN` | For private repos | Git clone authentication |
| `CI_TMP_DIR` | No (default: `/tmp/ci`) | Temp directory for cloned repos |
| `ANALYZER_TIMEOUT_MS` | No (default: 600000) | Analyzer process timeout in ms |

To generate a strong webhook secret:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### GitHub Webhook Setup

In the GitHub repo: **Settings > Webhooks > Add webhook**

| Setting | Value |
|---------|-------|
| Payload URL | `https://<your-app-domain>/api/webhooks/github` |
| Content type | `application/json` |
| Secret | Must match `GITHUB_WEBHOOK_SECRET` exactly |
| Events | Select "Let me select individual events", check **Pushes** and **Pull requests** |
| Active | Checked |

### Worker Operation

The background worker starts automatically on server boot and polls every 5 seconds (`server/ci-worker.ts`). No additional setup is needed.

Fallback: If the background loop is not running, you can manually process jobs:

```bash
curl -X POST https://<your-app-domain>/api/ci/worker/tick
```

### Verification Steps

1. Enqueue a test run:
   ```bash
   curl -X POST https://<your-app-domain>/api/ci/enqueue \
     -H "Content-Type: application/json" \
     -d '{"owner":"<owner>","repo":"<repo>","ref":"main","commit_sha":"<real-sha>","event_type":"manual"}'
   ```
2. Check health:
   ```bash
   curl https://<your-app-domain>/api/ci/health
   ```
3. View the `/ci` page in the browser — you should see the run transition from QUEUED to RUNNING to SUCCEEDED/FAILED
4. Check output artifacts in `out/ci/<run_id>/`

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| 401 on webhook delivery | `GITHUB_WEBHOOK_SECRET` mismatch or not set | Verify the secret matches in both Replit Secrets and GitHub webhook config |
| Jobs stuck in DEAD | Clone failure, bad SHA, or analyzer crash | Check the `error` field on the run and `lastError` on the job. Common: private repo without `GITHUB_TOKEN` |
| Feed shows no runs | Wrong owner/repo query, or no runs triggered | Verify owner/repo are correct (case-sensitive). Check GitHub webhook delivery log for 200 responses |
| Run stays QUEUED | Worker not running | Check server logs for `[CI Worker] Starting background loop`. Restart the server if needed |
| Analyzer timeout | Large repo or slow LLM calls | Increase `ANALYZER_TIMEOUT_MS` or use `--no-llm` mode |

### API Endpoints

See `docs/API.md` for full documentation with request/response examples.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/webhooks/github` | GitHub webhook receiver (HMAC-SHA256 verified) |
| `GET` | `/api/ci/runs?owner=&repo=&limit=` | List CI runs for a repo |
| `GET` | `/api/ci/runs/:id` | Get single CI run details |
| `POST` | `/api/ci/enqueue` | Manual trigger for testing |
| `POST` | `/api/ci/worker/tick` | Process one queued job (fallback) |
| `GET` | `/api/ci/health` | Job counts by status + last completed run |

### Operational Notes

- **Deduplication**: Same (owner, repo, SHA) within 6 hours returns existing run
- **Retry logic**: Max 3 attempts per job, then DEAD. Run marked FAILED.
- **Job leasing**: `FOR UPDATE SKIP LOCKED` with 5-minute lease for concurrency safety
- **Signature verification**: HMAC-SHA256 with `X-Hub-Signature-256` header, timing-safe comparison

## External Dependencies

### Required Services
- **PostgreSQL** — Primary database, must be provisioned with `DATABASE_URL` environment variable
- **OpenAI API** (via Replit AI Integrations) — Powers the code analysis LLM calls
  - `AI_INTEGRATIONS_OPENAI_API_KEY` — API key
  - `AI_INTEGRATIONS_OPENAI_BASE_URL` — Base URL for API

### Key NPM Packages
- `express` v5 — HTTP server
- `drizzle-orm` + `drizzle-kit` — Database ORM and migrations
- `@tanstack/react-query` — Client-side data fetching and caching
- `wouter` — Client-side routing
- `react-markdown` — Markdown rendering for dossiers
- `framer-motion` — Animations
- `zod` + `drizzle-zod` — Runtime validation
- `vite` — Frontend build and dev server
- `esbuild` — Server build

### Key Python Packages
- `typer` — CLI framework
- `openai` — LLM API client
- `rich` — Console output formatting
- `python-dotenv` — Environment variable loading

### Dev/Build Tools
- `tsx` — TypeScript execution for development
- `tailwindcss` + `postcss` + `autoprefixer` — CSS toolchain
- `@replit/vite-plugin-runtime-error-modal` — Dev error overlay

## Repository Stability Checklist

### Single-Repo Stability Ritual

Run these commands to verify the repository is in a stable, clean state:

```bash
git status
git rev-parse --abbrev-ref HEAD
git fetch origin
git log --oneline -5
git rev-list --count origin/main..HEAD
git rev-list --count HEAD..origin/main
```

**Pass Conditions:**
- `git status` shows **no rebase in progress** and **working tree clean**
- `origin/main..HEAD` count is `0` (nothing unpushed)
- `HEAD..origin/main` count is `0` (not behind)

**If ahead of origin:**
```bash
git push origin main
```

**If behind origin (merge-based, not rebase):**
```bash
git pull --no-rebase origin main
```

**If stuck in rebase:**
```bash
# Continue resolving conflicts
git rebase --continue

# OR abort the rebase
git rebase --abort

# OR use the automated fix script
bash scripts/fix-rebase.sh
```

### Multi-Repo Stability Checklist

For projects with multiple related repositories, use this checklist for each repo:

1. **Check status**: `git status` (must be clean; not mid-rebase)
2. **Fetch latest**: `git fetch origin`
3. **Check sync status**:
   - Ahead: `git rev-list --count origin/main..HEAD` (should be 0)
   - Behind: `git rev-list --count HEAD..origin/main` (should be 0)
4. **Push if ahead**: `git push origin main`
5. **Verify branch**: Confirm default branch is correct (`main` or `master`)
6. **Tag releases** (optional): `git tag v0.1.0-stable && git push origin v0.1.0-stable`

### Repository Stability Helper Script

For managing multiple repositories, create a helper script:

**`scripts/repo-stability-check.sh`** (non-destructive):

```bash
#!/usr/bin/env bash
set -euo pipefail

REPOS=(Asset-Analyzer HALO-RECEIPTS Lantern ELI) # adjust names

for r in "${REPOS[@]}"; do
  if [ -d "$r/.git" ]; then
    echo "=== $r ==="
    (cd "$r" && \
      git status -sb && \
      git fetch origin && \
      echo "ahead: $(git rev-list --count origin/main..HEAD 2>/dev/null || echo n/a)" && \
      echo "behind: $(git rev-list --count HEAD..origin/main 2>/dev/null || echo n/a)" \
    )
    echo
  else
    echo "SKIP $r (not found)"
  fi
done
```

**Usage:**
```bash
chmod +x scripts/repo-stability-check.sh
./scripts/repo-stability-check.sh
```

**Note:** If any repo shows `ahead > 0`, run `git push origin main` inside that repo.