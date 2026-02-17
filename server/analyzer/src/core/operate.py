"""
Deterministic extraction engine for operate.json.

Produces a structured operator dashboard model with three evidence tiers:
- EVIDENCED: backed by file:line + snippet hash
- INFERRED: derived from evidence (e.g., lockfile implies package manager)
- UNKNOWN: not determinable from static artifacts

No LLM calls. No invented steps. Every claim has evidence or is marked UNKNOWN.
"""
import json
import re
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

from .evidence import make_evidence_from_line, make_file_exists_evidence, make_evidence
from ..version import TOOL_VERSION, OPERATE_SCHEMA_VERSION

REQUIRED_COVERAGE_KEYS = {"analyzed_files", "total_files_seen"}


def _find_line(filepath: Path, needle: str) -> Optional[int]:
    try:
        for i, line in enumerate(filepath.read_text(errors="ignore").splitlines(), 1):
            if needle in line:
                return i
    except Exception:
        pass
    return None


def _find_all_lines(filepath: Path, needle: str) -> List[int]:
    results = []
    try:
        for i, line in enumerate(filepath.read_text(errors="ignore").splitlines(), 1):
            if needle in line:
                results.append(i)
    except Exception:
        pass
    return results


def _read_lines(filepath: Path) -> List[str]:
    try:
        return filepath.read_text(errors="ignore").splitlines()
    except Exception:
        return []


def _make_item(status: str, value: str, evidence: List[dict],
               unknown_reason: str = "") -> dict:
    item = {"status": status, "value": value, "evidence": evidence}
    if status == "UNKNOWN":
        item["unknown_reason"] = unknown_reason or "Not determinable from static artifacts"
    return item


def _make_step(status: str, action: str, command: str = "",
               evidence: List[dict] = None, unknown_reason: str = "") -> dict:
    step = {
        "status": status,
        "action": action,
        "command": command,
        "evidence": evidence or [],
    }
    if status == "UNKNOWN":
        step["unknown_reason"] = unknown_reason or "Not determinable from static artifacts"
    return step


def _extract_install_commands(repo_dir: Path) -> List[dict]:
    items = []
    if (repo_dir / "package-lock.json").exists():
        items.append(_make_step(
            "INFERRED", "Install Node.js dependencies", "npm ci",
            [make_file_exists_evidence("package-lock.json")],
        ))
    elif (repo_dir / "pnpm-lock.yaml").exists():
        items.append(_make_step(
            "INFERRED", "Install Node.js dependencies", "pnpm install",
            [make_file_exists_evidence("pnpm-lock.yaml")],
        ))
    elif (repo_dir / "yarn.lock").exists():
        items.append(_make_step(
            "INFERRED", "Install Node.js dependencies", "yarn install",
            [make_file_exists_evidence("yarn.lock")],
        ))
    elif (repo_dir / "package.json").exists():
        items.append(_make_step(
            "INFERRED", "Install Node.js dependencies", "npm install",
            [make_file_exists_evidence("package.json")],
        ))

    if (repo_dir / "poetry.lock").exists():
        items.append(_make_step(
            "INFERRED", "Install Python dependencies", "poetry install",
            [make_file_exists_evidence("poetry.lock")],
        ))
    elif (repo_dir / "requirements.txt").exists():
        items.append(_make_step(
            "INFERRED", "Install Python dependencies",
            "pip install -r requirements.txt",
            [make_file_exists_evidence("requirements.txt")],
        ))
    elif (repo_dir / "pyproject.toml").exists():
        items.append(_make_step(
            "INFERRED", "Install Python dependencies", "pip install -e .",
            [make_file_exists_evidence("pyproject.toml")],
        ))

    if not items:
        items.append(_make_step(
            "UNKNOWN", "Install dependencies", "",
            unknown_reason="No lockfile or package manifest detected",
        ))
    return items


