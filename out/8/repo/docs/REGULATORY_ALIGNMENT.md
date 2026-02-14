# Regulatory Alignment Matrix

Version: 1.0
Last Updated: 2026-02-12

This document maps AI Receipts forensic verification capabilities to regulatory frameworks. It describes how system features address specific compliance requirements without claiming full certification readiness.

---

## Alignment Summary

| Framework | Relevance | Coverage Level | Notes |
|-----------|-----------|----------------|-------|
| 21 CFR Part 11 | High | Partial | Electronic records, audit trails, signatures |
| HIPAA | Medium | Supportive | Integrity controls for PHI-adjacent data |
| SOC 2 Type II | High | Strong | Security, availability, processing integrity |
| ISO 27001 | High | Strong | Information security management controls |
| EU AI Act | High | Strong | Transparency, traceability, accountability |
| NIST AI RMF | Medium | Partial | Risk management, governance documentation |

---

## 21 CFR Part 11 (Electronic Records and Signatures)

FDA regulation governing electronic records and electronic signatures.

| Requirement | Section | AI Receipts Capability | Gap |
|-------------|---------|----------------------|-----|
| Audit trail with timestamps | 11.10(e) | Append-only audit log with ISO 8601 timestamps, per-event SHA-256 hash chain | None |
| Record integrity | 11.10(a) | SHA-256 hash chain with GENESIS anchor, immutable lock on verified receipts | None |
| Signed records | 11.50 | Ed25519 signed checkpoints at configurable intervals | Electronic signatures require additional identity binding |
| Authority checks | 11.10(d) | API key authentication, requireAuth middleware on private endpoints | Role-based access control not yet implemented |
| Record retention | 11.10(c) | PostgreSQL persistent storage, forensic export packs for offline archival | Retention policy configuration not yet implemented |
| Operational checks | 11.10(f) | Kill switch mechanism, interpretation guards, payload validation | None |
| Change control | 11.10(k)(2) | Version stamping (semver + commit hash), CI drift guards | None |

### Recommendations
- Implement role-based access control (RBAC) with individual user accounts
- Add configurable retention policies with automated archival
- Bind Ed25519 signatures to verified user identities for Part 11 signature equivalence

---

## HIPAA (Health Insurance Portability and Accountability Act)

Applies when AI receipts contain or reference protected health information (PHI).

| Requirement | HIPAA Section | AI Receipts Capability | Gap |
|-------------|--------------|----------------------|-----|
| Access controls | 164.312(a) | API key authentication, rate limiting | Individual user authentication needed |
| Audit controls | 164.312(b) | Complete audit trail with 12 action types, IP/user-agent logging | None |
| Integrity controls | 164.312(c) | SHA-256 hash chain, immutable lock, Ed25519 checkpoints | None |
| Transmission security | 164.312(e) | HTTPS enforced via deployment platform | Application-layer encryption at rest not implemented |
| Person authentication | 164.312(d) | API key-based | Multi-factor authentication not implemented |

### Recommendations
- Implement encryption at rest for stored receipts containing PHI
- Add individual user authentication with MFA support
- Implement PII detection in forensic detectors to flag PHI before storage
- Document data flow diagrams for PHI-adjacent receipt content

---

## SOC 2 Type II (Trust Service Criteria)

AICPA framework for security, availability, processing integrity, confidentiality, and privacy.

| Trust Criteria | Requirement | AI Receipts Capability | Gap |
|---------------|-------------|----------------------|-----|
| CC6.1 | Logical access security | API key auth, rate limiting, security headers | Role granularity limited |
| CC6.2 | Access provisioning | API key management | Key rotation automation not implemented |
| CC7.1 | System monitoring | Health endpoints, readiness checks, instrumentation counters | External alerting integration needed |
| CC7.2 | Anomaly detection | Forensic detectors (risk keywords, entropy, PII), LLM sensors | None |
| CC8.1 | Change management | Version stamping, CI/CD gates, canonicalization drift guard | None |
| PI1.1 | Processing integrity | SHA-256 hash chain, deterministic canonicalization, offline verification | None |
| PI1.2 | Error detection | Chain break detection, checkpoint verification, tamper-evident share packs | None |
| PI1.3 | Completeness monitoring | Audit head tracking, cursor-based segment verification | None |

### Recommendations
- Implement automated key rotation schedules
- Add external alerting integration for health/readiness degradation
- Document incident response procedures for chain break detection

---

## ISO 27001 (Information Security Management)

International standard for information security management systems (ISMS).

