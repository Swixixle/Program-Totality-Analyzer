# Regulatory Matrix Excerpt (Compliance Officer Quick Reference)

**Version:** 1.0 | **Last Updated:** 2026-02-12 | **Full Matrix:** [REGULATORY_ALIGNMENT.md](./REGULATORY_ALIGNMENT.md)

---

## 10-Row Compliance Scan

| # | Requirement | Framework | AI Receipts Capability | Status |
|---|-------------|-----------|----------------------|--------|
| 1 | Tamper-evident audit trail | 21 CFR 11.10(e), SOC 2 CC8.1 | SHA-256 hash chain with GENESIS anchor; any modification breaks the chain from that point forward | Implemented |
| 2 | Electronic signatures | 21 CFR 11.50, EU AI Act Art. 12 | Ed25519 signed checkpoints at configurable intervals; `kid` in every signature enables rotation | Implemented |
| 3 | Record integrity | 21 CFR 11.10(a), ISO 27001 A.12.4 | Immutable lock on verified receipts; offline verifier replays chain without DB access | Implemented |
| 4 | Traceability of AI decisions | EU AI Act Art. 12(1), NIST AI RMF GV 1.3 | Every operator action logged with timestamp, actor, IP, payload; 12 action types | Implemented |
| 5 | Change control / version stamping | 21 CFR 11.10(k)(2), SOC 2 CC8.1 | Semver + git commit embedded in every forensic pack and checkpoint | Implemented |
| 6 | Access controls | HIPAA 164.312(a), SOC 2 CC6.1 | API key authentication; rate limiting (burst + sustained) | Partial (RBAC needed) |
| 7 | Offline verification capability | SOC 2 CC7.2, ISO 27001 A.12.4 | Self-contained verifier runs with Node.js only; release zip includes compiled JS + public key | Implemented |
| 8 | Key management | NIST SP 800-57, SOC 2 CC6.1 | Key ring with kid rotation; environment classification (dev/staging/prod); HSM recommended for prod | Implemented |
| 9 | Data integrity monitoring | HIPAA 164.312(c)(2), ISO 27001 A.14.1 | Checkpoint chain continuity verification; forensic detectors for risk keywords + PII | Implemented |
| 10 | Transparency / documentation | EU AI Act Art. 13, NIST AI RMF MAP 1.1 | `proof_scope` / `proof_scope_excludes` explicitly state what is and is not proven | Implemented |

---

## What This System Does NOT Claim

- No certification readiness (this is a capabilities mapping, not a compliance certificate)
- No semantic truth verification (cryptographic integrity only)
- No RBAC or individual user authentication (API key-based currently)
- No automated retention/archival policies

---

## Recommended Next Steps for Compliance

| Priority | Action | Frameworks Addressed |
|----------|--------|---------------------|
| High | Implement RBAC with individual user accounts | 21 CFR Part 11, HIPAA, SOC 2 |
| High | Bind signatures to verified user identities | 21 CFR Part 11 (signature equivalence) |
| Medium | Configure retention policies with automated archival | 21 CFR Part 11, SOC 2 |
| Medium | Deploy external anchoring (S3 WORM or RFC 3161 TSA) | SOC 2, ISO 27001 |
| Low | Add Business Associate Agreement support | HIPAA |