def _extract_run_commands(repo_dir: Path) -> dict:
    dev = []
    prod = []
    pkg_json = repo_dir / "package.json"
    if pkg_json.exists():
        try:
            lines = _read_lines(pkg_json)
            pkg = json.loads("\n".join(lines))
            scripts = pkg.get("scripts", {})
            for key, cmd_name in [("dev", "npm run dev"), ("start:dev", "npm run start:dev")]:
                if key in scripts:
                    ln = _find_line(pkg_json, f'"{key}"')
                    snippet = lines[ln - 1].strip() if ln and ln <= len(lines) else ""
                    ev = make_evidence_from_line("package.json", ln, snippet) if ln else None
                    dev.append(_make_step(
                        "EVIDENCED", f"Start dev server ({key})", cmd_name,
                        [ev] if ev else [],
                    ))
            for key, cmd_name in [("start", "npm start"), ("build", "npm run build")]:
                if key in scripts:
                    ln = _find_line(pkg_json, f'"{key}"')
                    snippet = lines[ln - 1].strip() if ln and ln <= len(lines) else ""
                    ev = make_evidence_from_line("package.json", ln, snippet) if ln else None
                    prod.append(_make_step(
                        "EVIDENCED", f"Run {key}", cmd_name,
                        [ev] if ev else [],
                    ))
        except (json.JSONDecodeError, Exception):
            pass

    makefile = repo_dir / "Makefile"
    if makefile.exists():
        lines = _read_lines(makefile)
        for i, line in enumerate(lines, 1):
            m = re.match(r'^([a-zA-Z_][a-zA-Z0-9_-]*):', line)
            if m and m.group(1) in ("dev", "run", "serve"):
                ev = make_evidence_from_line("Makefile", i, line.strip())
                dev.append(_make_step(
                    "EVIDENCED", f"Makefile target: {m.group(1)}",
                    f"make {m.group(1)}", [ev] if ev else [],
                ))
            elif m and m.group(1) in ("build", "deploy", "prod"):
                ev = make_evidence_from_line("Makefile", i, line.strip())
                prod.append(_make_step(
                    "EVIDENCED", f"Makefile target: {m.group(1)}",
                    f"make {m.group(1)}", [ev] if ev else [],
                ))

    replit_file = repo_dir / ".replit"
    if replit_file.exists():
        ln = _find_line(replit_file, "run =")
        if ln:
            lines = _read_lines(replit_file)
            snippet = lines[ln - 1].strip() if ln <= len(lines) else ""
            ev = make_evidence_from_line(".replit", ln, snippet)
            dev.append(_make_step(
                "EVIDENCED", "Replit run command", snippet.split("=", 1)[-1].strip().strip('"'),
                [ev] if ev else [],
            ))

    if not dev:
        dev.append(_make_step("UNKNOWN", "Start dev server", "",
                              unknown_reason="No dev script or run command detected"))
    if not prod:
        prod.append(_make_step("UNKNOWN", "Start production", "",
                               unknown_reason="No build/start script detected"))
    return {"dev": dev, "prod": prod}


def _extract_ports(repo_dir: Path, file_index: List[str]) -> List[dict]:
    ports = []
    seen = set()
    patterns = [
        (r'\.listen\(\s*(\d{4,5})', "listen() call"),
        (r'PORT\s*(?:\|\||\?\?)\s*(\d{4,5})', "PORT fallback"),
        (r'port\s*[:=]\s*(\d{4,5})', "port assignment"),
    ]
    for rel_path in file_index:
        if not any(rel_path.endswith(ext) for ext in (".ts", ".js", ".tsx", ".jsx", ".py", ".go")):
            continue
        full = repo_dir / rel_path
        if not full.exists():
            continue
        lines = _read_lines(full)
        for i, line in enumerate(lines, 1):
            for pat, desc in patterns:
                m = re.search(pat, line)
                if m:
                    port_val = m.group(1)
                    if port_val not in seen:
                        seen.add(port_val)
                        ev = make_evidence_from_line(rel_path, i, line.strip())
                        ports.append({
                            "status": "EVIDENCED",
                            "value": port_val,
                            "evidence": [ev] if ev else [],
                        })

    env_port_files = []
    for rel_path in file_index:
        if not any(rel_path.endswith(ext) for ext in (".ts", ".js", ".py")):
            continue
        full = repo_dir / rel_path
        if not full.exists():
            continue
        for i, line in enumerate(_read_lines(full), 1):
            if re.search(r'process\.env\.PORT|os\.environ.*PORT|PORT', line) and "PORT" not in seen:
                ev = make_evidence_from_line(rel_path, i, line.strip())
                if ev:
                    env_port_files.append(ev)

    if env_port_files and "PORT" not in seen:
        ports.append({
            "status": "INFERRED",
            "value": "PORT (env var)",
            "evidence": env_port_files[:3],
        })

    if not ports:
        ports.append({
            "status": "UNKNOWN",
            "value": "",
            "evidence": [],
            "unknown_reason": "No port binding detected in source files",
        })
    return ports


