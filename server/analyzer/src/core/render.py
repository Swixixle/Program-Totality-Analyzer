"""
Phase 3: Mode Rendering

Renders analysis reports from EvidencePack only.
Never re-reads extraction artifacts directly.
Never re-runs extraction or analysis.

Uses verify_policy for any verification checks.

Modes:
  - engineer: Full file:line references, raw evidence, verbose
  - auditor: VERIFIED + UNKNOWN only, evidence anchors, no inferred narrative
  - executive: Metrics first (RCI + DCI), surface area summaries, no file:line clutter
"""

from typing import Dict, Any, List
from pathlib import Path


def render_report(pack: Dict[str, Any], mode: str = "engineer") -> str:
    if mode == "engineer":
        return _render_engineer(pack)
    elif mode == "auditor":
        return _render_auditor(pack)
    elif mode == "executive":
        return _render_executive(pack)
    else:
        return _render_engineer(pack)


def assert_pack_written(pack_path: Path) -> None:
    if pack_path is None:
        raise RuntimeError("save_evidence_pack() returned None; refusing to render report")
    if pack_path.is_dir():
        expected_file = pack_path / "evidence_pack.v1.json"
    else:
        expected_file = pack_path
    if not expected_file.exists() or not expected_file.is_file():
        raise RuntimeError(
            f"Evidence pack missing on disk: expected {expected_file}. "
            "Refusing to render report to prevent silent partial output."
        )


def save_report(content: str, output_dir: Path, mode: str) -> Path:
    filename = f"REPORT_{mode.upper()}.md"
    path = output_dir / filename
    with open(path, "w") as f:
        f.write(content)
    return path


def _render_evidence_anchor(ev: dict) -> str:
    display = ev.get("display", ev.get("path", "?"))
    snippet_hash = ev.get("snippet_hash", "")
    if snippet_hash:
        return f"`{display}` (hash: `{snippet_hash}`)"
    return f"`{display}`"


def _get_verified_sections(pack: Dict[str, Any]) -> Dict[str, List[Dict]]:
    verified = pack.get("verified", {})
    if isinstance(verified, dict):
        return verified
    return {}


def _count_verified_claims(pack: Dict[str, Any]) -> int:
    total = 0
    for section_claims in _get_verified_sections(pack).values():
        if isinstance(section_claims, list):
            total += len(section_claims)
    return total


def _get_rci(pack: Dict[str, Any]) -> Dict[str, Any]:
    return pack.get("metrics", {}).get("rci_reporting_completeness", {})


def _get_dci(pack: Dict[str, Any]) -> Dict[str, Any]:
    return pack.get("metrics", {}).get("dci_v1_claim_visibility", {})


def _get_dci_v2(pack: Dict[str, Any]) -> Dict[str, Any]:
    return pack.get("metrics", {}).get("dci_v2_structural_visibility", {})


