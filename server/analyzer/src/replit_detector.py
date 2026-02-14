import os
import re
from pathlib import Path
from typing import Dict, Any, List, Optional


class ReplitDetector:
    """Detects Replit-specific configuration and runtime details from a workspace."""

    def __init__(self, root_dir: Path):
        self.root = root_dir

    def detect(self) -> Dict[str, Any]:
        profile = {
            "is_replit": False,
            "run_command": None,
            "language": None,
            "entrypoint": None,
            "nix_packages": [],
            "port_binding": None,
            "required_secrets": [],
            "external_apis": [],
            "deployment_assumptions": [],
            "observability": {"logging": False, "health_endpoint": False},
            "replit_file": None,
            "replit_nix": None,
        }

        replit_file = self.root / ".replit"
        replit_nix = self.root / "replit.nix"

        if replit_file.exists():
            profile["is_replit"] = True
            profile["replit_file"] = self._parse_replit_file(replit_file)
            rc = profile["replit_file"]
            profile["run_command"] = rc.get("run")
            profile["entrypoint"] = rc.get("entrypoint")
            profile["language"] = rc.get("language")

        if replit_nix.exists():
            profile["is_replit"] = True
            profile["replit_nix"] = self._parse_replit_nix(replit_nix)
            profile["nix_packages"] = profile["replit_nix"].get("packages", [])

        # Detect language from manifests if not in .replit
        if not profile["language"]:
            profile["language"] = self._detect_language()

        # Detect port bindings from code
        profile["port_binding"] = self._detect_port_binding()

        # Detect secrets referenced in code
        profile["required_secrets"] = self._detect_secrets()

        # Detect external API references
        profile["external_apis"] = self._detect_external_apis()

        # Detect observability
        profile["observability"] = self._detect_observability()

        # Deployment assumptions
        profile["deployment_assumptions"] = self._infer_deployment_assumptions(profile)

        return profile

    def _parse_replit_file(self, filepath: Path) -> Dict[str, Any]:
        content = filepath.read_text(errors="ignore")
        result = {}

        run_match = re.search(r'^run\s*=\s*"(.+?)"', content, re.MULTILINE)
        if run_match:
            result["run"] = run_match.group(1)

        entry_match = re.search(r'^entrypoint\s*=\s*"(.+?)"', content, re.MULTILINE)
        if entry_match:
            result["entrypoint"] = entry_match.group(1)

        lang_match = re.search(r'^language\s*=\s*"(.+?)"', content, re.MULTILINE)
        if lang_match:
            result["language"] = lang_match.group(1)

        # Detect modules section
        modules_match = re.search(r'\[nix\]', content)
        if modules_match:
            result["has_nix_section"] = True

        result["raw_content"] = content
        return result

    def _parse_replit_nix(self, filepath: Path) -> Dict[str, Any]:
        content = filepath.read_text(errors="ignore")
        result = {"raw_content": content, "packages": []}

        # Extract package names from pkgs.xxx references
        pkg_matches = re.findall(r'pkgs\.([a-zA-Z0-9_-]+)', content)
        result["packages"] = list(set(pkg_matches))

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

    def _detect_port_binding(self) -> Optional[Dict[str, Any]]:
        port_patterns = [
            (r'\.listen\(\s*(\d+)', "listen"),
            (r'port\s*[:=]\s*(\d+)', "config"),
            (r'PORT\s*[:=]\s*(\d+)', "env_default"),
            (r'0\.0\.0\.0', "bind_all"),
            (r'process\.env\.PORT', "env_port"),
            (r'os\.environ.*PORT', "env_port"),
        ]
        
        results = {"port": None, "binds_all_interfaces": False, "uses_env_port": False, "evidence": []}

        code_extensions = {".ts", ".js", ".py", ".go", ".rs", ".java", ".rb"}
        
        for root, _, files in os.walk(self.root):
            if any(skip in root for skip in [".git", "node_modules", "__pycache__", ".pythonlibs"]):
                continue
            for fname in files:
                ext = os.path.splitext(fname)[1]
                if ext not in code_extensions:
                    continue
                filepath = os.path.join(root, fname)
                try:
                    content = open(filepath, errors="ignore").read()
                except Exception:
                    continue
                    
                rel = os.path.relpath(filepath, self.root)
                
                for pattern, kind in port_patterns:
                    matches = re.finditer(pattern, content)
                    for m in matches:
                        if kind == "listen" or kind == "config" or kind == "env_default":
                            try:
                                results["port"] = int(m.group(1))
                            except (ValueError, IndexError):
                                pass
                            results["evidence"].append(f"{rel}: {m.group(0)}")
                        elif kind == "bind_all":
                            results["binds_all_interfaces"] = True
                            results["evidence"].append(f"{rel}: binds 0.0.0.0")
                        elif kind == "env_port":
                            results["uses_env_port"] = True
                            results["evidence"].append(f"{rel}: uses PORT env var")
        
        return results if results["evidence"] else None

    def _detect_secrets(self) -> List[Dict[str, str]]:
        env_patterns = [
            r'process\.env\.([A-Z_][A-Z0-9_]+)',
            r'os\.environ\[?\.?get\(?\s*["\']([A-Z_][A-Z0-9_]+)',
            r'os\.getenv\(\s*["\']([A-Z_][A-Z0-9_]+)',
            r'env\(\s*["\']([A-Z_][A-Z0-9_]+)',
            r'Env\.get\(\s*["\']([A-Z_][A-Z0-9_]+)',
        ]
        
        # Common non-secret env vars to exclude
        exclude = {
            "NODE_ENV", "PATH", "HOME", "PORT", "PWD", "SHELL", "USER",
            "HOSTNAME", "LANG", "TERM", "DISPLAY", "XDG_RUNTIME_DIR",
            "REPLIT_DB_URL", "REPL_ID", "REPL_SLUG", "REPL_OWNER",
        }

        secrets = {}
        code_extensions = {".ts", ".js", ".py", ".go", ".rs", ".java", ".rb", ".env.example", ".env.sample"}

        for root, _, files in os.walk(self.root):
            if any(skip in root for skip in [".git", "node_modules", "__pycache__", ".pythonlibs"]):
                continue
            for fname in files:
                ext = os.path.splitext(fname)[1]
                if ext not in code_extensions and fname not in {".env.example", ".env.sample"}:
                    continue
                filepath = os.path.join(root, fname)
                try:
                    content = open(filepath, errors="ignore").read()
                except Exception:
                    continue
                
                rel = os.path.relpath(filepath, self.root)
                
                for pattern in env_patterns:
                    for m in re.finditer(pattern, content):
                        var_name = m.group(1)
                        if var_name not in exclude:
                            if var_name not in secrets:
                                secrets[var_name] = []
                            secrets[var_name].append(rel)

        return [{"name": k, "referenced_in": v} for k, v in secrets.items()]

    def _detect_external_apis(self) -> List[Dict[str, str]]:
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
        
        found = {}
        code_extensions = {".ts", ".js", ".py", ".go", ".rs", ".java", ".rb"}

        for root, _, files in os.walk(self.root):
            if any(skip in root for skip in [".git", "node_modules", "__pycache__", ".pythonlibs"]):
                continue
            for fname in files:
                ext = os.path.splitext(fname)[1]
                if ext not in code_extensions:
                    continue
                filepath = os.path.join(root, fname)
                try:
                    content = open(filepath, errors="ignore").read().lower()
                except Exception:
                    continue

                rel = os.path.relpath(filepath, self.root)
                for api_name, pattern in api_patterns.items():
                    if re.search(pattern, content, re.IGNORECASE):
                        if api_name not in found:
                            found[api_name] = []
                        found[api_name].append(rel)

        return [{"api": k, "evidence_files": v[:5]} for k, v in found.items()]

    def _detect_observability(self) -> Dict[str, Any]:
        result = {"logging": False, "health_endpoint": False, "evidence": []}
        
        log_patterns = [r'console\.log', r'logger\.\w+', r'logging\.\w+', r'winston', r'pino']
        health_patterns = [r'/health', r'/healthz', r'/status', r'/ping', r'/ready']

        code_extensions = {".ts", ".js", ".py", ".go"}

        for root, _, files in os.walk(self.root):
            if any(skip in root for skip in [".git", "node_modules", "__pycache__", ".pythonlibs"]):
                continue
            for fname in files:
                ext = os.path.splitext(fname)[1]
                if ext not in code_extensions:
                    continue
                filepath = os.path.join(root, fname)
                try:
                    content = open(filepath, errors="ignore").read()
                except Exception:
                    continue
                
                rel = os.path.relpath(filepath, self.root)

                for pattern in log_patterns:
                    if re.search(pattern, content):
                        result["logging"] = True
                        break

                for pattern in health_patterns:
                    if re.search(pattern, content):
                        result["health_endpoint"] = True
                        result["evidence"].append(f"{rel}: {pattern}")
                        break

        return result

    def _infer_deployment_assumptions(self, profile: Dict[str, Any]) -> List[str]:
        assumptions = []
        
        if profile.get("port_binding") and profile["port_binding"].get("port"):
            assumptions.append(f"Expects port {profile['port_binding']['port']} to be available")
        
        if profile.get("port_binding") and profile["port_binding"].get("binds_all_interfaces"):
            assumptions.append("Binds to 0.0.0.0 (all interfaces)")
        
        if not (self.root / "Dockerfile").exists():
            assumptions.append("No Dockerfile found - depends on Replit runtime or manual setup")
        
        if profile.get("required_secrets"):
            secret_names = [s["name"] for s in profile["required_secrets"]]
            assumptions.append(f"Requires {len(secret_names)} secret(s): {', '.join(secret_names[:10])}")
        
        if profile.get("nix_packages"):
            assumptions.append(f"Depends on Nix packages: {', '.join(profile['nix_packages'][:10])}")
        
        return assumptions