def _extract_endpoints(repo_dir: Path, file_index: List[str]) -> List[dict]:
    endpoints = []
    route_patterns = [
        (r'''(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"](/[^'"]+)['"]''', "Express route"),
        (r'''@(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"](/[^'"]+)['"]''', "Flask/FastAPI route"),
    ]
    for rel_path in file_index:
        if not any(rel_path.endswith(ext) for ext in (".ts", ".js", ".py", ".tsx", ".jsx")):
            continue
        full = repo_dir / rel_path
        if not full.exists():
            continue
        lines = _read_lines(full)
        for i, line in enumerate(lines, 1):
            for pat, desc in route_patterns:
                m = re.search(pat, line, re.IGNORECASE)
                if m:
                    method = m.group(1).upper()
                    path = m.group(2)
                    ev = make_evidence_from_line(rel_path, i, line.strip())
                    endpoints.append({
                        "method": method,
                        "path": path,
                        "status": "EVIDENCED",
                        "evidence": [ev] if ev else [],
                    })
    return endpoints[:50]


def _extract_env_vars(repo_dir: Path, file_index: List[str]) -> List[dict]:
    env_vars: Dict[str, List[dict]] = {}
    patterns = [
        (r'process\.env\.([A-Z][A-Z0-9_]+)', "process.env"),
        (r'os\.environ(?:\.get)?\s*\[\s*["\']([A-Z][A-Z0-9_]+)["\']', "os.environ"),
        (r'os\.getenv\s*\(\s*["\']([A-Z][A-Z0-9_]+)["\']', "os.getenv"),
        (r'import\.meta\.env\.([A-Z][A-Z0-9_]+)', "import.meta.env"),
    ]
    skip = {"NODE_ENV", "PATH", "HOME", "PWD", "SHELL", "USER", "HOSTNAME",
            "LANG", "TERM", "CI", "DEBUG", "VERBOSE", "LOG_LEVEL"}
    for rel_path in file_index:
        if not any(rel_path.endswith(ext) for ext in (".ts", ".js", ".py", ".tsx", ".jsx")):
            continue
        full = repo_dir / rel_path
        if not full.exists():
            continue
        lines = _read_lines(full)
        for i, line in enumerate(lines, 1):
            for pat, desc in patterns:
                for m in re.finditer(pat, line):
                    var_name = m.group(1)
                    if var_name in skip:
                        continue
                    ev = make_evidence_from_line(rel_path, i, line.strip())
                    if var_name not in env_vars:
                        env_vars[var_name] = []
                    if ev and len(env_vars[var_name]) < 3:
                        env_vars[var_name].append(ev)

    result = []
    for name, evs in sorted(env_vars.items()):
        result.append({
            "name": name,
            "status": "EVIDENCED",
            "evidence": evs,
        })
    return result


