import os
import json
import asyncio
import hashlib
import re
from pathlib import Path
from typing import Dict, Any, List, Optional
from rich.console import Console
import openai
from dotenv import load_dotenv

from core.acquire import acquire_target, AcquireResult
from core.replit_profile import ReplitProfiler
from core.evidence import make_evidence, make_evidence_from_line

load_dotenv()


class Analyzer:
    def __init__(self, source: str, output_dir: str, mode: str = "github", root: Optional[str] = None):
        self.source = source
        self.mode = mode
        self.output_dir = Path(output_dir)
        self.packs_dir = self.output_dir / "packs"
        self.console = Console()
        self.replit_profile: Optional[Dict[str, Any]] = None
        self.acquire_result: Optional[AcquireResult] = None
        self.root_scope = root
        self._profiler: Optional[ReplitProfiler] = None
        self._self_skip_paths: set = set()
        self._skipped_count: int = 0

        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.packs_dir.mkdir(parents=True, exist_ok=True)

        self.client = openai.OpenAI(
            api_key=os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY"),
            base_url=os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
        )

    @staticmethod
    def get_console():
        return Console()

    def _detect_self_skip(self):
        analyzer_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        try:
            rel = os.path.relpath(analyzer_dir, self.repo_dir)
            if not rel.startswith(".."):
                self._self_skip_paths = {rel}
                return rel
        except ValueError:
            pass
        return None

    async def run(self):
        self.console.print("[bold]Step 1: Acquiring target...[/bold]")
        self.acquire_result = acquire_target(
            target=self.source if self.mode != "replit" else None,
            replit_mode=(self.mode == "replit"),
            output_dir=self.output_dir,
        )
        self.repo_dir = self.acquire_result.root_path
        self.mode = self.acquire_result.mode
        self.console.print(f"  Mode: {self.mode}, Root: {self.repo_dir}, RunID: {self.acquire_result.run_id}")

        if self.root_scope:
            scoped = self.repo_dir / self.root_scope
            if scoped.is_dir():
                self.repo_dir = scoped
            else:
                self.console.print(f"[yellow]Warning:[/yellow] --root {self.root_scope} not found, using full target")

        analyzer_self_root = self._detect_self_skip()

        self.console.print("[bold]Step 2: Indexing files...[/bold]")
        file_index = self.index_files()
        self.console.print(f"  Indexed {len(file_index)} files (skipped {self._skipped_count} self-files)")

        self.console.print("[bold]Step 3: Creating evidence packs...[/bold]")
        packs = self.create_evidence_packs(file_index)

        if self.mode == "replit":
            self.console.print("[bold]Step 3b: Replit profiling...[/bold]")
            profiler = ReplitProfiler(self.repo_dir, self_root=analyzer_self_root)
            self._profiler = profiler
            self.replit_profile = profiler.detect()
            self.save_json("replit_profile.json", self.replit_profile)
            packs["replit"] = json.dumps(self.replit_profile, indent=2, default=str)
            self.console.print(f"  is_replit={self.replit_profile.get('is_replit')}, "
                               f"secrets={len(self.replit_profile.get('required_secrets', []))}, "
                               f"port={self.replit_profile.get('port_binding', {})}")

        self.console.print("[bold]Step 4: Extracting how-to...[/bold]")
        howto = await self.extract_howto(packs)
        howto = self._normalize_howto_evidence(howto)
        howto["completeness"] = self._compute_completeness(howto)

        self.console.print("[bold]Step 5: Generating claims & dossier...[/bold]")
        dossier, claims = await self.generate_dossier(packs, howto)
        claims = self._verify_claims_evidence(claims)

        self.save_json("index.json", file_index)
        self.save_json("target_howto.json", howto)
        self.save_json("claims.json", claims)
        self.save_json("coverage.json", {
            "mode": self.mode,
            "run_id": self.acquire_result.run_id,
            "scanned": len(file_index),
            "skipped": self._skipped_count,
            "is_replit": self.replit_profile is not None and self.replit_profile.get("is_replit", False),
            "self_skip": {
                "enabled": bool(self._self_skip_paths),
                "excluded_paths": list(self._self_skip_paths),
                "excluded_file_count": self._skipped_count,
                "reason": "Analyzer source files excluded to prevent false-positive pattern matches"
            }
        })

        with open(self.output_dir / "DOSSIER.md", "w") as f:
            f.write(dossier)

        self.console.print("[bold green]All outputs written.[/bold green]")

    def index_files(self) -> List[str]:
        skip_dirs = {".git", "node_modules", "__pycache__", ".pythonlibs", ".cache",
                     ".local", ".config", "out", ".upm", ".replit_agent"}
        skip_extensions = {".lock", ".png", ".jpg", ".jpeg", ".gif", ".ico",
                           ".woff", ".woff2", ".ttf", ".eot", ".map"}
        file_list = []
        self._skipped_count = 0
        for root, dirs, files in os.walk(self.repo_dir):
            dirs[:] = [d for d in dirs if d not in skip_dirs]
            rel_root = os.path.relpath(root, self.repo_dir)
            if any(rel_root == sp or rel_root.startswith(sp + os.sep) for sp in self._self_skip_paths):
                self._skipped_count += len(files)
                continue
            for file in files:
                ext = os.path.splitext(file)[1]
                if ext in skip_extensions:
                    continue
                rel_path = os.path.relpath(os.path.join(root, file), self.repo_dir)
                file_list.append(rel_path)
        return file_list

    def create_evidence_packs(self, file_index: List[str]) -> Dict[str, str]:
        packs: Dict[str, List[str]] = {
            "docs": [],
            "config": [],
            "code": [],
            "ops": [],
        }

        for f in file_index:
            lower = f.lower()
            if "readme" in lower or ".md" in lower or "doc" in lower or "changelog" in lower:
                packs["docs"].append(f)
            elif any(cfg in lower for cfg in [
                "package.json", "requirements.txt", "pyproject.toml", "cargo.toml",
                "docker", ".env", "config", ".replit", "replit.nix", "makefile",
                "taskfile", ".github/workflows", "tsconfig", "vite.config",
            ]):
                packs["config"].append(f)
            elif any(ops in lower for ops in [
                "dockerfile", "docker-compose", ".github", "ci", "deploy", "k8s", "helm",
            ]):
                packs["ops"].append(f)
            elif any(ext in lower for ext in [
                ".ts", ".js", ".py", ".go", ".rs", ".java", ".rb", ".tsx", ".jsx",
            ]):
                packs["code"].append(f)

        evidence = {}
        for category, files in packs.items():
            content = ""
            limit = 30 if category == "config" else 20
            for f in files[:limit]:
                try:
                    text = (self.repo_dir / f).read_text(errors='ignore')
                    lines = text.splitlines()
                    line_limit = 300 if category == "config" else 500
                    numbered_lines = "\n".join(
                        [f"L{i+1}: {line}" for i, line in enumerate(lines[:line_limit])]
                    )
                    content += f"\n--- FILE: {f} ---\n{numbered_lines}\n"
                except Exception:
                    pass

            pack_content = content[:100000]
            evidence[category] = pack_content
            (self.packs_dir / f"{category}_pack.txt").write_text(pack_content)

        return evidence

    def _parse_evidence_string(self, ev_str: str) -> Optional[dict]:
        if not isinstance(ev_str, str):
            return ev_str if isinstance(ev_str, dict) else None
        m = re.match(r'^([^:]+):(\d+)(?:-(\d+))?', ev_str.strip())
        if not m:
            return None
        path = m.group(1)
        line_start = int(m.group(2))
        line_end = int(m.group(3)) if m.group(3) else line_start
        snippet = self._read_line_from_repo(path, line_start)
        return make_evidence(path, line_start, line_end, snippet)

    def _read_line_from_repo(self, path: str, line_num: int) -> str:
        try:
            filepath = self.repo_dir / path
            if filepath.exists():
                lines = filepath.read_text(errors='ignore').splitlines()
                if 0 < line_num <= len(lines):
                    return lines[line_num - 1].strip()
        except Exception:
            pass
        return f"(line {line_num} from {path})"

    def _normalize_howto_evidence(self, howto: dict) -> dict:
        evidence_fields = ["install_steps", "config", "run_dev", "run_prod", "verification_steps", "common_failures"]
        for field in evidence_fields:
            items = howto.get(field, [])
            if not isinstance(items, list):
                continue
            for item in items:
                if "evidence" in item and isinstance(item["evidence"], str):
                    parsed = self._parse_evidence_string(item["evidence"])
                    item["evidence"] = parsed if parsed else item["evidence"]

        rp = howto.get("replit_execution_profile", {})
        if isinstance(rp, dict):
            pb = rp.get("port_binding", {})
            if isinstance(pb, dict) and "evidence" in pb:
                ev_list = pb["evidence"]
                if isinstance(ev_list, list):
                    pb["evidence"] = [
                        self._parse_evidence_string(e) if isinstance(e, str) else e
                        for e in ev_list
                    ]
            secrets = rp.get("required_secrets", [])
            if isinstance(secrets, list):
                for s in secrets:
                    if "referenced_in" in s and isinstance(s["referenced_in"], list):
                        s["referenced_in"] = [
                            self._parse_evidence_string(r) if isinstance(r, str) else r
                            for r in s["referenced_in"]
                        ]
            obs = rp.get("observability", {})
            if isinstance(obs, dict) and "evidence" in obs:
                ev_list = obs["evidence"]
                if isinstance(ev_list, list):
                    obs["evidence"] = [
                        self._parse_evidence_string(e) if isinstance(e, str) else e
                        for e in ev_list
                    ]

        return howto

    def _verify_claims_evidence(self, claims_data: dict) -> dict:
        claims = claims_data.get("claims", [])
        for claim in claims:
            evidences = claim.get("evidence", [])
            verified = []
            for ev in evidences:
                if not isinstance(ev, dict):
                    parsed = self._parse_evidence_string(str(ev))
                    if parsed:
                        verified.append(parsed)
                    continue

                path = ev.get("path", "")
                line_start = ev.get("line_start", 0)
                if path and line_start > 0:
                    snippet = self._read_line_from_repo(path, line_start)
                    correct_hash = hashlib.sha256(
                        snippet.encode("utf-8", errors="ignore")
                    ).hexdigest()[:12]
                    ev["snippet_hash"] = correct_hash
                    ev["snippet_hash_verified"] = True
                else:
                    ev["snippet_hash_verified"] = False

                verified.append(ev)

            claim["evidence"] = verified

            has_valid = any(
                isinstance(e, dict) and e.get("snippet_hash_verified", False)
                for e in verified
            )
            if not has_valid and claim.get("confidence", 0) > 0.20:
                claim["confidence"] = 0.20
                claim["status"] = "unverified"

        claims_data["claims"] = claims
        return claims_data

    def _compute_completeness(self, howto: dict) -> dict:
        score = 0
        missing = []

        def _has_evidence(items):
            if not isinstance(items, list):
                return False
            for s in items:
                ev = s.get("evidence")
                if ev:
                    return True
            return False

        run_steps = howto.get("run_dev", [])
        if _has_evidence(run_steps):
            score += 20
        else:
            missing.append("run_dev")

        config = howto.get("config", [])
        if _has_evidence(config):
            score += 15
        else:
            missing.append("config_with_evidence")

        port_found = False
        rp = howto.get("replit_execution_profile", {})
        if isinstance(rp, dict):
            pb = rp.get("port_binding", {})
            if isinstance(pb, dict) and pb.get("evidence"):
                port_found = True
        if not port_found and self.replit_profile:
            rpb = self.replit_profile.get("port_binding", {})
            if isinstance(rpb, dict) and rpb.get("evidence"):
                port_found = True
        if port_found:
            score += 15
        else:
            missing.append("port_behavior")

        verify = howto.get("verification_steps", [])
        if _has_evidence(verify):
            score += 20
        else:
            missing.append("verification_steps")

        examples = howto.get("usage_examples", [])
        if examples:
            score += 15
        else:
            missing.append("usage_examples")

        install = howto.get("install_steps", [])
        if _has_evidence(install):
            score += 15
        else:
            missing.append("install_steps")

        notes_parts = []
        if not (Path(self.repo_dir) / "Dockerfile").exists():
            notes_parts.append("No Dockerfile found")

        unknowns = howto.get("unknowns", [])
        if unknowns:
            notes_parts.append(f"{len(unknowns)} unknown(s) reported")

        return {
            "score": score,
            "max": 100,
            "missing": missing,
            "notes": "; ".join(notes_parts) if notes_parts else None
        }

    async def extract_howto(self, packs: Dict[str, str]) -> Dict[str, Any]:
        replit_context = ""
        if self.mode == "replit" and self.replit_profile:
            replit_context = f"""
IMPORTANT: This is a Replit workspace. You MUST include a "replit_execution_profile" key in your JSON output.

The Replit profiler detected the following (use this as evidence):
{json.dumps(self.replit_profile, indent=2, default=str)}

The "replit_execution_profile" must contain:
- "run_command": string (from .replit file, cite .replit:<line>)
- "language": string
- "port_binding": object with port, binds_all_interfaces, uses_env_port, evidence array
- "required_secrets": array of {{"name": "VAR_NAME", "referenced_in": ["file:line"]}}
- "external_apis": array of {{"api": "name", "evidence_files": ["file"]}}
- "deployment_assumptions": array of strings
- "observability": object with logging, health_endpoint, evidence array
- "limitations": array of strings (things that could not be determined)

Every field must cite evidence. If no evidence exists, set value to null and add to "unknowns".
Do NOT invent information. If a field cannot be determined, mark it unknown.
Cap confidence at 0.20 for any claim without direct file:line evidence.
"""

        prompt = f"""You are an expert system operator. Analyze the provided evidence to extract a JSON 'Operator Manual' for the target system.

Output this exact JSON schema:
{{
    "prereqs": ["list of tools/runtimes needed"],
    "install_steps": [{{"step": "description", "command": "command or null", "evidence": "file:line or null"}}],
    "config": [{{"name": "env var or config file", "purpose": "what it does", "evidence": "file:line reference"}}],
    "run_dev": [{{"step": "description", "command": "command", "evidence": "file:line reference"}}],
    "run_prod": [{{"step": "description", "command": "command or unknown", "evidence": "file:line reference or null"}}],
    "usage_examples": [{{"description": "what it does", "command": "example command or API call"}}],
    "verification_steps": [{{"step": "description", "command": "command", "evidence": "file:line reference"}}],
    "common_failures": [{{"symptom": "what happens", "cause": "why", "fix": "how to fix"}}],
    "unknowns": [{{"what_is_missing": "description", "why_it_matters": "impact", "what_evidence_needed": "specific evidence"}}],
    "missing_evidence_requests": ["list of things that could not be verified"]
}}
{replit_context}

RULES:
- Every claim MUST cite evidence as file:line.
- If you cannot cite evidence, mark as unknown and add to "unknowns" AND "missing_evidence_requests".
- Do NOT invent instructions or steps that are not supported by the provided evidence.
- If a how-to step has no evidence, set confidence to 0.20 or lower.
"""

        user_content = (
            f"DOCS:\n{packs.get('docs', '')[:40000]}\n\n"
            f"CONFIG:\n{packs.get('config', '')[:40000]}\n\n"
            f"OPS:\n{packs.get('ops', '')[:20000]}"
        )

        if "replit" in packs:
            user_content += f"\n\nREPLIT PROFILE:\n{packs['replit'][:20000]}"

        try:
            response = self.client.chat.completions.create(
                model="gpt-4.1",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": user_content}
                ],
                response_format={"type": "json_object"},
                max_completion_tokens=8192,
            )
            return json.loads(response.choices[0].message.content)
        except Exception as e:
            self.console.print(f"[red]Error extracting howto:[/red] {e}")
            return {
                "error": str(e),
                "unknowns": [{"what_is_missing": "Full how-to extraction failed", "why_it_matters": "No operator manual available", "what_evidence_needed": "Retry or check API key"}],
            }

    async def generate_dossier(self, packs: Dict[str, str], howto: Dict[str, Any]) -> tuple[str, Dict[str, Any]]:
        replit_section = ""
        if self.mode == "replit" and self.replit_profile:
            replit_section = """
10. **Replit Execution Profile**
    Include ALL of the following subsections with evidence citations (file:line):
    - Run command (from .replit)
    - Language/runtime
    - Port binding (port number, 0.0.0.0 binding, env PORT usage)
    - Required secrets (names only, NEVER values, cite file:line where each is referenced)
    - External APIs referenced (with evidence files)
    - Nix packages required (from replit.nix)
    - Deployment assumptions
    - Observability/logging (present or absent, cite evidence)
    - Limitations (what could NOT be determined)
"""

        prompt = f"""You are the 'Program Totality Analyzer'. Write a comprehensive Markdown DOSSIER about this target system.

MANDATORY SECTIONS:
1. **Identity of Target System** (What is it? What is it NOT?)
2. **Purpose & Jobs-to-be-done**
3. **Capability Map**
4. **Architecture Snapshot**
5. **How to Use the Target System** (Operator manual - refine the provided howto JSON into readable, actionable steps with evidence citations)
6. **Integration Surface** (APIs, webhooks, SDKs, data formats)
7. **Data & Security Posture** (Storage, encryption, auth, secret handling)
8. **Operational Reality** (What it takes to keep running)
9. **Maintainability & Change Risk**
{replit_section}
11. **Unknowns / Missing Evidence** (What could NOT be determined - be specific)
12. **Receipts** (Evidence index: list every file:line citation used above)

RULES:
- Every claim MUST cite evidence as (file:line) inline.
- If no evidence exists for a claim, say "Unknown — evidence needed: <describe>" and add to Unknowns section.
- Do NOT hallucinate. Do NOT use vague adjectives. Be specific and operational.
- The "How to Use" section must read like an actual operator manual with concrete commands.
- For Replit projects: the Replit Execution Profile section is MANDATORY.
- All secrets must be referenced by NAME only, never expose values.
"""

        howto_str = json.dumps(howto, indent=2, default=str)
        replit_str = ""
        if self.replit_profile:
            replit_str = f"\n\nREPLIT PROFILE (detected by static analysis):\n{json.dumps(self.replit_profile, indent=2, default=str)}"

        user_content = (
            f"HOWTO JSON:\n{howto_str}\n\n"
            f"DOCS:\n{packs.get('docs', '')[:30000]}\n\n"
            f"CONFIG:\n{packs.get('config', '')[:30000]}\n\n"
            f"CODE SNAPSHOT:\n{packs.get('code', '')[:40000]}"
            f"{replit_str}"
        )

        try:
            response = self.client.chat.completions.create(
                model="gpt-4.1",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": user_content}
                ],
                max_completion_tokens=8192,
            )
            dossier = response.choices[0].message.content

            claims = await self._extract_claims(dossier, packs)

            return dossier, claims
        except Exception as e:
            self.console.print(f"[red]Error generating dossier:[/red] {e}")
            return f"# Analysis Error\n\nFailed to generate dossier: {e}", {"error": str(e)}

    def _repair_truncated_json(self, raw: str) -> Optional[dict]:
        raw = raw.strip()
        if not raw.startswith("{"):
            return None
        for attempt in range(5):
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                pass
            raw = re.sub(r',\s*$', '', raw.rstrip())
            open_braces = raw.count("{") - raw.count("}")
            open_brackets = raw.count("[") - raw.count("]")
            in_string = False
            escape = False
            for ch in raw:
                if escape:
                    escape = False
                    continue
                if ch == '\\':
                    escape = True
                    continue
                if ch == '"':
                    in_string = not in_string
            if in_string:
                raw += '"'
            raw += "]" * max(0, open_brackets)
            raw += "}" * max(0, open_braces)
        return None

    async def _extract_claims(self, dossier: str, packs: Dict[str, str]) -> Dict[str, Any]:
        claims_prompt = """You are a claims extractor. Given a technical dossier and source evidence packs, extract the TOP 30 most important factual claims made in the dossier. Focus on architecture, runtime, dependencies, and security claims.

For each claim output:
{
  "claims": [
    {
      "id": "claim_NNN",
      "section": "section name from dossier",
      "statement": "the exact claim",
      "confidence": 0.0-1.0,
      "evidence": [
        {"path": "file.ext", "line_start": N, "line_end": N, "display": "file.ext:N"}
      ],
      "status": "evidenced | inferred | unknown"
    }
  ]
}

RULES:
- Limit to 30 claims maximum, prioritizing the most important ones
- confidence >= 0.80 only if evidence array is non-empty with valid file:line references
- confidence capped at 0.20 for claims with empty evidence or status "unknown"
- Do NOT fabricate snippet_hash values; the server computes them
- Every claim must have at least one evidence entry
- status "evidenced" = direct file:line proof; "inferred" = reasonable but indirect; "unknown" = no evidence"""

        user_content = (
            f"DOSSIER:\n{dossier[:30000]}\n\n"
            f"CONFIG EVIDENCE:\n{packs.get('config', '')[:15000]}\n\n"
            f"CODE EVIDENCE:\n{packs.get('code', '')[:15000]}"
        )

        try:
            response = self.client.chat.completions.create(
                model="gpt-4.1",
                messages=[
                    {"role": "system", "content": claims_prompt},
                    {"role": "user", "content": user_content}
                ],
                response_format={"type": "json_object"},
                max_completion_tokens=16384,
            )
            raw = response.choices[0].message.content
            try:
                claims_data = json.loads(raw)
            except json.JSONDecodeError:
                self.console.print("[yellow]Claims JSON truncated, attempting repair...[/yellow]")
                claims_data = self._repair_truncated_json(raw)
                if not claims_data:
                    claims_data = {"claims": [], "parse_error": "JSON truncated and repair failed"}

            claims_data["mode"] = self.mode
            claims_data["run_id"] = self.acquire_result.run_id if self.acquire_result else None
            claims_data["is_replit"] = self.replit_profile is not None and self.replit_profile.get("is_replit", False)
            return claims_data
        except Exception as e:
            self.console.print(f"[red]Error extracting claims:[/red] {e}")
            return {
                "claims": [],
                "error": str(e),
                "mode": self.mode,
                "run_id": self.acquire_result.run_id if self.acquire_result else None,
                "is_replit": self.replit_profile is not None and self.replit_profile.get("is_replit", False),
            }

    def save_json(self, filename: str, data: Any):
        with open(self.output_dir / filename, "w") as f:
            json.dump(data, f, indent=2, default=str)
