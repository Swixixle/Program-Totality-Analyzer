"""
Phase 2: EvidencePack Adapter

Assembles existing extraction outputs into a stable EvidencePack v1
contract for governance features. Does NOT modify original artifacts.

Verification policy:
  - Delegated entirely to verify_policy.is_verified_claim().
  - Claims are grouped by their original extractor-assigned section.
  - No keyword reclassification or inference is performed.

All downstream rendering and diff operations consume this pack only.
"""

import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from .verify_policy import is_verified_claim, get_verified_evidence


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

    Only claims passing verify_policy.is_verified_claim() are included.
    Claims are grouped by their extractor-assigned section.
    """
    verified_claims = _get_verified_claims(claims)

    pack: Dict[str, Any] = {
        "evidence_pack_version": EVIDENCE_PACK_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "run_id": run_id,
        "verified": _group_by_section(verified_claims),
        "verified_structural": _build_verified_structural(verified_claims, howto, file_index),
        "unknowns": known_unknowns,
        "metrics": _build_metrics(howto, claims, known_unknowns, coverage),
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
    Return only claims that pass verify_policy.is_verified_claim().
    This is the only way a claim enters the EvidencePack's verified section.
    """
    result = []
    for claim in _get_claims_list(claims):
        if is_verified_claim(claim):
            result.append({
                "id": claim.get("id", ""),
                "statement": claim.get("statement", ""),
                "section": claim.get("section", ""),
                "evidence": get_verified_evidence(claim),
                "confidence": claim.get("confidence", 0),
            })
    return result


def _group_by_section(verified_claims: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Group verified claims by their extractor-assigned section.
    No reclassification — sections are used as-is from the extractor.
    """
    groups: Dict[str, List[Dict[str, Any]]] = {}
    for claim in verified_claims:
        section = claim.get("section", "uncategorized")
        if section not in groups:
            groups[section] = []
        groups[section].append(claim)
    return groups


def _build_verified_structural(
    verified_claims: List[Dict[str, Any]],
    howto: Dict[str, Any],
    file_index: List[str],
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Best-effort structural namespace for governance-grade surface mapping.
    Populates routes/dependencies/schemas/enforcement from existing
    deterministic outputs ONLY. Never infers — if no evidence, returns [].

    This is an optional, forward-looking namespace. v1 consumers should
    treat it as best-effort.
    """
    import re

    structural: Dict[str, List[Dict[str, Any]]] = {
        "routes": [],
        "dependencies": [],
        "schemas": [],
        "enforcement": [],
    }

    dep_patterns = re.compile(
        r"dependenc|package\.json|requirements\.txt|pyproject\.toml|cargo\.toml|go\.mod|gemfile",
        re.I,
    )
    schema_patterns = re.compile(
        r"schema|migration|model|drizzle|prisma|sequelize|typeorm|alembic|\.sql$",
        re.I,
    )
    route_patterns = re.compile(
        r"route|endpoint|api|controller|handler|router",
        re.I,
    )
    enforcement_patterns = re.compile(
        r"auth|permission|rbac|acl|guard|middleware|policy|validator",
        re.I,
    )

    for claim in verified_claims:
        statement_lower = claim.get("statement", "").lower()
        evidence = claim.get("evidence", [])

        placed = False
        for ev in evidence:
            path = ev.get("path", "").lower() if isinstance(ev, dict) else ""

            if dep_patterns.search(path) or dep_patterns.search(statement_lower):
                structural["dependencies"].append(claim)
                placed = True
                break
            if schema_patterns.search(path):
                structural["schemas"].append(claim)
                placed = True
                break
            if route_patterns.search(path):
                structural["routes"].append(claim)
                placed = True
                break
            if enforcement_patterns.search(path):
                structural["enforcement"].append(claim)
                placed = True
                break

        if not placed:
            if route_patterns.search(statement_lower):
                structural["routes"].append(claim)
            elif schema_patterns.search(statement_lower):
                structural["schemas"].append(claim)
            elif enforcement_patterns.search(statement_lower):
                structural["enforcement"].append(claim)

    install_steps = howto.get("install_steps", [])
    if isinstance(install_steps, list):
        for step in install_steps:
            if not isinstance(step, dict):
                continue
            ev = step.get("evidence")
            if isinstance(ev, dict) and ev.get("snippet_hash_verified") is True and ev.get("snippet_hash") and ev.get("path"):
                cmd = step.get("command", "")
                if cmd and ("install" in cmd.lower() or "pip" in cmd.lower() or "npm" in cmd.lower()):
                    structural["dependencies"].append({
                        "id": f"howto_install_{len(structural['dependencies'])}",
                        "statement": step.get("description", cmd),
                        "section": "howto:install_steps",
                        "evidence": [ev],
                        "confidence": 0.5,
                    })

    schema_files = [
        f for f in file_index
        if schema_patterns.search(f)
    ]
    for sf in schema_files[:5]:
        already = any(
            any(e.get("path", "") == sf for e in c.get("evidence", []) if isinstance(e, dict))
            for c in structural["schemas"]
        )
        if not already:
            structural["schemas"].append({
                "id": f"structural_schema_file_{sf}",
                "statement": f"Schema/migration file detected: {sf}",
                "section": "structural:file_index",
                "evidence": [{"path": sf, "kind": "file_exists_index", "note": "from file index, not claim evidence"}],
                "confidence": 0.3,
            })

    return structural


def _build_metrics(
    howto: Dict[str, Any],
    claims: Dict[str, Any],
    known_unknowns: List[Dict[str, Any]],
    coverage: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Build metrics namespace with clear separation:
      - rci: Reporting Completeness Index (composite maturity)
      - dci_v1_claims_visibility: claims-only visibility ratio
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

    rci_score = round((claims_coverage + unknowns_coverage + howto_coverage) / 3.0, 4)

    return {
        "rci": {
            "score": rci_score,
            "label": "Reporting Completeness Index",
            "formula": "average(claims_coverage, unknowns_coverage, howto_completeness)",
            "components": {
                "claims_coverage": round(claims_coverage, 4),
                "unknowns_coverage": round(unknowns_coverage, 4),
                "howto_completeness": round(howto_coverage, 4),
            },
            "interpretation": "Composite completeness of PTA reporting. NOT a security or structural visibility score.",
        },
        "dci_v1_claims_visibility": {
            "score": round(claims_coverage, 4),
            "label": "DCI v1 — Claims Visibility",
            "formula": "verified_claims / total_claims",
            "interpretation": "Percent of claims with deterministic hash-verified evidence. Structural DCI (routes/deps/schemas/enforcement) planned for v2.",
        },
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
