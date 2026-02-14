"""
Phase 3: Mode Rendering

Renders analysis reports from EvidencePack only.
Never re-reads extraction artifacts directly.

Modes:
  - engineer: Full file:line references, raw evidence, verbose
  - auditor: VERIFIED + UNKNOWN only, evidence anchors, no inferred narrative
  - executive: Metrics first (DCI), surface area summaries, no file:line clutter
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


def save_report(content: str, output_dir: Path, mode: str) -> Path:
    filename = f"REPORT_{mode.upper()}.md"
    path = output_dir / filename
    with open(path, "w") as f:
        f.write(content)
    return path


def _render_engineer(pack: Dict[str, Any]) -> str:
    lines = [
        f"# Program Totality Report — Engineer View",
        f"",
        f"**EvidencePack Version:** {pack.get('evidence_pack_version', '?')}",
        f"**Generated:** {pack.get('generated_at', '?')}",
        f"**Mode:** {pack.get('mode', '?')}",
        f"**Run ID:** {pack.get('run_id', '?')}",
        f"",
        "---",
        "",
    ]

    summary = pack.get("summary", {})
    lines.append("## Summary")
    lines.append("")
    lines.append(f"- Total files scanned: {summary.get('total_files', 0)}")
    lines.append(f"- Total claims: {summary.get('total_claims', 0)}")
    lines.append(f"- Verified claims: {summary.get('verified_claims', 0)}")
    lines.append(f"- Unknown categories: {summary.get('unknown_categories', 0)}")
    lines.append("")

    dci = pack.get("metrics", {}).get("dci", {})
    lines.append("## Deterministic Coverage Index (DCI)")
    lines.append("")
    lines.append(f"**Score:** {dci.get('score', 0):.2%}")
    lines.append(f"**Formula:** {dci.get('formula', 'N/A')}")
    components = dci.get("components", {})
    for k, v in components.items():
        lines.append(f"- {k}: {v:.2%}")
    lines.append(f"")
    lines.append(f"*{dci.get('interpretation', '')}*")
    lines.append("")

    lines.append("## Verified Routes")
    lines.append("")
    for route in pack.get("verified", {}).get("routes", []):
        lines.append(f"### {route.get('description', 'Route')}")
        lines.append(f"Confidence: {route.get('confidence', 0):.0%}")
        for ev in route.get("evidence", []):
            if isinstance(ev, dict):
                lines.append(f"- Evidence: `{ev.get('display', ev.get('path', '?'))}`  hash: `{ev.get('snippet_hash', '?')}`")
        lines.append("")

    lines.append("## Verified Dependencies")
    lines.append("")
    for dep in pack.get("verified", {}).get("dependencies", []):
        lines.append(f"- {dep.get('description', '?')} (confidence: {dep.get('confidence', 0):.0%})")
        for ev in dep.get("evidence", []):
            if isinstance(ev, dict):
                lines.append(f"  - `{ev.get('display', ev.get('path', '?'))}`")
    lines.append("")

    lines.append("## Verified Schemas")
    lines.append("")
    for schema in pack.get("verified", {}).get("schemas", []):
        lines.append(f"- {schema.get('description', '?')}")
        for ev in schema.get("evidence", []):
            if isinstance(ev, dict):
                lines.append(f"  - `{ev.get('display', ev.get('path', '?'))}`")
    lines.append("")

    lines.append("## Enforcement")
    lines.append("")
    for enf in pack.get("verified", {}).get("enforcement", []):
        lines.append(f"- {enf.get('description', '?')} (confidence: {enf.get('confidence', 0):.0%})")
        for ev in enf.get("evidence", []):
            if isinstance(ev, dict):
                lines.append(f"  - `{ev.get('display', ev.get('path', '?'))}`  hash: `{ev.get('snippet_hash', '?')}`")
    lines.append("")

    lines.append("## Known Unknown Surface")
    lines.append("")
    lines.append("| Category | Status | Notes |")
    lines.append("|----------|--------|-------|")
    for u in pack.get("unknowns", []):
        status = u.get("status", "UNKNOWN")
        marker = "VERIFIED" if status == "VERIFIED" else "UNKNOWN"
        lines.append(f"| {u.get('category', '?')} | {marker} | {u.get('notes', '')} |")
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
            e.get("display", "") for e in u.get("evidence", []) if isinstance(e, dict)
        ) or "—"
        lines.append(f"| {u.get('category', '?')} | **{status}** | {u.get('description', '')} | {ev_anchors} |")
    lines.append("")

    lines.append("## Verified Enforcement Claims")
    lines.append("")
    for enf in pack.get("verified", {}).get("enforcement", []):
        lines.append(f"- **{enf.get('description', '?')}**")
        lines.append(f"  Confidence: {enf.get('confidence', 0):.0%}")
        for ev in enf.get("evidence", []):
            if isinstance(ev, dict):
                lines.append(f"  - Evidence anchor: `{ev.get('display', '?')}` (hash: `{ev.get('snippet_hash', '?')}`)")
        lines.append("")

    lines.append("## Verified Routes (Evidence Anchors)")
    lines.append("")
    for route in pack.get("verified", {}).get("routes", []):
        anchors = ", ".join(
            f"`{e.get('display', '?')}`" for e in route.get("evidence", []) if isinstance(e, dict)
        )
        lines.append(f"- {route.get('description', '?')} — {anchors}")
    lines.append("")

    dci = pack.get("metrics", {}).get("dci", {})
    lines.append("## DCI Score")
    lines.append("")
    lines.append(f"**{dci.get('score', 0):.2%}** — {dci.get('interpretation', '')}")
    lines.append("")

    return "\n".join(lines)


def _render_executive(pack: Dict[str, Any]) -> str:
    summary = pack.get("summary", {})
    dci = pack.get("metrics", {}).get("dci", {})
    unknowns = pack.get("unknowns", [])
    unknown_count = len([u for u in unknowns if u.get("status") == "UNKNOWN"])
    verified_count = len([u for u in unknowns if u.get("status") == "VERIFIED"])

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
        f"| DCI Score | {dci.get('score', 0):.1%} |",
        f"| Files Scanned | {summary.get('total_files', 0)} |",
        f"| Total Claims | {summary.get('total_claims', 0)} |",
        f"| Verified Claims | {summary.get('verified_claims', 0)} |",
        f"| Unknown Categories | {unknown_count} / {len(unknowns)} |",
        f"| Verified Categories | {verified_count} / {len(unknowns)} |",
        "",
        f"*{dci.get('interpretation', '')}*",
        "",
        "## Coverage Breakdown",
        "",
    ]

    components = dci.get("components", {})
    for k, v in components.items():
        bar_filled = int(v * 20)
        bar = "#" * bar_filled + "-" * (20 - bar_filled)
        lines.append(f"- **{k}**: [{bar}] {v:.0%}")
    lines.append("")

    lines.append("## Surface Area")
    lines.append("")
    verified = pack.get("verified", {})
    lines.append(f"- Routes identified: {len(verified.get('routes', []))}")
    lines.append(f"- Dependencies tracked: {len(verified.get('dependencies', []))}")
    lines.append(f"- Schema elements: {len(verified.get('schemas', []))}")
    lines.append(f"- Enforcement controls: {len(verified.get('enforcement', []))}")
    lines.append("")

    if unknown_count > 0:
        lines.append("## Operational Blind Spots")
        lines.append("")
        lines.append("*INFERRED: The following categories lack deterministic evidence.*")
        lines.append("")
        for u in unknowns:
            if u.get("status") == "UNKNOWN":
                lines.append(f"- **{u.get('category', '?')}**: {u.get('description', '')}")
        lines.append("")

    return "\n".join(lines)
