"""
Phase 1: Known Unknowns — Epistemic Transparency Layer

Declares categories of operational knowledge that PTA cannot verify
from static analysis alone. Each category defaults to UNKNOWN and
can only become VERIFIED if deterministic evidence exists in the
analyzed artifacts.

Verification policy (deterministic upgrade rules):
  - A category can ONLY move from UNKNOWN to VERIFIED when an exact
    known infrastructure/config artifact is found AND a claim with
    snippet_hash_verified evidence is anchored to a file matching
    that artifact.
  - Each upgrade rule specifies an exact file name or path pattern
    that constitutes definitive proof for the category.
  - Keyword matches in claim text are NOT sufficient.
  - File-index presence alone is NOT sufficient — must have a claim
    with snippet_hash_verified evidence anchored to that file.

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

_CATEGORY_RESOLVE_WITH = {
    "tls_termination": "Add TLS config: k8s Ingress with tls section, nginx.conf with ssl_certificate, Caddyfile with tls directive, or Terraform aws_acm_certificate resource",
    "encryption_at_rest": "Add encryption config: Terraform aws_db_instance with storage_encrypted=true, k8s StorageClass with encrypted parameters, or pgcrypto extension usage",
    "secret_management": "Add secret management: k8s ExternalSecret/SealedSecret manifests, Vault agent config, or Terraform vault_generic_secret resources",
    "deployment_topology": "Add deployment artifacts: Dockerfile, docker-compose.yml, k8s Deployment manifests, Terraform main.tf, Helm Chart.yaml, or fly.toml",
    "runtime_iam": "Add IAM config: k8s ServiceAccount/RBAC manifests, Terraform aws_iam_role resources, or OPA policy files",
    "logging_sink": "Add logging config: Fluentd/Logstash config files, k8s logging sidecar manifests, or Terraform CloudWatch log group resources",
    "monitoring_alerting": "Add monitoring config: Prometheus rules YAML, Grafana dashboard JSON, k8s ServiceMonitor manifests, Terraform CloudWatch alarm resources, or Sentry config",
    "backup_retention": "Add backup config: Terraform aws_backup_plan resources, k8s CronJob backup manifests, or pg_dump/mongodump cron scripts with retention",
    "data_residency": "Add residency config: Terraform provider region constraints, k8s node affinity with topology labels, or documented data residency policy",
}


_UPGRADE_RULES: Dict[str, List[Dict[str, Any]]] = {
    "tls_termination": [
        {
            "artifact": "k8s Ingress with TLS",
            "file_exact": re.compile(r"(^|/)ingress\.(ya?ml|json)$", re.I),
            "content_probe": "tls",
        },
        {
            "artifact": "Terraform ACM certificate",
            "file_exact": re.compile(r"\.tf$"),
            "content_probe": "aws_acm_certificate",
        },
        {
            "artifact": "Caddyfile with TLS",
            "file_exact": re.compile(r"(^|/)Caddyfile$"),
            "content_probe": None,
        },
        {
            "artifact": "nginx SSL config",
            "file_exact": re.compile(r"(^|/)nginx\.conf$", re.I),
            "content_probe": "ssl_certificate",
        },
    ],
    "encryption_at_rest": [
        {
            "artifact": "Terraform aws_db_instance with storage_encrypted",
            "file_exact": re.compile(r"\.tf$"),
            "content_probe": "storage_encrypted",
        },
        {
            "artifact": "Terraform aws_rds_cluster with storage_encrypted",
            "file_exact": re.compile(r"\.tf$"),
            "content_probe": "storage_encrypted",
        },
        {
            "artifact": "k8s StorageClass with encryption",
            "file_exact": re.compile(r"(^|/)storageclass\.(ya?ml|json)$", re.I),
            "content_probe": "encrypted",
        },
    ],
    "secret_management": [
        {
            "artifact": "k8s ExternalSecret manifest",
            "file_exact": re.compile(r"(^|/)externalsecret[s]?\.(ya?ml|json)$", re.I),
            "content_probe": None,
        },
        {
            "artifact": "k8s SealedSecret manifest",
            "file_exact": re.compile(r"(^|/)sealedsecret[s]?\.(ya?ml|json)$", re.I),
            "content_probe": None,
        },
        {
            "artifact": "Terraform vault_generic_secret",
            "file_exact": re.compile(r"\.tf$"),
            "content_probe": "vault_generic_secret",
        },
        {
            "artifact": "Vault agent config",
            "file_exact": re.compile(r"(^|/)vault-agent\.(hcl|json)$", re.I),
            "content_probe": None,
        },
    ],
    "deployment_topology": [
        {
            "artifact": "Dockerfile",
            "file_exact": re.compile(r"(^|/)Dockerfile$"),
            "content_probe": None,
        },
        {
            "artifact": "docker-compose.yml",
            "file_exact": re.compile(r"(^|/)docker-compose\.(ya?ml)$", re.I),
            "content_probe": None,
        },
        {
            "artifact": "k8s Deployment manifest",
            "file_exact": re.compile(r"(^|/)deployment\.(ya?ml|json)$", re.I),
            "content_probe": None,
        },
        {
            "artifact": "Terraform main.tf",
            "file_exact": re.compile(r"(^|/)main\.tf$"),
            "content_probe": None,
        },
        {
            "artifact": "Helm Chart.yaml",
            "file_exact": re.compile(r"(^|/)Chart\.yaml$"),
            "content_probe": None,
        },
        {
            "artifact": "fly.toml",
            "file_exact": re.compile(r"(^|/)fly\.toml$"),
            "content_probe": None,
        },
        {
            "artifact": "Procfile",
            "file_exact": re.compile(r"(^|/)Procfile$"),
            "content_probe": None,
        },
    ],
    "runtime_iam": [
        {
            "artifact": "k8s ServiceAccount manifest",
            "file_exact": re.compile(r"(^|/)serviceaccount\.(ya?ml|json)$", re.I),
            "content_probe": None,
        },
        {
            "artifact": "k8s RBAC manifest",
            "file_exact": re.compile(r"(^|/)(cluster)?role(binding)?\.(ya?ml|json)$", re.I),
            "content_probe": None,
        },
        {
            "artifact": "Terraform IAM role",
            "file_exact": re.compile(r"\.tf$"),
            "content_probe": "aws_iam_role",
        },
        {
            "artifact": "OPA policy",
            "file_exact": re.compile(r"\.rego$"),
            "content_probe": None,
        },
    ],
    "logging_sink": [
        {
            "artifact": "Fluentd config",
            "file_exact": re.compile(r"(^|/)fluent(d|bit)\.(conf|ya?ml)$", re.I),
            "content_probe": None,
        },
        {
            "artifact": "Logstash config",
            "file_exact": re.compile(r"(^|/)logstash\.(conf|ya?ml)$", re.I),
            "content_probe": None,
        },
        {
            "artifact": "Terraform CloudWatch log group",
            "file_exact": re.compile(r"\.tf$"),
            "content_probe": "aws_cloudwatch_log_group",
        },
    ],
    "monitoring_alerting": [
        {
            "artifact": "Prometheus rules",
            "file_exact": re.compile(r"(^|/)prometheus\.(ya?ml|rules)$", re.I),
            "content_probe": None,
        },
        {
            "artifact": "k8s ServiceMonitor",
            "file_exact": re.compile(r"(^|/)servicemonitor\.(ya?ml|json)$", re.I),
            "content_probe": None,
        },
        {
            "artifact": "Grafana dashboard",
            "file_exact": re.compile(r"(^|/).*grafana.*\.(json)$", re.I),
            "content_probe": None,
        },
        {
            "artifact": "Terraform CloudWatch alarm",
            "file_exact": re.compile(r"\.tf$"),
            "content_probe": "aws_cloudwatch_metric_alarm",
        },
        {
            "artifact": "Sentry config",
            "file_exact": re.compile(r"(^|/)\.sentryclirc$|sentry\.(ya?ml|json|properties)$", re.I),
            "content_probe": None,
        },
    ],
    "backup_retention": [
        {
            "artifact": "Terraform backup plan",
            "file_exact": re.compile(r"\.tf$"),
            "content_probe": "aws_backup_plan",
        },
        {
            "artifact": "k8s CronJob backup",
            "file_exact": re.compile(r"(^|/)cronjob\.(ya?ml|json)$", re.I),
            "content_probe": "backup",
        },
    ],
    "data_residency": [
        {
            "artifact": "Terraform provider region constraint",
            "file_exact": re.compile(r"\.tf$"),
            "content_probe": "region",
        },
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

    Upgrade rules fire ONLY when:
      1. A claim has snippet_hash_verified evidence
      2. The evidence file path matches an exact known artifact pattern
      3. If a content_probe is specified, the claim statement must also
         reference the probe term (proving the artifact contains the
         specific config, not just matching by filename)

    If no upgrade rule fires, the category remains UNKNOWN with a
    "resolve_with" hint explaining what artifacts would satisfy it.
    """
    claim_list = claims.get("claims", []) if isinstance(claims, dict) else []

    results = []
    for category in KNOWN_UNKNOWN_CATEGORIES_V1:
        status = "UNKNOWN"
        evidence_refs: List[Dict[str, Any]] = []
        notes = ""

        rules = _UPGRADE_RULES.get(category, [])
        matched = _try_upgrade_rules(claim_list, rules)

        if matched:
            status = "VERIFIED"
            evidence_refs = [m["evidence"] for m in matched[:3]]
            artifact_names = [m["artifact"] for m in matched[:3]]
            notes = f"Verified via: {', '.join(artifact_names)}"
        else:
            artifact_files = _find_artifact_files_in_index(file_index, rules)
            if artifact_files:
                notes = (
                    f"Candidate artifact files found ({', '.join(artifact_files[:3])}) "
                    f"but no claim with snippet_hash_verified evidence anchored to them"
                )
            else:
                notes = "No deterministic evidence found in extraction artifacts"

        results.append({
            "category": category,
            "description": _CATEGORY_DESCRIPTIONS.get(category, ""),
            "status": status,
            "evidence": evidence_refs,
            "notes": notes,
            "resolve_with": _CATEGORY_RESOLVE_WITH.get(category, ""),
        })

    return results


