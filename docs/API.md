# API Reference

Base URL: `https://<your-app-domain>/api`

All endpoints return JSON. Error responses include a `message` field.

## Project Analysis

### `GET /api/projects`

List all projects.

**Response:**
```json
[
  {
    "id": 1,
    "url": "https://github.com/user/repo",
    "name": "repo",
    "mode": "github",
    "status": "completed",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
]
```

### `POST /api/projects`

Create a new project.

**Request body:**
```json
{
  "url": "https://github.com/user/repo",
  "name": "repo",
  "mode": "github"
}
```

`mode` must be one of: `github`, `local`, `replit`.

### `GET /api/projects/:id`

Get a single project by ID.

### `GET /api/projects/:id/analysis`

Get analysis results for a project.

### `POST /api/projects/:id/analyze`

Trigger analysis for a project. Spawns the Python analyzer as a child process.

---

## Live Static CI Feed

### `POST /api/webhooks/github`

GitHub webhook receiver. Validates HMAC-SHA256 signature from the `X-Hub-Signature-256` header against the `GITHUB_WEBHOOK_SECRET` env var.

**Replay Protection:** The endpoint deduplicates webhook deliveries using the `X-GitHub-Delivery` header. Repeated deliveries with the same delivery ID will not create duplicate CI runs.

**Accepted events:** `push`, `pull_request`

**Headers required:**
- `X-Hub-Signature-256`: HMAC-SHA256 signature of the request body (required for authentication)
- `X-GitHub-Event`: Event type (`push` or `pull_request`) (required)
- `X-GitHub-Delivery`: Unique delivery ID from GitHub (required for replay protection)
- `Content-Type`: `application/json`

**Response (success):**
```json
{
  "ok": true,
  "run_id": "9c0ed034-9242-4b46-ae22-1f3baa72f4c8"
}
```

**Response (replayed delivery — same X-GitHub-Delivery ID):**
```json
{
  "ok": true,
  "deduped": true
}
```
Status code: `202 Accepted`

**Response (deduplicated — same owner/repo/SHA within 6 hours):**
```json
{
  "ok": true,
  "run_id": "9c0ed034-9242-4b46-ae22-1f3baa72f4c8",
  "deduplicated": true
}
```

**Response (signature invalid):**
```
401 Unauthorized
```

**Response (missing required headers):**
```
400 Bad Request - missing X-GitHub-Delivery or X-GitHub-Event
```

### `GET /api/ci/runs`

List CI runs for a repository.

**Query parameters:**
| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `owner` | Yes | — | Repository owner |
| `repo` | Yes | — | Repository name |
| `limit` | No | 50 | Max runs to return |

**Response:**
```json
{
  "ok": true,
  "runs": [
    {
      "id": "9c0ed034-9242-4b46-ae22-1f3baa72f4c8",
      "repoOwner": "octocat",
      "repoName": "hello-world",
      "ref": "main",
      "commitSha": "abc123def456789...",
      "eventType": "push",
      "status": "SUCCEEDED",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "startedAt": "2025-01-01T00:00:01.000Z",
      "finishedAt": "2025-01-01T00:01:30.000Z",
      "error": null,
      "outDir": "out/ci/9c0ed034-9242-4b46-ae22-1f3baa72f4c8",
      "summaryJson": {
        "boot_commands": 3,
        "endpoints": 5,
        "gaps": 2
      }
    }
  ]
}
```

### `GET /api/ci/runs/:id`

Get a single CI run by UUID.

**Response:** Same shape as a single item from the runs list above.

### `POST /api/ci/enqueue`

Manually enqueue a CI run (useful for testing without webhooks).

**Request body:**
```json
{
  "owner": "octocat",
  "repo": "hello-world",
  "ref": "main",
  "commit_sha": "abc123def456789abcdef1234567890abcdef123",
  "event_type": "manual"
}
```

**Response:**
```json
{
  "ok": true,
  "run_id": "9c0ed034-9242-4b46-ae22-1f3baa72f4c8"
}
```

If the same owner/repo/SHA was enqueued within the last 6 hours:
```json
{
  "ok": true,
  "run_id": "9c0ed034-9242-4b46-ae22-1f3baa72f4c8",
  "deduplicated": true
}
```

### `POST /api/ci/worker/tick`

Process one queued job. Fallback mechanism for environments where the background worker loop is not running.

**Response (job processed):**
```json
{
  "ok": true,
  "processed": true,
  "run_id": "9c0ed034-9242-4b46-ae22-1f3baa72f4c8"
}
```

**Response (no jobs):**
```json
{
  "ok": true,
  "processed": false
}
```

### `GET /api/ci/health`

Health check endpoint showing job queue status and disk space.

**Response:**
```json
{
  "ok": true,
  "jobs": {
    "READY": 2,
    "LEASED": 1,
    "DONE": 15,
    "DEAD": 0
  },
  "last_completed": {
    "id": "9c0ed034-9242-4b46-ae22-1f3baa72f4c8",
    "status": "SUCCEEDED",
    "finished_at": "2025-01-01T00:01:30.000Z",
    "repo": "octocat/hello-world"
  },
  "ciTmpDir": "/tmp/ci",
  "ciTmpDirFreeBytes": 10737418240,
  "ciTmpDirLowDisk": false
}
```

**Disk Status Fields:**
- `ciTmpDir`: Path to the CI temporary directory
- `ciTmpDirFreeBytes`: Free disk space in bytes (-1 if unavailable)
- `ciTmpDirLowDisk`: `true` if free space is below 1GB or below 5% of total disk space

---

## Webhook Requirements

GitHub webhook configuration:

| Setting | Value |
|---------|-------|
| Payload URL | `https://<your-app-domain>/api/webhooks/github` |
| Content type | `application/json` |
| Secret | Must match `GITHUB_WEBHOOK_SECRET` env var exactly |
| Events | Push, Pull requests |

Signature verification uses HMAC-SHA256 with timing-safe comparison. The server checks the `X-Hub-Signature-256` header against the computed signature of the raw request body.

**Replay Protection:**

The webhook endpoint implements replay protection using GitHub's `X-GitHub-Delivery` header. Each unique delivery ID is stored in the `webhook_deliveries` table. If GitHub redelivers a webhook (e.g., from the GitHub UI), the duplicate is detected and rejected with a `202 Accepted` response containing `{"ok": true, "deduped": true}`. This prevents duplicate CI runs from being created.

Additionally, the system deduplicates runs based on repository and commit SHA: if the same owner/repo/SHA is received within 6 hours, the existing run is returned instead of creating a new one.
