"""
Verification Policy — Single Source of Truth

Defines what it means for a claim to be VERIFIED in Repository Reconnaissance.
All modules (adapter, render, diff) must use this module
instead of implementing their own verification logic.

v1 Rule:
  A claim is VERIFIED iff at least one evidence item satisfies ALL of:
    1. snippet_hash is present (non-empty string)
    2. snippet_hash_verified == True
    3. the referenced file path is non-empty
    4. the referenced file path is NOT an RR-generated artifact

  This is the EVIDENCE_VERIFIED_HASH tier.

Circular evidence rule:
  Evidence refs pointing to RR-generated output files are REJECTED.
  Generated artifacts (dossier, claims, reports, evidence packs) are
  outputs, not source material. Citing them as evidence would create
  a self-referential loop that collapses the trust model.

Future tiers (not yet active):
  - EVIDENCE_VERIFIED_EXISTENCE: file_exists with verified=True
  These are tracked but do NOT elevate a claim to VERIFIED in v1.
"""

import os
from typing import Dict, Any, List


VERIFICATION_TIER_HASH = "EVIDENCE_VERIFIED_HASH"
VERIFICATION_TIER_EXISTENCE = "EVIDENCE_VERIFIED_EXISTENCE"

GENERATED_ARTIFACT_PATTERNS = {
    "evidence_pack.v1.json",
    "claims.json",
    "target_howto.json",
    "coverage.json",
    "replit_profile.json",
    "index.json",
    "DOSSIER.md",
    "REPORT_ENGINEER.md",
    "REPORT_AUDITOR.md",
    "REPORT_EXECUTIVE.md",
    "diff.json",
    "DIFF_REPORT.md",
}

GENERATED_DIR_MARKERS = {"packs/", "out/"}


def is_generated_artifact(path: str) -> bool:
    if not path:
        return False
    basename = os.path.basename(path)
    if basename in GENERATED_ARTIFACT_PATTERNS:
        return True
    if basename.startswith("REPORT_") and basename.endswith(".md"):
        return True
    normalized = path.replace("\\", "/")
    for marker in GENERATED_DIR_MARKERS:
        if normalized.startswith(marker) or f"/{marker}" in normalized:
            parts = normalized.split("/")
            tail = parts[-1] if parts else ""
            if tail in GENERATED_ARTIFACT_PATTERNS:
                return True
    return False


def evidence_tier(ev: dict) -> str:
    if not isinstance(ev, dict):
        return ""
    path = ev.get("path", "")
    if is_generated_artifact(path):
        return ""
    if (
        ev.get("snippet_hash")
        and ev.get("snippet_hash_verified") is True
        and path
    ):
        return VERIFICATION_TIER_HASH
    if ev.get("kind") == "file_exists" and ev.get("verified") is True:
        if not is_generated_artifact(path):
            return VERIFICATION_TIER_EXISTENCE
    return ""


def is_evidence_verified_v1(ev: dict) -> bool:
    return evidence_tier(ev) == VERIFICATION_TIER_HASH


def is_verified_claim(claim: dict) -> bool:
    for ev in claim.get("evidence", []):
        if is_evidence_verified_v1(ev):
            return True
    return False


def get_verified_evidence(claim: dict) -> List[dict]:
    return [ev for ev in claim.get("evidence", []) if is_evidence_verified_v1(ev)]