def _extract_auth(repo_dir: Path, file_index: List[str]) -> List[dict]:
    auth_items = []
    auth_patterns = [
        (r'(?:auth|authenticate|passport|jwt|bearer|session)', "auth pattern"),
    ]
    for rel_path in file_index:
        if not any(rel_path.endswith(ext) for ext in (".ts", ".js", ".py")):
            continue
        if "node_modules" in rel_path or "__pycache__" in rel_path:
            continue
        full = repo_dir / rel_path
        if not full.exists():
            continue
        lines = _read_lines(full)
        for i, line in enumerate(lines, 1):
            lower = line.lower()
            if any(kw in lower for kw in ["middleware", "auth", "passport", "jwt.verify", "bearer"]):
                if re.search(r'(?:auth|passport|jwt|bearer)', lower):
                    ev = make_evidence_from_line(rel_path, i, line.strip())
                    if ev and len(auth_items) < 5:
                        auth_items.append({
                            "status": "EVIDENCED",
                            "value": line.strip()[:80],
                            "evidence": [ev],
                        })

    if not auth_items:
        auth_items.append({
            "status": "UNKNOWN",
            "value": "",
            "evidence": [],
            "unknown_reason": "No explicit auth middleware or bearer token parsing detected",
        })
    return auth_items


def _extract_deploy(repo_dir: Path) -> dict:
    dockerfile = repo_dir / "Dockerfile"
    compose = repo_dir / "docker-compose.yml"
    compose_alt = repo_dir / "docker-compose.yaml"

    docker_info = {
        "status": "UNKNOWN",
        "dockerfile": False,
        "compose": False,
        "evidence": [],
        "unknown_reason": "No Dockerfile detected",
    }
    if dockerfile.exists():
        docker_info["status"] = "EVIDENCED"
        docker_info["dockerfile"] = True
        docker_info["evidence"].append(make_file_exists_evidence("Dockerfile"))
        docker_info.pop("unknown_reason", None)
    if compose.exists() or compose_alt.exists():
        fname = "docker-compose.yml" if compose.exists() else "docker-compose.yaml"
        docker_info["compose"] = True
        docker_info["evidence"].append(make_file_exists_evidence(fname))
        if docker_info["status"] == "UNKNOWN":
            docker_info["status"] = "EVIDENCED"
            docker_info.pop("unknown_reason", None)

    platform_hints = []
    checks = [
        (".replit", "replit"),
        ("Procfile", "heroku"),
        ("railway.json", "railway"),
        ("render.yaml", "render"),
        ("vercel.json", "vercel"),
        ("netlify.toml", "netlify"),
        ("fly.toml", "fly.io"),
    ]
    for fname, platform in checks:
        if (repo_dir / fname).exists():
            platform_hints.append({
                "status": "EVIDENCED",
                "value": platform,
                "evidence": [make_file_exists_evidence(fname)],
            })

    build_commands = []
    pkg_json = repo_dir / "package.json"
    if pkg_json.exists():
        try:
            pkg = json.loads(pkg_json.read_text(errors="ignore"))
            scripts = pkg.get("scripts", {})
            if "build" in scripts:
                ln = _find_line(pkg_json, '"build"')
                lines = _read_lines(pkg_json)
                snippet = lines[ln - 1].strip() if ln and ln <= len(lines) else ""
                ev = make_evidence_from_line("package.json", ln, snippet) if ln else None
                build_commands.append(_make_step(
                    "EVIDENCED", "Build", "npm run build",
                    [ev] if ev else [],
                ))
            if "start" in scripts:
                ln = _find_line(pkg_json, '"start"')
                lines = _read_lines(pkg_json)
                snippet = lines[ln - 1].strip() if ln and ln <= len(lines) else ""
                ev = make_evidence_from_line("package.json", ln, snippet) if ln else None
                build_commands.append(_make_step(
                    "EVIDENCED", "Start", "npm start",
                    [ev] if ev else [],
                ))
        except Exception:
            pass

    return {
        "docker": docker_info,
        "platform_hints": platform_hints,
        "build_commands": build_commands,
    }