def _render_engineer(pack: Dict[str, Any]) -> str:
    lines = [
        f"# Program Totality Report — Engineer View",
        f"",
        f"**EvidencePack Version:** {pack.get('evidence_pack_version', '?')}",
        f"**Tool Version:** {pack.get('tool_version', '?')}",
        f"**Generated:** {pack.get('generated_at', '?')}",
        f"**Mode:** {pack.get('mode', '?')}",
        f"**Run ID:** {pack.get('run_id', '?')}",
        f"",
        "---",
        "",
    ]

    summary = pack.get("summary", {})
    dci = _get_dci(pack)
    dci_v2 = _get_dci_v2(pack)
    rci = _get_rci(pack)
    components = rci.get("components", {})

    lines.append(f"## PTA Contract Audit — Run {pack.get('run_id', '?')}")
    lines.append("")
    cov = pack.get("coverage", {})

    lines.append("### 1. System Snapshot")
    lines.append("")
    lines.append(f"| Measure | Value |")
    lines.append(f"|---------|-------|")
    lines.append(f"| Files Analyzed | {cov.get('analyzed_files', summary.get('total_files', 0))} |")
    lines.append(f"| Files Seen (incl. skipped) | {cov.get('total_files_seen', summary.get('total_files', 0))} |")
    lines.append(f"| Files Skipped | {cov.get('skipped_files', 0)} |")
    lines.append(f"| Claims Extracted | {summary.get('total_claims', 0)} |")
    lines.append(f"| Claims with Deterministic Evidence | {summary.get('verified_claims', 0)} |")
    lines.append(f"| Unknown Governance Categories | {summary.get('unknown_categories', 0)} |")
    lines.append(f"| Verified Structural Categories | {summary.get('verified_categories', 0)} |")
    lines.append(f"| Partial Coverage | {'Yes' if cov.get('partial', False) else 'No'} |")
    lines.append("")

    lines.append("### 2. Deterministic Coverage Index (DCI v1)")
    lines.append("")
    dci_score = dci.get('score', 0) or 0
    lines.append(f"**Score:** {dci_score:.2%}")
    lines.append(f"**Formula:** `{dci.get('formula', 'N/A')}`")
    lines.append("")
    lines.append(f"{summary.get('verified_claims', 0)} of {summary.get('total_claims', 0)} extracted claims contain hash-verified evidence.")
    lines.append("")
    lines.append("This measures claim-to-evidence visibility only.")
    lines.append("It does not measure code quality, security posture, or structural surface coverage.")
    lines.append("")

    lines.append("### 3. Reporting Completeness Index (RCI)")
    lines.append("")
    rci_score = rci.get('score', 0) or 0
    lines.append(f"**Score:** {rci_score:.2%}")
    lines.append(f"**Formula:** `{rci.get('formula', 'N/A')}`")
    lines.append("")
    lines.append("| Component | Score |")
    lines.append("|-----------|-------|")
    for k, v in components.items():
        lines.append(f"| {k} | {v:.2%} |")
    lines.append("")
    lines.append("RCI is a documentation completeness metric.")
    lines.append("It is not a security score and does not imply structural sufficiency.")
    lines.append("")

    lines.append("### 4. Structural Visibility (DCI v2)")
    lines.append("")
    lines.append(f"**Status:** {dci_v2.get('status', 'not_implemented')}")
    lines.append(f"**Formula (reserved):** `{dci_v2.get('formula', 'N/A')}`")
    lines.append("")
    lines.append("Routes, dependencies, schemas, and enforcement extractors are not active.")
    lines.append("Structural surface visibility is intentionally reported as null rather than estimated.")
    lines.append("This prevents silent overstatement of governance posture.")
    lines.append("")

    lines.append("### 5. Epistemic Posture")
    lines.append("")
    lines.append("PTA explicitly reports:")
    lines.append("- What is deterministically verified.")
    lines.append("- What is unknown.")
    lines.append("- What is not implemented.")
    lines.append("- What requires dedicated extractors.")
    lines.append("")
    lines.append("There is no inference-based promotion from UNKNOWN to VERIFIED.")
    lines.append("")

    lines.append("---")
    lines.append("")

    verified_sections = _get_verified_sections(pack)
    for section_name, claims in sorted(verified_sections.items()):
        lines.append(f"## Verified: {section_name}")
        lines.append("")
        if not isinstance(claims, list) or not claims:
            lines.append("No verified claims in this section.")
            lines.append("")
            continue
        for claim in claims:
            lines.append(f"### {claim.get('statement', '?')}")
            lines.append(f"Confidence: {claim.get('confidence', 0):.0%}")
            for ev in claim.get("evidence", []):
                if isinstance(ev, dict):
                    lines.append(f"- Evidence: {_render_evidence_anchor(ev)}")
            lines.append("")

    structural = pack.get("verified_structural", {})
    has_structural = any(v for k, v in structural.items() if k != "_notes" and isinstance(v, list) and v)
    structural_notes = structural.get("_notes", {})

    lines.append("## Verified Structural (deterministic extractors only)")
    lines.append("")
    if has_structural:
        for bucket, items in sorted(structural.items()):
            if bucket == "_notes" or not isinstance(items, list) or not items:
                continue
            lines.append(f"### {bucket}")
            lines.append("")
            for item in items:
                lines.append(f"- {item.get('statement', '?')}")
                src = item.get("source", "")
                if src:
                    lines.append(f"  Source: `{src}`")
            lines.append("")
    for bucket, note in sorted(structural_notes.items()) if isinstance(structural_notes, dict) else []:
        lines.append(f"- **{bucket}**: {note}")
    if structural_notes:
        lines.append("")

    lines.append("## Known Unknown Surface")
    lines.append("")
    lines.append("| Category | Status | Notes |")
    lines.append("|----------|--------|-------|")
    for u in pack.get("unknowns", []):
        status = u.get("status", "UNKNOWN")
        lines.append(f"| {u.get('category', '?')} | {status} | {u.get('notes', '')} |")
    lines.append("")

    hashes = pack.get("hashes", {}).get("snippets", [])
    lines.append(f"## Snippet Hashes ({len(hashes)} total)")
    lines.append("")
    for h in hashes[:20]:
        lines.append(f"- `{h}`")
    if len(hashes) > 20:
        lines.append(f"- ... and {len(hashes) - 20} more")
    lines.append("")

    return "\n".join(lines)


