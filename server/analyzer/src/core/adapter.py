"""
Phase 2: EvidencePack Adapter

Assembles existing extraction outputs into a stable EvidencePack v1
contract for governance features. Does NOT modify original artifacts.

Verification policy:
  - Only claims with snippet_hash_verified evidence are included in
    the "verified" sections.
  - Keyword matching in claim text is NOT used for classification.
  - Claims without verified evidence anchors are excluded from the pack.
  - Run commands and prerequisites without verified evidence are excluded.

All downstream rendering and diff operations consume this pack only.
"""

import json
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone


EVIDENCE_PACK_VERSION = "1.0"


def build_evidence_pack(
    howto: Dict[str, Any],
    claims: Dict[str, Any],
    coverage: Dict[str, Any],
    file_index: List[str],
    known_unknowns: List[Dict[str, Any]],
    replit_profile: Optional[Dict[str, Any]] = None,
    mode: str = "github",
    run_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Build an EvidencePack v1 from existing analyzer outputs.
    This is a pure post-processing function — it reads but never modifies
    the original extraction artifacts.

    Only claims with snippet_hash_verified evidence anchors are promoted
    to the verified sections. Everything else is excluded to prevent
    inflating the verified artifact count.
    """
    verified_claims = _get_verified_claims(claims)

    pack: Dict[str, Any] = {
        "evidence_pack_version": EVIDENCE_PACK_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "run_id": run_id,
        "verified": {
            "routes": _extract_verified_by_section(verified_claims, "routes"),
            "dependencies": _extract_verified_by_section(verified_claims, "dependencies"),
            "schemas": _extract_verified_by_section(verified_claims, "schemas"),
            "enforcement": _extract_verified_by_section(verified_claims, "enforcement"),
        },
        "unknowns": known_unknowns,
        "metrics": {
            "dci": _compute_dci(howto, claims, known_unknowns, coverage),
        },
        "hashes": {
            "snippets": _collect_snippet_hashes(claims, howto),
        },
        "summary": {
            "total_files": len(file_index),
            "total_claims": len(_get_claims_list(claims)),
            "verified_claims": len(verified_claims),
            "unknown_categories": len([
                u for u in known_unknowns
                if u.get("status") == "UNKNOWN"
            ]),
            "verified_categories": len([
                u for u in known_unknowns
                if u.get("status") == "VERIFIED"
            ]),
        },
    }

    if replit_profile:
        pack["replit_profile"] = {
            "is_replit": replit_profile.get("is_replit", False),
            "run_command": replit_profile.get("run_command"),
            "language": replit_profile.get("language"),
            "port": replit_profile.get("port_binding", {}).get("port") if isinstance(replit_profile.get("port_binding"), dict) else None,
        }

    return pack


def save_evidence_pack(pack: Dict[str, Any], output_dir: Path) -> Path:
    path = output_dir / "evidence_pack.v1.json"
    with open(path, "w") as f:
        json.dump(pack, f, indent=2, default=str)
    return path


def load_evidence_pack(path: Path) -> Dict[str, Any]:
    with open(path) as f:
        return json.load(f)


def _get_claims_list(claims: Dict[str, Any]) -> List[Dict]:
    if isinstance(claims, dict):
        return claims.get("claims", [])
    return []


def _get_verified_claims(claims: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Return only claims that have at least one evidence anchor with
    snippet_hash_verified=True. This is the only way a claim enters
    the EvidencePack's verified sections.
    """
    result = []
    for claim in _get_claims_list(claims):
        verified_evidence = []
        for ev in claim.get("evidence", []):
            if isinstance(ev, dict) and ev.get("snippet_hash_verified", False):
                verified_evidence.append(ev)
        if verified_evidence:
            result.append({
                "statement": claim.get("statement", ""),
                "section": claim.get("section", ""),
                "evidence": verified_evidence,
                "confidence": claim.get("confidence", 0),
            })
    return result


def _extract_verified_by_section(
    verified_claims: List[Dict[str, Any]], section: str
) -> List[Dict[str, Any]]:
    """
    Filter verified claims by their declared section (as set by the extractor).
    Only uses the section field, never keyword matching on statement text.
    """
    return [
        c for c in verified_claims
        if c.get("section", "").lower() == section.lower()
    ]


def _compute_dci(
    howto: Dict[str, Any],
    claims: Dict[str, Any],
    known_unknowns: List[Dict[str, Any]],
    coverage: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Deterministic Coverage Index — a visibility metric, NOT a security score.

    Lower DCI = lower visibility, NOT insecure.

    Straight average across coverage classes:
      - claims_coverage: ratio of evidenced claims (snippet_hash_verified)
      - unknowns_coverage: ratio of VERIFIED unknown categories
      - howto_completeness: from existing completeness score
    """
    claim_list = _get_claims_list(claims)
    total_claims = len(claim_list)
    verified_count = len(_get_verified_claims(claims))
    claims_coverage = (verified_count / total_claims) if total_claims > 0 else 0.0

    total_categories = len(known_unknowns)
    verified_categories = len([u for u in known_unknowns if u.get("status") == "VERIFIED"])
    unknowns_coverage = (verified_categories / total_categories) if total_categories > 0 else 0.0

    completeness = howto.get("completeness", {})
    howto_score = completeness.get("score", 0) if isinstance(completeness, dict) else 0
    howto_max = completeness.get("max", 100) if isinstance(completeness, dict) else 100
    howto_coverage = (howto_score / howto_max) if howto_max > 0 else 0.0

    dci_score = round((claims_coverage + unknowns_coverage + howto_coverage) / 3.0, 4)

    return {
        "score": dci_score,
        "formula": "average(claims_coverage, unknowns_coverage, howto_completeness)",
        "components": {
            "claims_coverage": round(claims_coverage, 4),
            "unknowns_coverage": round(unknowns_coverage, 4),
            "howto_completeness": round(howto_coverage, 4),
        },
        "interpretation": "Lower DCI = lower visibility into the system. This is NOT a security score.",
    }


def _collect_snippet_hashes(claims: Dict[str, Any], howto: Dict[str, Any]) -> List[str]:
    hashes = set()

    for claim in _get_claims_list(claims):
        for ev in claim.get("evidence", []):
            if isinstance(ev, dict):
                h = ev.get("snippet_hash", "")
                if h:
                    hashes.add(h)

    for section in ["install_steps", "config", "run_dev", "run_prod", "verification_steps", "common_failures"]:
        items = howto.get(section, [])
        if isinstance(items, dict):
            items = [items]
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict):
                    ev = item.get("evidence")
                    if isinstance(ev, dict) and ev.get("snippet_hash"):
                        hashes.add(ev["snippet_hash"])
                    elif isinstance(ev, list):
                        for e in ev:
                            if isinstance(e, dict) and e.get("snippet_hash"):
                                hashes.add(e["snippet_hash"])

    return sorted(hashes)