def _extract_snapshot(repo_dir: Path, file_index: List[str],
                      replit_profile: Optional[dict] = None) -> dict:
    runtimes = []
    entrypoints = []
    datastores = []
    migrations = []
    observability = []

    if (repo_dir / "package.json").exists():
        try:
            pkg = json.loads((repo_dir / "package.json").read_text(errors="ignore"))
            engines = pkg.get("engines", {})
            node_ver = engines.get("node", "")
            val = f"Node.js {node_ver}" if node_ver else "Node.js"
            runtimes.append(_make_item("EVIDENCED", val,
                                       [make_file_exists_evidence("package.json")]))
        except Exception:
            runtimes.append(_make_item("EVIDENCED", "Node.js",
                                       [make_file_exists_evidence("package.json")]))

    if (repo_dir / "pyproject.toml").exists() or (repo_dir / "requirements.txt").exists():
        py_file = "pyproject.toml" if (repo_dir / "pyproject.toml").exists() else "requirements.txt"
        py_ver = ""
        if (repo_dir / "pyproject.toml").exists():
            for line in _read_lines(repo_dir / "pyproject.toml"):
                m = re.search(r'python_requires\s*=\s*["\']([^"\']+)', line)
                if m:
                    py_ver = m.group(1)
                    break
        val = f"Python {py_ver}" if py_ver else "Python"
        runtimes.append(_make_item("EVIDENCED", val,
                                   [make_file_exists_evidence(py_file)]))

    if not runtimes:
        runtimes.append(_make_item("UNKNOWN", "", [],
                                   "No runtime package manifest detected"))

    entry_candidates = [
        "server/index.ts", "server/index.js", "src/index.ts", "src/index.js",
        "index.ts", "index.js", "app.ts", "app.js", "main.py", "app.py",
        "server.ts", "server.js", "manage.py",
    ]
    for candidate in entry_candidates:
        if (repo_dir / candidate).exists():
            entrypoints.append(_make_item("EVIDENCED", candidate,
                                          [make_file_exists_evidence(candidate)]))

    if replit_profile and replit_profile.get("entrypoint"):
        ep = replit_profile["entrypoint"]
        if not any(e["value"] == ep for e in entrypoints):
            entrypoints.append(_make_item("EVIDENCED", ep,
                                          replit_profile.get("replit_detection_evidence", [])[:1]))

    if not entrypoints:
        entrypoints.append(_make_item("UNKNOWN", "", [],
                                      "No common entrypoint file detected"))

    ds_patterns = {
        "postgres": ["pg", "postgres", "postgresql", "drizzle-orm", "prisma", "sequelize", "knex", "psycopg2", "asyncpg", "sqlalchemy"],
        "sqlite": ["sqlite", "better-sqlite3", "sqlite3"],
        "mysql": ["mysql", "mysql2"],
        "mongodb": ["mongoose", "mongodb", "pymongo"],
        "redis": ["redis", "ioredis"],
    }
    pkg_json = repo_dir / "package.json"
    if pkg_json.exists():
        try:
            pkg_text = pkg_json.read_text(errors="ignore")
            for ds_name, keywords in ds_patterns.items():
                for kw in keywords:
                    if kw in pkg_text:
                        ln = _find_line(pkg_json, kw)
                        lines = _read_lines(pkg_json)
                        snippet = lines[ln - 1].strip() if ln and ln <= len(lines) else ""
                        ev = make_evidence_from_line("package.json", ln, snippet) if ln else None
                        if not any(d["value"] == ds_name for d in datastores):
                            datastores.append(_make_item(
                                "INFERRED", ds_name,
                                [ev] if ev else [make_file_exists_evidence("package.json")],
                            ))
                        break
        except Exception:
            pass

    if not datastores:
        datastores.append(_make_item("UNKNOWN", "", [],
                                     "No datastore dependency detected"))

    migration_tools = {
        "drizzle": ["drizzle-kit", "drizzle.config"],
        "prisma": ["prisma"],
        "alembic": ["alembic"],
        "knex": ["knex"],
        "typeorm": ["typeorm"],
        "sequelize-cli": ["sequelize-cli"],
    }
    for tool_name, keywords in migration_tools.items():
        for kw in keywords:
            for rel_path in file_index:
                if kw in rel_path:
                    migrations.append(_make_item(
                        "EVIDENCED", tool_name,
                        [make_file_exists_evidence(rel_path)],
                    ))
                    break
            if migrations:
                break
        if migrations:
            break

    if not migrations:
        if pkg_json.exists():
            try:
                pkg_text = pkg_json.read_text(errors="ignore")
                for tool_name, keywords in migration_tools.items():
                    for kw in keywords:
                        if kw in pkg_text:
                            migrations.append(_make_item(
                                "INFERRED", tool_name,
                                [make_file_exists_evidence("package.json")],
                            ))
                            break
                    if migrations:
                        break
            except Exception:
                pass

    if not migrations:
        migrations.append(_make_item("UNKNOWN", "", [],
                                     "No migration/schema tool detected"))

    health_patterns = [
        (r'''['"](/health|/healthz|/ready|/status)['"]''', "health endpoint"),
    ]
    for rel_path in file_index:
        if not any(rel_path.endswith(ext) for ext in (".ts", ".js", ".py")):
            continue
        full = repo_dir / rel_path
        if not full.exists():
            continue
        lines = _read_lines(full)
        for i, line in enumerate(lines, 1):
            for pat, desc in health_patterns:
                if re.search(pat, line):
                    ev = make_evidence_from_line(rel_path, i, line.strip())
                    if ev and len(observability) < 3:
                        observability.append(_make_item(
                            "EVIDENCED", desc,
                            [ev],
                        ))

    if not observability:
        observability.append(_make_item("UNKNOWN", "", [],
                                        "No health endpoint or observability setup detected"))

    return {
        "runtime": runtimes,
        "entrypoints": entrypoints,
        "datastore": datastores,
        "migrations": migrations,
        "observability": observability,
    }


