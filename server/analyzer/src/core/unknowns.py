"""
Phase 1: Known Unknowns — Epistemic Transparency Layer

Declares categories of operational knowledge that PTA cannot verify
from static analysis alone. Each category defaults to UNKNOWN and
can only become VERIFIED if deterministic evidence exists in the
analyzed artifacts.

Verification policy:
  - A category is VERIFIED only when a claim's evidence explicitly
    references a configuration file or code path that directly proves
    the category (e.g., a TLS cert config file, not just a mention of "https").
  - Keyword matches in claim text alone are NOT sufficient.
  - snippet_hash_verified must be True on the evidence anchor.
  - The evidence file path must match a strict pattern for the category.

This is a post-processing layer. It does NOT modify extractors.
"""

from typing import Dict, Any, List, Optional
import re


KNOWN_UNKNOWN_CATEGORIES_V1 = [
    "tls_termination",
    "encryption_at_rest",
    "secret_management",
    "deployment_topology",
    "runtime_iam",
    "logging_sink",
    "monitoring_alerting",
    "backup_retention",
    "data_residency",
]

_CATEGORY_DESCRIPTIONS = {
    "tls_termination": "Whether TLS/SSL is terminated and how (reverse proxy, load balancer, application-level)",
    "encryption_at_rest": "Whether data at rest is encrypted (database, file storage, backups)",
    "secret_management": "How secrets/credentials are stored, rotated, and accessed at runtime",
    "deployment_topology": "Production deployment architecture (containers, VMs, serverless, regions)",
    "runtime_iam": "Identity and access management at runtime (service accounts, role-based access)",
    "logging_sink": "Where application and infrastructure logs are collected and retained",
    "monitoring_alerting": "Whether monitoring/alerting is configured (health checks, uptime, error rates)",
    "backup_retention": "Backup strategy, frequency, and retention policy for data stores",
    "data_residency": "Where data is physically stored and whether data residency requirements are met",
}

_CATEGORY_FILE_PATTERNS: Dict[str, List[re.Pattern]] = {
    "tls_termination": [
        re.compile(r"(ssl|tls|cert|https)", re.I),
        re.compile(r"nginx\.conf", re.I),
        re.compile(r"Caddyfile", re.I),
        re.compile(r"\.pem$|\.crt$|\.key$", re.I),
    ],
    "encryption_at_rest": [
        re.compile(r"encrypt", re.I),
        re.compile(r"kms|pgcrypto|luks", re.I),
    ],
    "secret_management": [
        re.compile(r"vault", re.I),
        re.compile(r"\.env\.example$|\.env\.template$", re.I),
        re.compile(r"secrets?\.(ya?ml|json|toml)$", re.I),
    ],
    "deployment_topology": [
        re.compile(r"[Dd]ockerfile$", re.I),
        re.compile(r"docker-compose", re.I),
        re.compile(r"k8s|kubernetes|helm", re.I),
        re.compile(r"terraform|\.tf$", re.I),
        re.compile(r"fly\.toml|railway\.json|Procfile", re.I),
    ],
    "runtime_iam": [
        re.compile(r"iam|rbac", re.I),
        re.compile(r"policy\.(ya?ml|json)$", re.I),
        re.compile(r"service[_-]?account", re.I),
    ],
    "logging_sink": [
        re.compile(r"logging\.(conf|config|ya?ml|json|ini)$", re.I),
        re.compile(r"winston|pino|bunyan|log4j", re.I),
        re.compile(r"fluentd|logstash", re.I),
    ],
    "monitoring_alerting": [
        re.compile(r"prometheus\.(ya?ml|json)$", re.I),
        re.compile(r"grafana", re.I),
        re.compile(r"alert(s|ing|manager)", re.I),
        re.compile(r"sentry\.(ya?ml|json|config)", re.I),
    ],
    "backup_retention": [
        re.compile(r"backup", re.I),
        re.compile(r"pg_dump|mysqldump|mongodump", re.I),
        re.compile(r"retention", re.I),
    ],
    "data_residency": [
        re.compile(r"residency|sovereignty", re.I),
        re.compile(r"gdpr", re.I),
        re.compile(r"data[_-]?location", re.I),
    ],
}


def compute_known_unknowns(
    howto: Dict[str, Any],
    claims: Dict[str, Any],
    coverage: Dict[str, Any],
    file_index: List[str],
) -> List[Dict[str, Any]]:
    """
    Post-processing hook: evaluate each known-unknown category against
    the existing extraction artifacts. Returns a list of category assessments.

    Verification requires BOTH:
      1. A claim with snippet_hash_verified evidence
      2. The evidence file path matching a strict pattern for the category

    This prevents incidental keyword matches from promoting UNKNOWN to VERIFIED.
    """
    claim_list = claims.get("claims", []) if isinstance(claims, dict) else []

    results = []
    for category in KNOWN_UNKNOWN_CATEGORIES_V1:
        status = "UNKNOWN"
        evidence_refs: List[Dict[str, Any]] = []
        notes = ""

        patterns = _CATEGORY_FILE_PATTERNS.get(category, [])
        matched_evidence = _find_verified_evidence_for_category(claim_list, patterns)

        if matched_evidence:
            status = "VERIFIED"
            evidence_refs = matched_evidence[:3]
            notes = f"Found {len(matched_evidence)} verified evidence anchor(s) with file paths matching category patterns"
        else:
            matched_files = _find_matching_files_strict(file_index, patterns)
            if matched_files:
                notes = f"Relevant config files detected ({', '.join(matched_files[:3])}) but no verified claim evidence anchored to them"
            else:
                notes = "No deterministic evidence found in extraction artifacts"

        results.append({
            "category": category,
            "description": _CATEGORY_DESCRIPTIONS.get(category, ""),
            "status": status,
            "evidence": evidence_refs,
            "notes": notes,
        })

    return results


def _find_verified_evidence_for_category(
    claims: List[Dict], patterns: List[re.Pattern]
) -> List[Dict[str, Any]]:
    """
    Find evidence anchors that are both snippet_hash_verified AND have a file
    path matching one of the category's strict patterns. This prevents a claim
    about "auth middleware" from verifying "tls_termination" just because
    both involve security.
    """
    matched = []
    for claim in claims:
        for ev in claim.get("evidence", []):
            if not isinstance(ev, dict):
                continue
            if not ev.get("snippet_hash_verified", False):
                continue
            path = ev.get("path", "")
            if _path_matches_patterns(path, patterns):
                matched.append(ev)
    return matched


def _path_matches_patterns(path: str, patterns: List[re.Pattern]) -> bool:
    for pat in patterns:
        if pat.search(path):
            return True
    return False


def _find_matching_files_strict(file_index: List[str], patterns: List[re.Pattern]) -> List[str]:
    matched = []
    for f in file_index:
        if _path_matches_patterns(f, patterns):
            matched.append(f)
    return matched
