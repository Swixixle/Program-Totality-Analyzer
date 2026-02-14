"""
Verification Policy — Single Source of Truth

Defines what it means for a claim to be VERIFIED in PTA.
All modules (adapter, render, diff) must use this module
instead of implementing their own verification logic.

v1 Rule:
  A claim is VERIFIED iff at least one evidence item satisfies ALL of:
    1. snippet_hash is present (non-empty string)
    2. snippet_hash_verified == True
    3. the referenced file path is non-empty

  This is the EVIDENCE_VERIFIED_HASH tier.

Future tiers (not yet active):
  - EVIDENCE_VERIFIED_EXISTENCE: file_exists with verified=True
  These are tracked but do NOT elevate a claim to VERIFIED in v1.
"""

from typing import Dict, Any, List


VERIFICATION_TIER_HASH = "EVIDENCE_VERIFIED_HASH"
VERIFICATION_TIER_EXISTENCE = "EVIDENCE_VERIFIED_EXISTENCE"


def evidence_tier(ev: dict) -> str:
    """
    Classify a single evidence anchor into a verification tier.
    Returns the tier name or empty string if unverifiable.
    """
    if not isinstance(ev, dict):
        return ""
    if (
        ev.get("snippet_hash")
        and ev.get("snippet_hash_verified") is True
        and ev.get("path")
    ):
        return VERIFICATION_TIER_HASH
    if ev.get("kind") == "file_exists" and ev.get("verified") is True:
        return VERIFICATION_TIER_EXISTENCE
    return ""


def is_evidence_verified_v1(ev: dict) -> bool:
    """
    v1 verification: only EVIDENCE_VERIFIED_HASH qualifies.
    """
    return evidence_tier(ev) == VERIFICATION_TIER_HASH


def is_verified_claim(claim: dict) -> bool:
    """
    A claim is VERIFIED iff at least one evidence item passes
    is_evidence_verified_v1.

    This is the ONLY function that should be used to decide
    whether a claim enters the 'verified' section of EvidencePack.
    """
    for ev in claim.get("evidence", []):
        if is_evidence_verified_v1(ev):
            return True
    return False


def get_verified_evidence(claim: dict) -> List[dict]:
    """
    Return only the evidence items that pass v1 verification.
    """
    return [ev for ev in claim.get("evidence", []) if is_evidence_verified_v1(ev)]