def _compute_readiness(boot: dict, integrate: dict, deploy: dict,
                       snapshot: dict) -> dict:
    def _score_section(items_list: List[dict]) -> int:
        if not items_list:
            return 0
        evidenced = sum(1 for i in items_list if i.get("status") in ("EVIDENCED", "INFERRED"))
        return int((evidenced / len(items_list)) * 100) if items_list else 0

    def _reasons(items_list: List[dict], label: str) -> List[str]:
        reasons = []
        ev = [i for i in items_list if i.get("status") in ("EVIDENCED", "INFERRED")]
        unk = [i for i in items_list if i.get("status") == "UNKNOWN"]
        if ev:
            reasons.append(f"{len(ev)} {label} item(s) evidenced/inferred")
        if unk:
            reasons.append(f"{len(unk)} {label} item(s) unknown")
            first_unk = unk[0]
            blocker = first_unk.get("unknown_reason") or first_unk.get("action", "")
            if blocker:
                reasons.append(f"Blocker: {blocker}")
        return reasons

    all_boot = boot.get("install", []) + boot.get("dev", []) + boot.get("prod", [])
    all_integrate = integrate.get("endpoints", []) + integrate.get("env_vars", []) + integrate.get("auth", [])
    all_deploy = [deploy.get("docker", {})] + deploy.get("platform_hints", []) + deploy.get("build_commands", [])
    all_obs = snapshot.get("observability", [])

    return {
        "boot": {
            "score": _score_section(all_boot),
            "reasons": _reasons(all_boot, "boot"),
        },
        "integration": {
            "score": _score_section(all_integrate),
            "reasons": _reasons(all_integrate, "integration"),
        },
        "deployment": {
            "score": _score_section(all_deploy),
            "reasons": _reasons(all_deploy, "deployment"),
        },
        "observability": {
            "score": _score_section(all_obs),
            "reasons": _reasons(all_obs, "observability"),
        },
    }


