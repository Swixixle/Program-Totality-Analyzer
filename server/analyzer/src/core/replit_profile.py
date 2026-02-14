import os
import re
from pathlib import Path
from typing import Dict, Any, List, Optional

from core.evidence import make_evidence_from_line, make_evidence


class ReplitProfiler:
    """Detects Replit-specific configuration and runtime details from a workspace.
    
    All findings include file:line evidence citations.
    Only outputs env var names (never values).
    """

    SKIP_DIRS = {".git", "node_modules", "__pycache__", ".pythonlibs",
                 ".cache", ".local", ".config", "out", ".upm", ".replit_agent"}
    SKIP_PATHS = set()
    CODE_EXTENSIONS = {".ts", ".js", ".py", ".go", ".rs", ".java", ".rb", ".tsx", ".jsx"}
    COMMON_NON_SECRETS = {
        "NODE_ENV", "PATH", "HOME", "PORT", "PWD", "SHELL", "USER",
        "HOSTNAME", "LANG", "TERM", "DISPLAY", "XDG_RUNTIME_DIR",
        "REPLIT_DB_URL", "REPL_ID", "REPL_SLUG", "REPL_OWNER",
        "CI", "DEBUG", "VERBOSE", "LOG_LEVEL",
    }

    def __init__(self, root_dir: Path, self_root: Optional[str] = None):
        self.root = root_dir

        if self_root is not None:
            self.self_skip_paths = {self_root}
        else:
            candidate = self.root / "server" / "analyzer" / "analyzer_cli.py"
            if candidate.exists():
                self.self_skip_paths = {"server/analyzer"}
            else:
                self.self_skip_paths = set()

    @property
    def skipped_self_paths(self):
        return self.self_skip_paths

    def detect(self) -> Dict[str, Any]:
        profile: Dict[str, Any] = {
            "is_replit": False,
            "run_command": None,
            "language": None,
            "entrypoint": None,
            "nix_packages": [],
            "port_binding": None,
            "required_secrets": [],
            "external_apis": [],
            "deployment_assumptions": [],
            "observability": {"logging": False, "health_endpoint": False, "evidence": []},
            "replit_file_parsed": None,
            "replit_nix_parsed": None,
        }

        replit_file = self.root / ".replit"
        replit_nix = self.root / "replit.nix"

        if replit_file.exists():
            profile["is_replit"] = True
            parsed = self._parse_replit_file(replit_file)
            profile["replit_file_parsed"] = parsed
            profile["run_command"] = parsed.get("run")
            profile["entrypoint"] = parsed.get("entrypoint")
            profile["language"] = parsed.get("language")

        if replit_nix.exists():
            profile["is_replit"] = True
            parsed_nix = self._parse_replit_nix(replit_nix)
            profile["replit_nix_parsed"] = parsed_nix
            profile["nix_packages"] = parsed_nix.get("packages", [])

        if not profile["language"]:
            profile["language"] = self._detect_language()

        profile["port_binding"] = self._detect_port_binding()
        profile["required_secrets"] = self._detect_secrets()
        profile["external_apis"] = self._detect_external_apis()
        profile["observability"] = self._detect_observability()
        profile["deployment_assumptions"] = self._infer_deployment_assumptions(profile)

        return profile

    def _parse_replit_file(self, filepath: Path) -> Dict[str, Any]:
        lines = filepath.read_text(errors="ignore").splitlines()
        result: Dict[str, Any] = {"evidence": []}

        for i, line in enumerate(lines, start=1):
            stripped = line.strip()
            run_match = re.match(r'^run\s*=\s*"(.+?)"', stripped)
            if run_match:
                result["run"] = run_match.group(1)
                result["evidence"].append(make_evidence_from_line(".replit", i, stripped))

            entry_match = re.match(r'^entrypoint\s*=\s*"(.+?)"', stripped)
            if entry_match:
                result["entrypoint"] = entry_match.group(1)
                result["evidence"].append(make_evidence_from_line(".replit", i, stripped))

            lang_match = re.match(r'^language\s*=\s*"(.+?)"', stripped)
            if lang_match:
                result["language"] = lang_match.group(1)
                result["evidence"].append(make_evidence_from_line(".replit", i, stripped))

            if re.match(r'\[nix\]', stripped):
                result["has_nix_section"] = True
                result["evidence"].append(make_evidence_from_line(".replit", i, stripped))

        return result

    def _parse_replit_nix(self, filepath: Path) -> Dict[str, Any]:
        content = filepath.read_text(errors="ignore")
        lines = content.splitlines()
        result: Dict[str, Any] = {"packages": [], "evidence": []}

        for i, line in enumerate(lines, start=1):
            for m in re.finditer(r'pkgs\.([a-zA-Z0-9_-]+)', line):
                pkg = m.group(1)
                if pkg not in result["packages"]:
                    result["packages"].append(pkg)
                result["evidence"].append(make_evidence_from_line("replit.nix", i, line.strip()))

        return result

    def _detect_language(self) -> Optional[str]:
        markers = {
            "package.json": "nodejs",
            "pyproject.toml": "python",
            "requirements.txt": "python",
            "Cargo.toml": "rust",
            "go.mod": "go",
            "Gemfile": "ruby",
            "pom.xml": "java",
            "build.gradle": "java",
        }
        for marker, lang in markers.items():
            if (self.root / marker).exists():
                return lang
        return None

    def _walk_code_files(self):
        for root, dirs, files in os.walk(self.root):
            dirs[:] = [d for d in dirs if d not in self.SKIP_DIRS]
            rel_root = os.path.relpath(root, self.root)
            if any(rel_root.startswith(sp) for sp in self.SKIP_PATHS):
                continue
            if any(rel_root.startswith(sp) for sp in self.self_skip_paths):
                continue
            for fname in files:
                ext = os.path.splitext(fname)[1]
                if ext not in self.CODE_EXTENSIONS:
                    continue
                filepath = os.path.join(root, fname)
                rel = os.path.relpath(filepath, self.root)
                try:
                    lines = open(filepath, errors="ignore").readlines()
                except Exception:
                    continue
                yield rel, lines

    def _detect_port_binding(self) -> Optional[Dict[str, Any]]:
        port_patterns = [
            (r'\.listen\(\s*(\d+)', "listen"),
            (r'(?:port|PORT)\s*[:=]\s*(\d+)', "config"),
            (r'0\.0\.0\.0', "bind_all"),
            (r'process\.env\.PORT', "env_port"),
            (r'os\.environ.*PORT', "env_port"),
        ]

        results: Dict[str, Any] = {
            "port": None,
            "binds_all_interfaces": False,
            "uses_env_port": False,
            "evidence": [],
        }

        for rel, lines in self._walk_code_files():
            for line_num, line in enumerate(lines, start=1):
                for pattern, kind in port_patterns:
                    m = re.search(pattern, line)
                    if not m:
                        continue
                    ev = make_evidence_from_line(rel, line_num, line.strip())
                    if kind in ("listen", "config"):
                        try:
                            results["port"] = int(m.group(1))
                        except (ValueError, IndexError):
                            pass
                        results["evidence"].append(ev)
                    elif kind == "bind_all":
                        results["binds_all_interfaces"] = True
                        results["evidence"].append(ev)
                    elif kind == "env_port":
                        results["uses_env_port"] = True
                        results["evidence"].append(ev)

        return results if results["evidence"] else None

    def _detect_secrets(self) -> List[Dict[str, Any]]:
        env_patterns = [
            r'process\.env\.([A-Z_][A-Z0-9_]+)',
            r'os\.environ\[?\.?get\(?\s*["\']([A-Z_][A-Z0-9_]+)',
            r'os\.getenv\(\s*["\']([A-Z_][A-Z0-9_]+)',
        ]

        secrets: Dict[str, List] = {}

        for rel, lines in self._walk_code_files():
            for line_num, line in enumerate(lines, start=1):
                for pattern in env_patterns:
                    for m in re.finditer(pattern, line):
                        var_name = m.group(1)
                        if var_name in self.COMMON_NON_SECRETS:
                            continue
                        if var_name not in secrets:
                            secrets[var_name] = []
                        secrets[var_name].append(make_evidence_from_line(rel, line_num, line.strip()))

        return [{"name": k, "referenced_in": v} for k, v in secrets.items()]

    def _detect_external_apis(self) -> List[Dict[str, Any]]:
        api_patterns = {
            "OpenAI": r'openai|gpt-|chatgpt|dall-e',
            "Stripe": r'stripe\.com|stripe\.api|sk_live_|pk_live_',
            "Firebase": r'firebase|firestore',
            "Supabase": r'supabase',
            "AWS": r'aws-sdk|amazonaws\.com|s3\.put',
            "Google Cloud": r'googleapis|google-cloud',
            "Twilio": r'twilio',
            "SendGrid": r'sendgrid|@sendgrid',
            "GitHub API": r'api\.github\.com',
            "Discord": r'discord\.js|discordapp\.com|discord\.com/api',
            "Slack": r'slack\.com/api|@slack',
            "Anthropic": r'anthropic|claude',
        }

        found: Dict[str, List] = {}

        for rel, lines in self._walk_code_files():
            full_text = "".join(lines).lower()
            for api_name, pattern in api_patterns.items():
                if re.search(pattern, full_text, re.IGNORECASE):
                    if api_name not in found:
                        found[api_name] = []
                    if not any(e["path"] == rel for e in found[api_name]):
                        found[api_name].append(make_evidence(rel, 0, 0, api_name))

        return [{"api": k, "evidence_files": v[:5]} for k, v in found.items()]

    def _detect_observability(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {"logging": False, "health_endpoint": False, "evidence": []}

        log_patterns = [r'console\.log', r'logger\.\w+', r'logging\.\w+', r'winston', r'pino']
        health_patterns = [r'["\'/]health["\']', r'["\'/]healthz["\']', r'["\'/]status["\']', r'["\'/]ping["\']']

        for rel, lines in self._walk_code_files():
            for line_num, line in enumerate(lines, start=1):
                if not result["logging"]:
                    for pattern in log_patterns:
                        if re.search(pattern, line):
                            result["logging"] = True
                            result["evidence"].append(make_evidence_from_line(rel, line_num, "(logging detected)"))
                            break

                for pattern in health_patterns:
                    if re.search(pattern, line):
                        result["health_endpoint"] = True
                        result["evidence"].append(make_evidence_from_line(rel, line_num, line.strip()))

        return result

    def _infer_deployment_assumptions(self, profile: Dict[str, Any]) -> List[str]:
        assumptions = []

        if profile.get("port_binding") and profile["port_binding"].get("port"):
            assumptions.append(f"Expects port {profile['port_binding']['port']} to be available")

        if profile.get("port_binding") and profile["port_binding"].get("binds_all_interfaces"):
            assumptions.append("Binds to 0.0.0.0 (all interfaces)")

        if not (self.root / "Dockerfile").exists():
            assumptions.append("No Dockerfile - depends on Replit runtime or manual setup")

        if profile.get("required_secrets"):
            names = [s["name"] for s in profile["required_secrets"]]
            assumptions.append(f"Requires {len(names)} secret(s): {', '.join(names[:10])}")

        if profile.get("nix_packages"):
            assumptions.append(f"Depends on Nix packages: {', '.join(profile['nix_packages'][:10])}")

        return assumptions
