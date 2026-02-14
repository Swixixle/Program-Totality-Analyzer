# Snapshot Policy

## Purpose

This policy defines what constitutes a safe, reviewable snapshot of the Nikodemus/Lantern system for external review, architecture documentation, and change tracking.

---

## Safe to Include

| Category | Files/Folders | Notes |
|----------|---------------|-------|
| **Structure** | All `.ts`, `.tsx`, `.json`, `.md` in `client/`, `server/`, `shared/`, `script/` | Code structure and wiring |
| **Configuration** | `package.json`, `tsconfig.json`, `vite.config.ts`, `drizzle.config.ts` | Build/runtime config |
| **Documentation** | All `.md` files in root and `docs/` | Governance, architecture docs |
| **Schema** | `shared/schema.ts`, `client/src/lib/schema/*.ts` | Data structure definitions |
| **Dependencies** | `package.json`, `package-lock.json` | Dependency manifest (no secrets) |

---

## Must Exclude

| Category | Files/Folders | Reason |
|----------|---------------|--------|
| **Secrets** | `.env`, `.env.*`, any `*_KEY`, `*_SECRET`, `*_TOKEN` | Credential exposure |
| **Uploads** | `attached_assets/` | User content, potentially sensitive |
| **Local State** | `.local/`, `.upm/`, `.cache/` | Session tokens, local config |
| **Build Output** | `dist/`, `node_modules/` | Reproducible from source |
| **Git Internals** | `.git/` | History may contain sensitive commits |
| **Canon Content** | Any file containing formulas, thresholds, or protected parameters | IP protection |

### Enforced Denylist (Generator Blocks These)

The snapshot generator automatically excludes files matching these patterns:
- `EXTRACTION_ENGINE` — Core extraction logic
- `QUALITY_CONTRACT` — Quality thresholds
- `CANON` — Protected parameters
- `FORMULA` — Calculation logic
- `THRESHOLD` — Gating values
- `PROTECTED` / `PRIVATE` / `SECRET` — Explicitly sensitive

Files matching these patterns will not appear in the repo tree.

---

## Snapshot Contents

A valid snapshot includes:

1. **Repo tree** — File structure (paths only, no content)
2. **Framework identifiers** — Runtime, build tools, major dependencies
3. **Dependency manifest** — Production and dev dependencies (names only)
4. **API route list** — HTTP methods and paths
5. **Client page list** — React page components
6. **Heuristic entrypoints** — File names only, no logic
7. **Schema definitions** — File names and locations
8. **Governance documents** — References to policy files
9. **Git commit hash** — For version verification

---

## Regeneration Commands

### Generate Snapshot
```bash
npx tsx script/generate-snapshot.ts
```

### Output Location
```
docs/snapshots/CURRENT_SNAPSHOT.md
```

### Verify Current
```bash
git rev-parse --short HEAD
# Compare to hash in CURRENT_SNAPSHOT.md
```

---

## When to Regenerate

**Required after:**
- Any architectural change (new routes, pages, modules)
- Any governance change (policy files, heuristic gates)
- Any routing or case-binding change
- Any schema modification
- Any dependency addition/removal

**Not required for:**
- Cosmetic changes (styling, copy)
- Bug fixes that don't change structure
- Documentation-only updates (unless governance docs)

If uncertain, regenerate. The cost is low.

---

## Versioning

The snapshot file `CURRENT_SNAPSHOT.md` is overwritten on each regeneration. Previous snapshots are preserved via git history.

To view historical snapshots:
```bash
git log --oneline docs/snapshots/CURRENT_SNAPSHOT.md
git show <commit>:docs/snapshots/CURRENT_SNAPSHOT.md
```

---

## Audit Trail

The snapshot includes a verification section with:
- Commit hash at generation time
- Timestamp
- Command to verify currency

This allows any reviewer to confirm they have the correct snapshot version.

---

*This policy is itself safe to include in external review.*