def _compute_gaps(boot: dict, integrate: dict, deploy: dict,
                  snapshot: dict) -> List[dict]:
    gaps = []
    rank = 1

    severity_map = {
        "Install": "high",
        "Dev run": "high",
        "Prod run": "high",
        "Port binding": "medium",
        "Authentication": "medium",
        "Observability": "low",
        "Database migrations": "low",
    }

    def _check(items: List[dict], category: str):
        nonlocal rank
        for item in items:
            if item.get("status") == "UNKNOWN":
                reason = item.get("unknown_reason", item.get("action", ""))
                gaps.append({
                    "rank": rank,
                    "title": reason or f"{category}: unknown",
                    "severity": severity_map.get(category, "medium"),
                    "status": "UNKNOWN",
                    "evidence": [],
                    "action": f"Investigate and document {category}",
                })
                rank += 1

    _check(boot.get("install", []), "Install")
    _check(boot.get("dev", []), "Dev run")
    _check(boot.get("prod", []), "Prod run")
    _check(boot.get("ports", []), "Port binding")
    if deploy.get("docker", {}).get("status") == "UNKNOWN":
        gaps.append({
            "rank": rank,
            "title": "No Dockerfile detected",
            "severity": "medium",
            "status": "UNKNOWN",
            "evidence": [],
            "action": "Add Dockerfile or document deploy method",
        })
        rank += 1
    if not deploy.get("platform_hints"):
        gaps.append({
            "rank": rank,
            "title": "No deployment platform hints detected",
            "severity": "medium",
            "status": "UNKNOWN",
            "evidence": [],
            "action": "Add platform config (Procfile, vercel.json, etc.)",
        })
        rank += 1
    _check(integrate.get("auth", []), "Authentication")
    _check(snapshot.get("observability", []), "Observability")
    _check(snapshot.get("migrations", []), "Database migrations")

    return gaps[:10]


def _build_runbooks(boot: dict, integrate: dict, deploy: dict) -> dict:
    def _numbered(steps: List[dict]) -> List[dict]:
        return [{"step": i + 1, **s} for i, s in enumerate(steps)]

    local_dev = (
        boot.get("install", []) +
        boot.get("dev", [])
    )
    production = (
        boot.get("install", []) +
        deploy.get("build_commands", []) +
        boot.get("prod", [])
    )
    integration = []
    if integrate.get("base_path", {}).get("status") != "UNKNOWN":
        integration.append(_make_step(
            "EVIDENCED", f"API base: {integrate['base_path']['value']}",
            evidence=integrate["base_path"]["evidence"],
        ))
    for ep in integrate.get("endpoints", [])[:5]:
        integration.append(_make_step(
            ep["status"], f"{ep['method']} {ep['path']}",
            evidence=ep.get("evidence", []),
        ))
    if not integration:
        integration.append(_make_step(
            "UNKNOWN", "Integration steps", "",
            unknown_reason="No API endpoints detected",
        ))

    troubleshooting = []
    for port in boot.get("ports", []):
        if port.get("status") != "UNKNOWN":
            troubleshooting.append(_make_step(
                "INFERRED", f"Verify port {port['value']} is accessible",
                evidence=port.get("evidence", []),
            ))
    for ev_item in integrate.get("env_vars", [])[:5]:
        troubleshooting.append(_make_step(
            "EVIDENCED", f"Ensure {ev_item['name']} is set",
            evidence=ev_item.get("evidence", []),
        ))
    if not troubleshooting:
        troubleshooting.append(_make_step(
            "UNKNOWN", "Troubleshooting steps", "",
            unknown_reason="Insufficient data for troubleshooting guidance",
        ))

    return {
        "local_dev": _numbered(local_dev),
        "production": _numbered(production),
        "integration": _numbered(integration),
        "troubleshooting": _numbered(troubleshooting),
    }


def _extract_base_path(endpoints: List[dict]) -> dict:
    if not endpoints:
        return _make_item("UNKNOWN", "", [],
                          "No API endpoints detected")
    paths = [ep["path"] for ep in endpoints if ep.get("path")]
    if not paths:
        return _make_item("UNKNOWN", "", [],
                          "No API paths found")
    prefix_counts: Dict[str, int] = {}
    for p in paths:
        parts = p.strip("/").split("/")
        if parts:
            prefix = "/" + parts[0]
            prefix_counts[prefix] = prefix_counts.get(prefix, 0) + 1
    if prefix_counts:
        best = max(prefix_counts, key=prefix_counts.get)
        all_evs = []
        for ep in endpoints:
            if ep.get("path", "").startswith(best):
                all_evs.extend(ep.get("evidence", []))
        return _make_item("INFERRED", best, all_evs[:3])
    return _make_item("UNKNOWN", "", [],
                      "Could not determine API base path")


