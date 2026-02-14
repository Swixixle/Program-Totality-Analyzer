import os
import json
import shutil
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional
from rich.console import Console
from git import Repo
import openai
from dotenv import load_dotenv

from replit_detector import ReplitDetector

load_dotenv()


class Analyzer:
    def __init__(self, source: str, output_dir: str, mode: str = "github"):
        """
        source: GitHub URL, local path, or workspace root (for replit mode)
        mode: "github", "local", or "replit"
        """
        self.source = source
        self.mode = mode
        self.output_dir = Path(output_dir)
        self.packs_dir = self.output_dir / "packs"
        self.console = Console()
        self.replit_profile: Optional[Dict[str, Any]] = None

        if mode == "github":
            self.repo_dir = self.output_dir / "repo"
        elif mode == "local":
            self.repo_dir = Path(source)
        elif mode == "replit":
            self.repo_dir = Path(source)
        else:
            raise ValueError(f"Unknown mode: {mode}")

        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.packs_dir.mkdir(parents=True, exist_ok=True)

        self.client = openai.OpenAI(
            api_key=os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY"),
            base_url=os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
        )

    @staticmethod
    def get_console():
        return Console()

    async def run(self):
        self.console.print("Step 1: Acquiring target...")
        self.acquire()

        self.console.print("Step 2: Indexing and Coverage...")
        file_index = self.index_files()

        self.console.print("Step 3: Creating Evidence Packs...")
        packs = self.create_evidence_packs(file_index)

        if self.mode == "replit":
            self.console.print("Step 3b: Replit Detection...")
            detector = ReplitDetector(self.repo_dir)
            self.replit_profile = detector.detect()
            self.save_json("replit_profile.json", self.replit_profile)
            # Add replit config to packs
            packs["replit"] = json.dumps(self.replit_profile, indent=2, default=str)

        self.console.print("Step 4: Extracting 'How-to'...")
        howto = await self.extract_howto(packs)

        self.console.print("Step 5: Generating Claims & Dossier...")
        dossier, claims = await self.generate_dossier(packs, howto)

        self.save_json("index.json", file_index)
        self.save_json("target_howto.json", howto)
        self.save_json("claims.json", claims)
        self.save_json("coverage.json", {
            "mode": self.mode,
            "scanned": len(file_index),
            "skipped": 0,
            "is_replit": self.replit_profile is not None and self.replit_profile.get("is_replit", False),
        })

        with open(self.output_dir / "DOSSIER.md", "w") as f:
            f.write(dossier)

    def acquire(self):
        if self.mode == "github":
            if self.repo_dir.exists():
                shutil.rmtree(self.repo_dir)
            Repo.clone_from(self.source, self.repo_dir)
        elif self.mode in ("local", "replit"):
            if not self.repo_dir.exists():
                raise FileNotFoundError(f"Directory not found: {self.repo_dir}")

    def index_files(self) -> List[str]:
        skip_dirs = {".git", "node_modules", "__pycache__", ".pythonlibs", ".cache",
                     ".local", ".config", "out", ".upm", ".replit_agent"}
        skip_extensions = {".lock", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".eot"}
        file_list = []
        for root, dirs, files in os.walk(self.repo_dir):
            # Prune directories in-place
            dirs[:] = [d for d in dirs if d not in skip_dirs]
            for file in files:
                ext = os.path.splitext(file)[1]
                if ext in skip_extensions:
                    continue
                rel_path = os.path.relpath(os.path.join(root, file), self.repo_dir)
                file_list.append(rel_path)
        return file_list

    def create_evidence_packs(self, file_index: List[str]) -> Dict[str, str]:
        packs = {
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
            elif any(ops in lower for ops in ["dockerfile", "docker-compose", ".github", "ci", "deploy", "k8s", "helm"]):
                packs["ops"].append(f)
            elif any(ext in lower for ext in [".ts", ".js", ".py", ".go", ".rs", ".java", ".rb", ".tsx", ".jsx"]):
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
                    numbered_lines = "\n".join([f"{i+1}: {line}" for i, line in enumerate(lines[:line_limit])])
                    content += f"\n--- FILE: {f} ---\n{numbered_lines}\n"
                except Exception:
                    pass

            pack_content = content[:100000]
            evidence[category] = pack_content
            (self.packs_dir / f"{category}_pack.txt").write_text(pack_content)

        return evidence

    async def extract_howto(self, packs: Dict[str, str]) -> Dict[str, Any]:
        replit_context = ""
        if self.mode == "replit" and self.replit_profile:
            replit_context = f"""
        
        IMPORTANT: This is a Replit workspace. Include Replit-specific how-to steps.
        The Replit profile detected:
        {json.dumps(self.replit_profile, indent=2, default=str)}
        
        Add a "replit_execution_profile" section with:
        - run_command
        - language
        - port_binding
        - required_secrets (names only)
        - external_apis
        - deployment_assumptions
        - observability
        """

        prompt = f"""
        You are an expert system operator. Analyze the provided evidence to extract a JSON 'Operator Manual' for the target system.
        
        Output this JSON schema:
        {{
            "prereqs": ["list of tools/runtimes needed"],
            "install_steps": [{{"step": "description", "command": "command or null", "evidence": "file:line or null"}}],
            "config": [{{"name": "env var or config file", "purpose": "what it does", "evidence": "file reference"}}],
            "run_dev": [{{"step": "description", "command": "command", "evidence": "file reference"}}],
            "run_prod": [{{"step": "description", "command": "command or unknown", "evidence": "file reference or null"}}],
            "usage_examples": [{{"description": "what it does", "command": "example command or API call"}}],
            "verification_steps": [{{"step": "description", "command": "command", "evidence": "file reference"}}],
            "common_failures": [{{"symptom": "what happens", "cause": "why", "fix": "how to fix"}}],
            "unknowns": [{{"item": "what is missing", "evidence_needed": "what would resolve it"}}]
        }}
        {replit_context}
        
        If you cannot cite evidence, mark as unknown. Do NOT invent instructions.
        """

        user_content = f"DOCS:\n{packs.get('docs', '')[:40000]}\n\nCONFIG:\n{packs.get('config', '')[:40000]}\n\nOPS:\n{packs.get('ops', '')[:20000]}"

        try:
            response = self.client.chat.completions.create(
                model="gpt-5.1",
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
            return {"error": str(e), "unknowns": [{"item": "Full how-to extraction failed", "evidence_needed": "Retry or check API key"}]}

    async def generate_dossier(self, packs: Dict[str, str], howto: Dict[str, Any]) -> tuple[str, Dict[str, Any]]:
        replit_section = ""
        if self.mode == "replit" and self.replit_profile:
            replit_section = """
        10. **Replit Execution Profile**
            - Run command
            - Language/runtime
            - Port binding
            - Required secrets (names only, never values)
            - External APIs referenced
            - Deployment assumptions
            - Observability/logging present?
        """

        prompt = f"""
        You are the 'Program Totality Analyzer'. Write a comprehensive Markdown DOSSIER about this target system.
        
        MANDATORY SECTIONS:
        1. **Identity of Target System** (What is it? What is it NOT?)
        2. **Purpose & Jobs-to-be-done**
        3. **Capability Map**
        4. **Architecture Snapshot**
        5. **How to Use the Target System** (Operator manual - refine the provided howto JSON into readable, actionable steps)
        6. **Integration Surface** (APIs, webhooks, SDKs, data formats)
        7. **Data & Security Posture** (Storage, encryption, auth, secret handling)
        8. **Operational Reality** (What it takes to keep running)
        9. **Maintainability & Change Risk**
        {replit_section}
        11. **Unknowns / Missing Evidence** (What could NOT be determined)
        12. **Receipts** (Evidence index - explicit vs inferred)

        RULES:
        - Every claim must cite evidence (file path + line if possible)
        - If no evidence exists, say "Unknown" and state what evidence would be needed
        - Do not hallucinate. Do not use vague adjectives. Be specific.
        - The "How to Use" section should read like an actual operator manual
        - For Replit projects: include the Replit Execution Profile
        """

        howto_str = json.dumps(howto, indent=2, default=str)
        replit_str = ""
        if self.replit_profile:
            replit_str = f"\n\nREPLIT PROFILE:\n{json.dumps(self.replit_profile, indent=2, default=str)}"

        user_content = (
            f"HOWTO JSON:\n{howto_str}\n\n"
            f"DOCS:\n{packs.get('docs', '')[:30000]}\n\n"
            f"CONFIG:\n{packs.get('config', '')[:30000]}\n\n"
            f"CODE SNAPSHOT:\n{packs.get('code', '')[:40000]}"
            f"{replit_str}"
        )

        try:
            response = self.client.chat.completions.create(
                model="gpt-5.1",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": user_content}
                ],
                max_completion_tokens=8192,
            )
            dossier = response.choices[0].message.content

            claims = {
                "type": "dossier_generated",
                "mode": self.mode,
                "is_replit": self.replit_profile is not None and self.replit_profile.get("is_replit", False),
                "sections_generated": True,
            }

            return dossier, claims
        except Exception as e:
            self.console.print(f"[red]Error generating dossier:[/red] {e}")
            return f"# Analysis Error\n\nFailed to generate dossier: {e}", {"error": str(e)}

    def save_json(self, filename: str, data: Any):
        with open(self.output_dir / filename, "w") as f:
            json.dump(data, f, indent=2, default=str)