| Control | Description | AI Receipts Capability | Gap |
|---------|-------------|----------------------|-----|
| A.8.1 | Asset management | Version stamping, system inventory via engineId | None |
| A.8.9 | Configuration management | CI drift guards, deterministic canonicalization | None |
| A.8.15 | Logging | 12 audit action types, structured JSON logging, IP/user-agent capture | None |
| A.8.16 | Monitoring | Health/readiness endpoints, instrumentation counters | External SIEM integration needed |
| A.8.24 | Cryptography use | SHA-256 hashing, Ed25519 signatures, documented crypto agility roadmap | None |
| A.8.25 | Secure development | TypeScript strict mode, Zod validation, CI typecheck/test gates | None |
| A.8.28 | Secure coding | Input validation, rate limiting, security headers, prompt injection detection | None |

### Recommendations
- Integrate structured logs with external SIEM/log aggregation
- Implement formal access review procedures
- Document risk assessment methodology aligned with ISO 27005

---

## EU AI Act (Regulation 2024/1689)

European regulation establishing harmonized rules on artificial intelligence.

| Requirement | Article | AI Receipts Capability | Gap |
|-------------|---------|----------------------|-----|
| Traceability | Art. 12 | SHA-256 hash chain, append-only audit trail, version stamping | None |
| Transparency | Art. 13 | LLM sensor observations (paraphrase, ambiguity, tone) without truth claims | None |
| Record-keeping | Art. 12(2) | Immutable storage, forensic export packs, offline verification | Retention period configuration needed |
| Human oversight | Art. 14 | Kill switch mechanism, interpretation system with FACT/INTERPRETATION/UNCERTAINTY categories | None |
| Accuracy/robustness | Art. 15 | Cryptographic verification, deterministic canonicalization, golden tests | None |
| Risk management | Art. 9 | Threat model documentation, forensic detectors, PII heuristics | Formal risk assessment procedures needed |
| Technical documentation | Art. 11 | THREAT_MODEL.md, FORENSIC_EXPORT_PACK.md, CRYPTO_AGILITY.md, REGULATORY_ALIGNMENT.md | None |

### Recommendations
- Implement configurable log retention periods aligned with Art. 12(2) requirements
- Document formal risk assessment procedures per Art. 9
- Add data subject access request (DSAR) support for GDPR alignment

---

## NIST AI Risk Management Framework (AI RMF 1.0)

Voluntary framework for managing AI system risks.

| Function | Category | AI Receipts Capability | Gap |
|----------|----------|----------------------|-----|
| GOVERN | Accountability | Audit trail, operator action logging, governance page | Organizational policies not in scope |
| MAP | Context analysis | Forensic detectors, LLM sensor pipeline | None |
| MEASURE | Risk metrics | Instrumentation counters, health metrics, chain verification | Quantitative risk scoring not implemented |
| MANAGE | Risk response | Kill switch, interpretation guards, rate limiting | Automated risk escalation not implemented |

### Recommendations
- Implement quantitative risk scoring for detected anomalies
- Add automated escalation workflows for high-risk detections

---

## Cross-Cutting Capabilities

These features support multiple regulatory frameworks simultaneously:

| Capability | Frameworks Served | Implementation |
|-----------|-------------------|----------------|
| SHA-256 hash chain | All | Deterministic canonicalization + chained hashing |
| Ed25519 signed checkpoints | 21 CFR 11, SOC 2, ISO 27001 | Automatic checkpoint creation every N events |
| Append-only audit trail | All | 12 action types with IP, user-agent, JSON payload |
| Forensic export packs | All | v1.2 format with events, checkpoints, anchor receipts, version info |
| Offline verification | SOC 2, ISO 27001, EU AI Act | Standalone script with no database dependency |
| Kill switch | 21 CFR 11, EU AI Act, NIST AI RMF | Irreversible interpretation blocking |
| Version stamping | 21 CFR 11, SOC 2, ISO 27001 | semver + git commit in all forensic artifacts |
| Security headers | HIPAA, SOC 2, ISO 27001 | X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy |
| Rate limiting | HIPAA, SOC 2 | Per-IP burst and sustained limits |
| CI drift guards | SOC 2, ISO 27001 | Canonicalization and boundary drift detection |

---

## Disclaimer

This document describes how AI Receipts system capabilities align with regulatory requirements. It does not constitute legal advice or certification. Organizations deploying this system must conduct their own compliance assessments with qualified legal and compliance professionals. The alignment mappings reflect the system's technical capabilities as of the document version date and may require updates as regulations evolve.