def _render_auditor(pack: Dict[str, Any]) -> str:
    lines = [
        f"# Program Totality Report — Auditor View",
        f"",
        f"**EvidencePack Version:** {pack.get('evidence_pack_version', '?')}",
        f"**Generated:** {pack.get('generated_at', '?')}",
        f"",
        "This report shows only VERIFIED and UNKNOWN findings.",
        "No inferred narrative is included.",
        "",
        "---",
        "",
    ]

    lines.append("## Known Unknown Surface")
    lines.append("")
    lines.append("| Category | Status | Description | Evidence Anchors |")
    lines.append("|----------|--------|-------------|------------------|")
    for u in pack.get("unknowns", []):
        status = u.get("status", "UNKNOWN")
        ev_anchors = ", ".join(
            _render_evidence_anchor(e) for e in u.get("evidence", []) if isinstance(e, dict)
        ) or "—"
        lines.append(f"| {u.get('category', '?')} | **{status}** | {u.get('description', '')} | {ev_anchors} |")
    lines.append("")

    verified_sections = _get_verified_sections(pack)
    for section_name, claims in sorted(verified_sections.items()):
        if not isinstance(claims, list) or not claims:
            continue
        lines.append(f"## Verified: {section_name}")
        lines.append("")
        for claim in claims:
            lines.append(f"- **{claim.get('statement', '?')}**")
            lines.append(f"  Confidence: {claim.get('confidence', 0):.0%}")
            for ev in claim.get("evidence", []):
                if isinstance(ev, dict):
                    lines.append(f"  - Evidence anchor: {_render_evidence_anchor(ev)}")
            lines.append("")

    dci = _get_dci(pack)
    dci_v2 = _get_dci_v2(pack)
    rci = _get_rci(pack)
    lines.append("## DCI_v1_claim_visibility")
    lines.append("")
    lines.append(f"**{dci.get('score', 0):.2%}** — {dci.get('interpretation', '')}")
    lines.append("")
    lines.append("## DCI_v2_structural_visibility")
    lines.append("")
    lines.append(f"**Status:** {dci_v2.get('status', 'not_implemented')} — {dci_v2.get('interpretation', '')}")
    lines.append("")
    lines.append("## RCI_reporting_completeness")
    lines.append("")
    lines.append(f"**{rci.get('score', 0):.2%}** — {rci.get('interpretation', '')}")
    lines.append("")

    return "\n".join(lines)


def _render_executive(pack: Dict[str, Any]) -> str:
    summary = pack.get("summary", {})
    dci = _get_dci(pack)
    rci = _get_rci(pack)
    unknowns = pack.get("unknowns", [])
    unknown_count = len([u for u in unknowns if u.get("status") == "UNKNOWN"])
    verified_cat_count = len([u for u in unknowns if u.get("status") == "VERIFIED"])

    dci_v2 = _get_dci_v2(pack)

    lines = [
        f"# Program Totality Report — Executive Summary",
        f"",
        f"**Generated:** {pack.get('generated_at', '?')}",
        f"",
        "---",
        "",
        "## Key Metrics",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| DCI_v1_claim_visibility | {dci.get('score', 0):.1%} |",
        f"| DCI_v2_structural_visibility | {dci_v2.get('status', 'not_implemented')} |",
        f"| RCI_reporting_completeness | {rci.get('score', 0):.1%} |",
        f"| Files Scanned | {summary.get('total_files', 0)} |",
        f"| Total Claims | {summary.get('total_claims', 0)} |",
        f"| Verified Claims | {summary.get('verified_claims', 0)} |",
        f"| Unknown Categories | {unknown_count} / {len(unknowns)} |",
        f"| Verified Categories | {verified_cat_count} / {len(unknowns)} |",
        "",
        f"*DCI_v1_claim_visibility: {dci.get('interpretation', '')}*",
        f"*DCI_v2_structural_visibility: {dci_v2.get('interpretation', '')}*",
        f"*RCI_reporting_completeness: {rci.get('interpretation', '')}*",
        "",
        "## RCI Coverage Breakdown",
        "",
    ]

    components = rci.get("components", {})
    for k, v in components.items():
        bar_filled = int(v * 20)
        bar = "#" * bar_filled + "-" * (20 - bar_filled)
        lines.append(f"- **{k}**: [{bar}] {v:.0%}")
    lines.append("")

    lines.append("## Verified Surface Area")
    lines.append("")
    verified_sections = _get_verified_sections(pack)
    if verified_sections:
        for section_name, claims in sorted(verified_sections.items()):
            count = len(claims) if isinstance(claims, list) else 0
            lines.append(f"- {section_name}: {count} verified claim(s)")
    else:
        lines.append("- No verified claims with deterministic evidence.")
    lines.append("")

    if unknown_count > 0:
        lines.append("## Operational Blind Spots")
        lines.append("")
        lines.append("*The following categories lack deterministic evidence.*")
        lines.append("")
        for u in unknowns:
            if u.get("status") == "UNKNOWN":
                lines.append(f"- **{u.get('category', '?')}**: {u.get('description', '')}")
        lines.append("")

    return "\n".join(lines)
