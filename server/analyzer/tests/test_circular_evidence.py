"""
Tests for circular evidence rejection.

Ensures that RR-generated artifacts cannot be cited as VERIFIED evidence.
This prevents the self-referential trust collapse where RR output proves RR output.
"""
import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from server.analyzer.src.core.verify_policy import (
    is_generated_artifact,
    is_evidence_verified_v1,
    is_verified_claim,
    get_verified_evidence,
    evidence_tier,
)


class TestIsGeneratedArtifact(unittest.TestCase):
    def test_rejects_evidence_pack(self):
        self.assertTrue(is_generated_artifact("evidence_pack.v1.json"))

    def test_rejects_claims_json(self):
        self.assertTrue(is_generated_artifact("claims.json"))

    def test_rejects_dossier(self):
        self.assertTrue(is_generated_artifact("DOSSIER.md"))

    def test_rejects_report_engineer(self):
        self.assertTrue(is_generated_artifact("REPORT_ENGINEER.md"))

    def test_rejects_report_auditor(self):
        self.assertTrue(is_generated_artifact("REPORT_AUDITOR.md"))

    def test_rejects_report_executive(self):
        self.assertTrue(is_generated_artifact("REPORT_EXECUTIVE.md"))

    def test_rejects_target_howto(self):
        self.assertTrue(is_generated_artifact("target_howto.json"))

    def test_rejects_coverage_json(self):
        self.assertTrue(is_generated_artifact("coverage.json"))

    def test_rejects_diff_json(self):
        self.assertTrue(is_generated_artifact("diff.json"))

    def test_rejects_diff_report(self):
        self.assertTrue(is_generated_artifact("DIFF_REPORT.md"))

    def test_rejects_custom_report_prefix(self):
        self.assertTrue(is_generated_artifact("REPORT_CUSTOM.md"))

    def test_rejects_nested_in_out_dir(self):
        self.assertTrue(is_generated_artifact("out/17/evidence_pack.v1.json"))

    def test_allows_source_file(self):
        self.assertFalse(is_generated_artifact("server/index.ts"))

    def test_allows_config_file(self):
        self.assertFalse(is_generated_artifact("package.json"))

    def test_allows_lockfile(self):
        self.assertFalse(is_generated_artifact("package-lock.json"))

    def test_allows_readme(self):
        self.assertFalse(is_generated_artifact("README.md"))

    def test_allows_source_py(self):
        self.assertFalse(is_generated_artifact("server/analyzer/src/analyzer.py"))

    def test_empty_path_is_not_generated(self):
        self.assertFalse(is_generated_artifact(""))


class TestCircularEvidenceRejection(unittest.TestCase):
    def _make_ev(self, path, verified=True, snippet_hash="abc123"):
        return {
            "path": path,
            "line_start": 1,
            "line_end": 1,
            "snippet_hash": snippet_hash,
            "snippet_hash_verified": verified,
            "display": f"{path}:1",
        }

    def test_source_evidence_accepted(self):
        ev = self._make_ev("server/index.ts")
        self.assertTrue(is_evidence_verified_v1(ev))

    def test_generated_evidence_rejected(self):
        ev = self._make_ev("evidence_pack.v1.json")
        self.assertFalse(is_evidence_verified_v1(ev))

    def test_claims_json_evidence_rejected(self):
        ev = self._make_ev("claims.json")
        self.assertFalse(is_evidence_verified_v1(ev))

    def test_dossier_evidence_rejected(self):
        ev = self._make_ev("DOSSIER.md")
        self.assertFalse(is_evidence_verified_v1(ev))

    def test_report_evidence_rejected(self):
        ev = self._make_ev("REPORT_ENGINEER.md")
        self.assertFalse(is_evidence_verified_v1(ev))

    def test_claim_with_only_generated_evidence_not_verified(self):
        claim = {
            "statement": "System uses X",
            "evidence": [
                self._make_ev("evidence_pack.v1.json"),
                self._make_ev("DOSSIER.md"),
            ],
        }
        self.assertFalse(is_verified_claim(claim))

    def test_claim_with_mixed_evidence_verified_via_source(self):
        claim = {
            "statement": "System uses X",
            "evidence": [
                self._make_ev("evidence_pack.v1.json"),
                self._make_ev("server/index.ts"),
            ],
        }
        self.assertTrue(is_verified_claim(claim))

    def test_get_verified_evidence_excludes_generated(self):
        claim = {
            "statement": "System uses X",
            "evidence": [
                self._make_ev("evidence_pack.v1.json"),
                self._make_ev("server/index.ts"),
                self._make_ev("claims.json"),
            ],
        }
        verified = get_verified_evidence(claim)
        self.assertEqual(len(verified), 1)
        self.assertEqual(verified[0]["path"], "server/index.ts")

    def test_evidence_tier_empty_for_generated(self):
        ev = self._make_ev("evidence_pack.v1.json")
        self.assertEqual(evidence_tier(ev), "")


if __name__ == "__main__":
    unittest.main()