def build_operate(repo_dir: Path, file_index,
                  mode: str = "local",
                  replit_profile: Optional[dict] = None) -> dict:
    paths = []
    for entry in file_index:
        if isinstance(entry, dict):
            paths.append(entry.get("path", ""))
        else:
            paths.append(str(entry))
    paths = [p for p in paths if p]

    install = _extract_install_commands(repo_dir)
    run = _extract_run_commands(repo_dir)
    ports = _extract_ports(repo_dir, paths)
    endpoints = _extract_endpoints(repo_dir, paths)
    env_vars = _extract_env_vars(repo_dir, paths)
    auth = _extract_auth(repo_dir, paths)
    deploy = _extract_deploy(repo_dir)
    snapshot = _extract_snapshot(repo_dir, paths, replit_profile)

    boot = {
        "install": install,
        "dev": run["dev"],
        "prod": run["prod"],
        "ports": ports,
    }
    base_path = _extract_base_path(endpoints)
    integrate = {
        "base_path": base_path,
        "endpoints": endpoints,
        "auth": auth,
        "env_vars": env_vars,
    }

    readiness = _compute_readiness(boot, integrate, deploy, snapshot)
    gaps = _compute_gaps(boot, integrate, deploy, snapshot)
    runbooks = _build_runbooks(boot, integrate, deploy)

    return {
        "tool_version": f"pta-{TOOL_VERSION}",
        "schema_version": OPERATE_SCHEMA_VERSION,
        "mode": mode,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "boot": boot,
        "integrate": integrate,
        "deploy": deploy,
        "snapshot": snapshot,
        "readiness": readiness,
        "gaps": gaps,
        "runbooks": runbooks,
    }


def validate_operate(operate: dict) -> List[str]:
    errors = []
    required_top = ["tool_version", "mode", "boot",
                    "integrate", "deploy", "snapshot", "readiness", "gaps", "runbooks"]
    for field in required_top:
        if field not in operate:
            errors.append(f"Missing required field: {field}")

    for section_name in ["boot", "integrate", "deploy", "snapshot"]:
        section = operate.get(section_name, {})
        if not isinstance(section, dict):
            errors.append(f"{section_name} must be a dict")

    def _check_items(items: list, context: str):
        for i, item in enumerate(items):
            if not isinstance(item, dict):
                continue
            tier = item.get("tier", "")
            if tier == "EVIDENCED" and not item.get("evidence"):
                errors.append(f"{context}[{i}]: EVIDENCED but no evidence")
            if tier == "UNKNOWN" and not item.get("unknown_reason"):
                errors.append(f"{context}[{i}]: UNKNOWN but missing unknown_reason")

    boot = operate.get("boot", {})
    for key in ["install", "dev", "prod", "ports"]:
        _check_items(boot.get(key, []), f"boot.{key}")

    integrate = operate.get("integrate", {})
    _check_items(integrate.get("endpoints", []), "integrate.endpoints")
    _check_items(integrate.get("auth", []), "integrate.auth")
    _check_items(integrate.get("env_vars", []), "integrate.env_vars")

    deploy = operate.get("deploy", {})
    for key in ["platform", "ci", "containerization"]:
        _check_items(deploy.get(key, []), f"deploy.{key}")

    readiness = operate.get("readiness", {})
    for cat, data in readiness.items():
        if isinstance(data, dict):
            score = data.get("score", -1)
            if not (0 <= score <= 100):
                errors.append(f"readiness.{cat}: score {score} out of range 0-100")

    for gap in operate.get("gaps", []):
        if not isinstance(gap, dict):
            continue
        if not gap.get("title"):
            errors.append("Gap missing title")
        if not gap.get("severity"):
            errors.append("Gap missing severity")

    return errors
