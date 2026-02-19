"""
No-drift test for the Repository Reconnaissance Contract Audit block in REPORT_ENGINEER.md.

Ensures the audit block contains all required headings, disclaimers,
and structural guardrails. Prevents silent drift into marketing copy.

Also tests the fail-fast guard that prevents rendering if the
evidence pack is missing from disk.
"""
import json
import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from server.analyzer.src.core.render import render_report, assert_pack_written


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "evidence_pack.v1.fixture.json"


def _load_fixture_pack() -> dict:
    assert FIXTURE_PATH.exists(), f"Missing fixture pack: {FIXTURE_PATH}"
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


class TestContractAuditBlock(unittest.TestCase):
    def setUp(self):
        self.pack = _load_fixture_pack()
        self.md = render_report(self.pack, mode="engineer")

    def test_required_headings_present(self):
        for h in [
            "### 1. System Snapshot",
            "### 2. Deterministic Coverage Index (DCI v1)",
            "### 3. Reporting Completeness Index (RCI)",
            "### 4. Structural Visibility (DCI v2)",
            "### 5. Epistemic Posture",
        ]:
            self.assertIn(h, self.md, f"Missing required heading: {h}")

    def test_anti_marketing_disclaimers(self):
        self.assertIn("does not measure code quality, security posture, or structural surface coverage", self.md)
        self.assertIn("not a security score", self.md)
        self.assertIn("reported as null rather than estimated", self.md)
        self.assertIn("no inference-based promotion from UNKNOWN to VERIFIED", self.md)

    def test_metrics_rendered(self):
        self.assertIn("88.24%", self.md)
        self.assertIn("50.08%", self.md)
        self.assertIn("not_implemented", self.md)

    def test_component_breakdown_present(self):
        self.assertIn("claims_coverage", self.md)
        self.assertIn("unknowns_coverage", self.md)
        self.assertIn("howto_completeness", self.md)

    def test_snapshot_table_present(self):
        self.assertIn("| Measure | Value |", self.md)
        self.assertIn("Files Analyzed", self.md)
        self.assertIn("Files Seen", self.md)
        self.assertIn("Files Skipped", self.md)
        self.assertIn("Claims Extracted", self.md)
        self.assertIn("Claims with Deterministic Evidence", self.md)
        self.assertIn("Partial Coverage", self.md)

    def test_tool_version_in_header(self):
        self.assertIn("**Tool Version:**", self.md)

    def test_run_id_in_audit_heading(self):
        run_id = self.pack.get("run_id", "")
        self.assertIn(f"## Repository Reconnaissance Contract Audit — Run {run_id}", self.md)

    def test_structural_buckets_in_report(self):
        self.assertIn("Verified Structural", self.md)
        self.assertIn("not_implemented", self.md)

    def test_unknowns_table_present(self):
        self.assertIn("Known Unknown Surface", self.md)
        self.assertIn("tls_termination", self.md)


class TestFailFastGuard(unittest.TestCase):
    def test_raises_if_pack_path_is_none(self):
        with self.assertRaises((RuntimeError, TypeError)):
            assert_pack_written(None)

    def test_raises_if_pack_file_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing = Path(tmp) / "evidence_pack.v1.json"
            with self.assertRaises(RuntimeError) as ctx:
                assert_pack_written(missing)
            self.assertIn("missing on disk", str(ctx.exception).lower())

    def test_raises_if_pack_dir_missing_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(RuntimeError):
                assert_pack_written(Path(tmp))

    def test_passes_if_pack_file_exists(self):
        with tempfile.TemporaryDirectory() as tmp:
            pack_file = Path(tmp) / "evidence_pack.v1.json"
            pack_file.write_text("{}")
            assert_pack_written(pack_file)

    def test_passes_if_pack_dir_has_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            pack_file = Path(tmp) / "evidence_pack.v1.json"
            pack_file.write_text("{}")
            assert_pack_written(Path(tmp))


if __name__ == "__main__":
    unittest.main()
