# Known Limitations and Non-Goals

> **Red Team Notes - Version 1.0**

## Core Non-Goals

This system explicitly does NOT attempt to:

### 1. Verify Truth
- **Non-goal:** Determine if statements in transcripts are factually correct
- **Reason:** LLMs can hallucinate; transcripts may contain false information
- **Mitigation:** `proof_scope_excludes: ["truth"]` explicitly declared

### 2. Detect Fabrication
- **Non-goal:** Detect if a transcript was entirely fabricated
- **Reason:** A valid signature only proves the key holder signed it
- **Mitigation:** Key registry tracks issuer reputation, but not content validity

### 3. Prove Completeness
- **Non-goal:** Guarantee transcripts are complete conversations
- **Reason:** Capture agents may truncate or omit messages
- **Mitigation:** `proof_scope_excludes: ["completeness"]` explicitly declared

### 4. Attribute Intent
- **Non-goal:** Determine why a conversation happened
- **Reason:** User prompts may be adversarial; context is unknowable
- **Mitigation:** `proof_scope_excludes: ["authorship_intent"]` explicitly declared

---

## Known Limitations

### L1: Pre-Signature Tampering
- **Limitation:** Cannot detect tampering before signature was applied
- **Impact:** Malicious capture agents could modify before signing
- **Mitigation:** Key registry issuer reputation; UNTRUSTED_ISSUER status

### L2: Key Compromise
- **Limitation:** Cannot detect if a private key was compromised
- **Impact:** Attacker with key could sign arbitrary content
- **Mitigation:** Key revocation support; REVOKED status blocks validation

### L3: Sybil Issuers
- **Limitation:** Anyone can claim to be an "issuer"
- **Impact:** Multiple fake issuers could flood the registry
- **Mitigation:** UNTRUSTED_ISSUER status for unknown issuers

### L4: Timing Attacks
- **Limitation:** `captured_at` is self-reported by capture agent
- **Impact:** Cannot independently verify timestamp accuracy
- **Mitigation:** Chain verification provides relative ordering only

### L5: LLM Observation Reliability
- **Limitation:** LLM observations are model-generated, not facts
- **Impact:** Different models may disagree; all observations are uncertain
- **Mitigation:** Language hygiene enforces hedging; no reconciliation

### L6: Research Data Re-identification
- **Limitation:** Bucketed stats may be linkable with external data
- **Impact:** Sufficiently unique patterns might be re-identifiable
- **Mitigation:** Opt-in consent; aggregation thresholds; no exact timestamps

---

## Threat Mitigations Implemented (P7)

| Threat ID | Threat | Control |
|-----------|--------|---------|
| T1 | Receipt Spoofing/Replay | Ed25519 signature + hash verification |
| T2 | Chain Manipulation | Chain hash verification + BROKEN status |
| T3 | Key Misuse | Key governance (REVOKED/EXPIRED) |
| T4 | Proof Pack Confusion | proof_scope + proof_scope_excludes |
| T5 | PII Injection | PII heuristics (counts only, never values) |
| T6 | Prompt Injection | Non-blocking detection + flagging |
| T7 | Resource Exhaustion | Request size limits + rate limiting |
| T8 | Rate Limit Evasion | Per-IP tracking + burst limits |
| T9 | Error Oracle Leakage | Canonical error codes + redacted details |
| T10 | Endpoint Enumeration | Deterministic error responses |
| T11 | Data Correlation Risk | Hashed IPs + redacted receipt IDs in logs |

---

## Assumptions

1. **Cryptographic primitives are secure:** SHA-256 and Ed25519 are sound
2. **Key registry is authoritative:** Keys must be registered to be trusted
3. **Rate limits are sufficient:** Current limits prevent abuse
4. **LLMs are treated as unreliable:** All observations require hedging

---

## Reporting Security Issues

If you discover a security vulnerability not covered here, please contact the maintainers with:
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact assessment
4. Suggested mitigation (if any)
