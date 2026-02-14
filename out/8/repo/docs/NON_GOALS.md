# AI Receipts: Non-Goals & Boundaries

**Version**: 0.2.0  
**Last updated**: 2026-02-12

---

## What This System Does

AI Receipts provides **cryptographic integrity verification** for AI conversation
transcripts. It answers one question definitively:

> "Has this transcript been altered since it was recorded?"

It does this through SHA-256 hash chains, Ed25519 signed checkpoints, tamper-evident
audit trails, and external anchoring to independent trust boundaries.

---

## What This System Does NOT Do

### 1. Truth Judgments

AI Receipts **never** evaluates whether an AI's output is factually correct,
ethically sound, or appropriate. Verification status (PASS/FAIL) refers exclusively
to data integrity, not semantic truth.

- A receipt marked PASS means the transcript has not been tampered with.
- A receipt marked PASS says nothing about whether the AI's responses were accurate.
- The system does not, and will never, claim to verify the "correctness" of AI behavior.

### 2. AI Model Evaluation

This system does not benchmark, score, or rank AI models. It does not compare
model outputs, measure hallucination rates, or assess model quality. LLM sensor
observations describe content characteristics (tone, ambiguity, paraphrase) without
making quality judgments.

### 3. Content Moderation

AI Receipts does not filter, flag, or block AI-generated content. Forensic detectors
(risk keywords, entropy analysis, PII heuristics) generate integrity context for
forensic analysis, not content moderation decisions. Detection of sensitive patterns
does not trigger any automated action.

### 4. Real-Time Monitoring

The system is designed for post-hoc forensic analysis, not real-time streaming
verification. While events are logged as they occur, the verification model assumes
offline replay of hash chains. Real-time alerting, dashboards, or streaming
verification are outside scope.

### 5. Access Control / Authorization

AI Receipts uses API key authentication for endpoint protection but does not
implement user identity management, role-based access control, or multi-tenant
isolation. It is an operator-facing tool, not an end-user platform.

### 6. Data Storage / Backup

The system provides immutable append-only logs but is not a backup solution.
It does not replicate data across regions, manage disaster recovery, or provide
point-in-time restore capabilities beyond what the underlying PostgreSQL database
offers.

### 7. Legal Compliance Certification

While the REGULATORY_ALIGNMENT.md document maps capabilities to regulatory
frameworks (21 CFR Part 11, HIPAA, SOC 2, etc.), the system itself does not
certify compliance. Organizations must independently assess how AI Receipts
fits within their compliance programs.

### 8. Blockchain / Distributed Ledger

The hash chain and checkpoint system may resemble blockchain patterns, but
AI Receipts is a centralized, single-operator system. It does not use
distributed consensus, proof-of-work/stake, or decentralized validation.
External anchoring (S3 WORM, RFC3161 TSA) provides independent trust
boundaries without decentralization.

---

## Boundary Conditions

### Kill Switch Scope

The kill switch disables **interpretation** of a receipt. It does not delete the
receipt, remove it from the hash chain, or affect checkpoint integrity. Kill-switched
receipts remain in the chain and are still verifiable; only their interpretations
are blocked.

### Immutability Guarantees

Immutability applies to verified receipts stored in the system. The system cannot
prevent modifications to data before it enters the system (pre-ingestion tampering)
or to copies exported outside the system (post-export tampering). Forensic packs
include pack hashes to detect post-export modification.

### Anchoring Trust Model

External anchors (S3 WORM, RFC3161 TSA) provide independent timestamps and
tamper evidence, but their trust depends on the anchor provider's integrity.
Log-only anchoring provides no external trust boundary. The system clearly labels
each anchor type and its trust implications.

### Cryptographic Assumptions

The system's integrity guarantees depend on the security of SHA-256 and Ed25519.
The CRYPTO_AGILITY.md document outlines the migration path to post-quantum
cryptography (ML-DSA) when standardized. Current guarantees are valid for the
expected security lifetime of these algorithms.

### Single-Operator Model

AI Receipts assumes a single trusted operator. It protects against post-hoc
tampering (someone modifying records after the fact) but does not protect against
a malicious operator who controls the signing keys and could forge records from
the start. External anchoring partially mitigates this by providing independent
timestamps.

---

## Design Philosophy

1. **Prove integrity, never truth.** Cryptographic verification establishes
   tamper-evidence, not semantic correctness.

2. **Append-only, never delete.** The audit trail only grows. Kill switches
   disable interpretation without removing evidence.

3. **Offline-first verification.** Any third party can verify a forensic pack
   without database access, network connectivity, or trust in the operator.

4. **Explicit trust boundaries.** Every verification result states exactly what
   was checked and what assumptions it depends on.

5. **No silent failures.** Verification either passes or fails with a specific
   sequence number and reason. Degraded states are surfaced, not hidden.
