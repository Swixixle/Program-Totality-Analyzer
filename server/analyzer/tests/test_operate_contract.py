"""
Tests for operate.json evidence contract enforcement.

Ensures:
- EVIDENCED items must have non-empty evidence list with path + snippet_hash
- INFERRED items may have evidence (derived from evidence)
- UNKNOWN items must have unknown_reason string
- Readiness scores are 0-100
- Gaps must have rank, title
- Runbook steps must have step number, action
- validate_operate catches violations
"""
import json
import copy
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from server.analyzer.src.core.operate import build_operate, validate_operate


SELF_REPO = Path(__file__).resolve().parents[3]


class TestOperateContract(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        file_index = []
        skip_dirs = {"node_modules", ".git", "__pycache__", "dist", "out", ".pythonlibs", ".local", ".cache", "attached_assets"}
        for p in SELF_REPO.rglob("*"):
            if p.is_file():
                parts = p.relative_to(SELF_REPO).parts
                if any(part in skip_dirs or part.startswith('.') for part in parts):
                    continue
                try:
                    rel = str(p.relative_to(SELF_REPO))
                    file_index.append({"path": rel, "size": p.stat().st_size})
                except Exception:
                    pass
        cls.operate = build_operate(
            repo_dir=SELF_REPO,
            file_index=file_index,
            mode="replit",
            replit_profile={"replit_detected": True},
        )

    def _get_tier(self, item):
        return item.get("tier") or item.get("status", "")

    def test_top_level_fields(self):
        required = ["tool_version", "mode", "boot", "integrate", "deploy",
                     "readiness", "gaps", "runbooks", "snapshot"]
        for field in required:
            self.assertIn(field, self.operate, f"Missing top-level field: {field}")

    def test_tool_version_format(self):
        self.assertTrue(self.operate["tool_version"].startswith("rr-"))

    def test_evidence_contract_evidenced(self):
        """EVIDENCED items must have evidence with path and snippet_hash."""
        violations = []
        for section_name in ["boot", "integrate", "deploy"]:
            section = self.operate.get(section_name, {})
            for sub_key, items in section.items():
                if not isinstance(items, list):
                    continue
                for item in items:
                    tier = self._get_tier(item)
                    if tier == "EVIDENCED":
                        ev = item.get("evidence", [])
                        if not ev:
                            violations.append(f"{section_name}.{sub_key}: EVIDENCED but no evidence")
                        for e in ev:
                            if "path" not in e and "kind" not in e:
                                violations.append(f"{section_name}.{sub_key}: evidence missing 'path'")
                            if "snippet_hash" not in e:
                                violations.append(f"{section_name}.{sub_key}: evidence missing 'snippet_hash'")
        self.assertEqual(violations, [], f"Evidence contract violations:\n" + "\n".join(violations))

    def test_evidence_contract_unknown(self):
        """UNKNOWN items must have unknown_reason."""
        violations = []
        for section_name in ["boot", "integrate", "deploy", "snapshot"]:
            section = self.operate.get(section_name, {})
            for sub_key, items in section.items():
                if not isinstance(items, list):
                    continue
                for item in items:
                    tier = self._get_tier(item)
                    if tier == "UNKNOWN" and not item.get("unknown_reason"):
                        violations.append(f"{section_name}.{sub_key}: UNKNOWN but no unknown_reason")
        self.assertEqual(violations, [], f"Unknown reason violations:\n" + "\n".join(violations))

    def test_readiness_scores_range(self):
        """All readiness scores must be 0-100."""
        readiness = self.operate.get("readiness", {})
        for category, data in readiness.items():
            score = data.get("score", -1)
            self.assertGreaterEqual(score, 0, f"{category} score below 0")
            self.assertLessEqual(score, 100, f"{category} score above 100")
            self.assertIsInstance(data.get("reasons"), list, f"{category} missing reasons list")

    def test_gaps_structure(self):
        """Each gap must have rank, title, severity, and action."""
        valid_severities = {"high", "medium", "low"}
        for gap in self.operate.get("gaps", []):
            self.assertIn("rank", gap)
            self.assertIn("title", gap)
            self.assertIn("severity", gap, f"Gap '{gap.get('title')}' missing severity")
            self.assertIn(gap["severity"], valid_severities,
                          f"Gap '{gap.get('title')}' has invalid severity '{gap['severity']}'")
            self.assertIn("action", gap, f"Gap '{gap.get('title')}' missing action")

    def test_runbooks_structure(self):
        """Each runbook step must have step number and action."""
        runbooks = self.operate.get("runbooks", {})
        for category, steps in runbooks.items():
            self.assertIsInstance(steps, list, f"runbooks.{category} not a list")
            for step in steps:
                self.assertTrue(
                    "step" in step or "order" in step,
                    f"runbooks.{category} step missing step/order number"
                )
                self.assertTrue(
                    "action" in step or "title" in step,
                    f"runbooks.{category} step missing action/title"
                )
                tier = self._get_tier(step)
                self.assertIn(tier, ["EVIDENCED", "INFERRED", "UNKNOWN"],
                              f"runbooks.{category} step has invalid tier: {tier}")

    def test_boot_has_items(self):
        """Boot section should detect at least install and dev commands for this repo."""
        boot = self.operate["boot"]
        self.assertGreater(len(boot.get("install", [])), 0, "No install commands detected")
        self.assertGreater(len(boot.get("dev", [])), 0, "No dev commands detected")

    def test_endpoints_detected(self):
        """Integration should detect API endpoints in this repo."""
        endpoints = self.operate.get("integrate", {}).get("endpoints", [])
        self.assertGreater(len(endpoints), 0, "No endpoints detected")
        for ep in endpoints:
            self.assertIn("method", ep)
            self.assertIn("path", ep)

    def test_env_vars_detected(self):
        """Integration should detect env vars in this repo."""
        env_vars = self.operate.get("integrate", {}).get("env_vars", [])
        self.assertGreater(len(env_vars), 0, "No env vars detected")
        names = [v.get("name") or v.get("value", "") for v in env_vars]
        self.assertTrue(
            any("DATABASE_URL" in n for n in names),
            f"DATABASE_URL not detected among: {names}"
        )

    def test_snapshot_has_runtime(self):
        """Snapshot should have runtime information."""
        snapshot = self.operate.get("snapshot", {})
        self.assertIn("runtime", snapshot)
        self.assertGreater(len(snapshot["runtime"]), 0, "No runtimes detected")


class TestValidateOperate(unittest.TestCase):

    def _make_minimal_operate(self):
        return {
            "tool_version": "rr-0.1.0",
            "mode": "replit",
            "boot": {
                "install": [{"command": "npm install", "tier": "EVIDENCED",
                             "evidence": [{"path": "package.json", "line_start": 1, "snippet_hash": "abc123", "display": "package.json:1"}]}],
                "dev": [], "prod": [], "ports": []
            },
            "integrate": {"endpoints": [], "env_vars": [], "auth": []},
            "deploy": {"platform": [], "ci": [], "containerization": []},
            "readiness": {
                "boot": {"score": 100, "reasons": ["ok"]},
                "integration": {"score": 0, "reasons": ["none"]},
                "deployment": {"score": 0, "reasons": ["none"]},
                "observability": {"score": 0, "reasons": ["none"]},
            },
            "gaps": [],
            "runbooks": {"local_dev": [], "production": [], "integration": [], "troubleshooting": []},
            "snapshot": {"runtime": [{"status": "EVIDENCED", "value": "node", "evidence": []}]},
        }

    def test_valid_operate_no_errors(self):
        op = self._make_minimal_operate()
        errors = validate_operate(op)
        self.assertEqual(errors, [])

    def test_missing_top_level_field(self):
        op = self._make_minimal_operate()
        del op["boot"]
        errors = validate_operate(op)
        self.assertTrue(any("boot" in e for e in errors))

    def test_evidenced_without_evidence(self):
        op = self._make_minimal_operate()
        op["boot"]["install"] = [{"command": "npm install", "tier": "EVIDENCED", "evidence": []}]
        errors = validate_operate(op)
        self.assertTrue(any("EVIDENCED" in e for e in errors), f"Expected EVIDENCED error, got: {errors}")

    def test_unknown_without_reason(self):
        op = self._make_minimal_operate()
        op["deploy"]["containerization"] = [{"name": "docker", "tier": "UNKNOWN"}]
        errors = validate_operate(op)
        self.assertTrue(any("unknown_reason" in e for e in errors), f"Expected unknown_reason error, got: {errors}")

    def test_score_out_of_range(self):
        op = self._make_minimal_operate()
        op["readiness"]["boot"]["score"] = 150
        errors = validate_operate(op)
        self.assertTrue(any("score" in e.lower() for e in errors), f"Expected score error, got: {errors}")


if __name__ == "__main__":
    unittest.main()