def _try_upgrade_rules(
    claims: List[Dict], rules: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Try each upgrade rule against all claims. A rule fires when:
      - A claim has at least one evidence anchor with snippet_hash_verified=True
      - That evidence anchor's file path matches the rule's file_exact pattern
      - If the rule has a content_probe, the claim statement must contain
        that probe term (case-insensitive)

    Returns list of dicts with "artifact" and "evidence" for each match.
    """
    matched = []
    for rule in rules:
        file_pattern = rule["file_exact"]
        content_probe = rule.get("content_probe")

        for claim in claims:
            if content_probe:
                stmt = claim.get("statement", "")
                if content_probe.lower() not in stmt.lower():
                    continue

            for ev in claim.get("evidence", []):
                if not isinstance(ev, dict):
                    continue
                if not ev.get("snippet_hash_verified", False):
                    continue
                if not ev.get("snippet_hash"):
                    continue
                path = ev.get("path", "")
                if file_pattern.search(path):
                    matched.append({
                        "artifact": rule["artifact"],
                        "evidence": ev,
                    })
                    break
    return matched


def _find_artifact_files_in_index(
    file_index: List[str], rules: List[Dict[str, Any]]
) -> List[str]:
    """
    Check if any files in the index match upgrade rule patterns.
    This is used for advisory notes only — it does NOT promote to VERIFIED.
    """
    matched = []
    seen = set()
    for rule in rules:
        for f in file_index:
            if f in seen:
                continue
            if rule["file_exact"].search(f):
                matched.append(f)
                seen.add(f)
    return matched
