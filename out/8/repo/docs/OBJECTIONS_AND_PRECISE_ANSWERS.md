# Objections and Precise Answers

**Audience**: General Counsel, CMO, CISO, investor, compliance officer  
**Read time**: 3 minutes  
**Version**: 0.2.0

---

### "Does this prove the AI model was correct?"

**No.** This system proves what happened -- that a specific conversation transcript was recorded, has not been modified since recording, and can be independently verified. It makes no judgment about whether the AI's output was factually correct, helpful, or appropriate. It is a tamper-evident record, not a truth oracle.

---

### "Can a database administrator still rewrite the audit trail?"

**Without external anchoring**: A DB superuser who also controls the signing key could rewrite the chain and re-sign it. The rewritten chain would pass internal verification.

**With external anchoring (S3 Object Lock + TSA)**: The original checkpoint hashes are stored in AWS S3 with Object Lock and timestamped by a third-party TSA. A DB rewrite produces different hashes that do not match the external records. The attacker would need to compromise four independent systems (database, signing key, S3 account, and TSA provider) to forge a chain undetectably.

---

### "What happens when signing keys rotate?"

Each checkpoint records the key identifier (`kid`) used to sign it. The offline verifier accepts a key ring directory containing multiple keys, matching each checkpoint's `kid` to the correct key file. The `--strict-kid` flag prevents the verifier from guessing which key to use -- it either finds an exact match or fails explicitly. Key rotation does not invalidate existing checkpoints.

---

### "What if the external anchoring service is down?"

Two modes are available:

- **`--anchors=optional`** (default): Proof generation succeeds even if anchors are unavailable. The verifier reports "LOG-ONLY" in the verdict, making the gap visible.
- **`--anchors=required`**: Proof generation hard-fails if external anchors are not configured or not available. This prevents accidental production deployments without external trust boundaries.

The system never silently degrades. Every proof pack explicitly states its anchoring status.

---

### "Can we validate a proof pack without database access?"

**Yes.** The offline verifier replays the hash chain, verifies checkpoint signatures, and validates anchor bindings using only the exported pack file and the public key (or key ring). No database connection, no network access, no external dependencies. The verifier ships as a self-contained zip.

---

### "What does the system store? Is there PII risk?"

The system stores audit events (who did what, when) and cryptographic hashes. AI conversation transcripts are processed for forensic analysis but the system does not persist raw transcripts in the audit trail. Research data is anonymized with explicit opt-in consent. PII detection heuristics flag sensitive content. The kill switch irreversibly blocks all interpretation of a receipt, and bulk exports redact kill-switched content.

---

### "How do we know the verifier itself hasn't been tampered with?"

The verifier release zip is:

1. **Deterministically built** -- CI rebuilds it twice and compares SHA-256 hashes
2. **Signed with Sigstore Cosign** -- Keyless OIDC signatures verifiable via public transparency log
3. **Accompanied by an SBOM** -- CycloneDX 1.5 bill of materials documenting zero external dependencies
4. **Checksummed** -- SHA-256 hashes published alongside every release

---

### "Is this compliant with [regulation X]?"

The system's capabilities map to requirements in:

- **21 CFR Part 11** (electronic records/signatures)
- **HIPAA** (audit controls, integrity, access controls)
- **SOC 2** (security, availability, processing integrity)
- **ISO 27001** (information security management)
- **EU AI Act** (transparency, traceability)
- **NIST AI RMF** (governance, accountability)

See [REGULATORY_ALIGNMENT.md](./REGULATORY_ALIGNMENT.md) for the full mapping and [REGULATORY_MATRIX_EXCERPT.md](./REGULATORY_MATRIX_EXCERPT.md) for a 10-row quick reference.

---

### "What doesn't this system do?"

Explicit non-goals (see [NON_GOALS.md](./NON_GOALS.md)):

- No truth judgments about AI output
- No content moderation or filtering
- No real-time monitoring or alerting
- No multi-tenant / multi-operator model
- No transcript storage (display semantics only)

---

### "How does this compare to [existing tool X]?"

See [COMPETITIVE_COMPARISON.md](./COMPETITIVE_COMPARISON.md) for positioning against AI observability platforms, immutable databases, and governance tools. The key differentiator is cryptographic proof of integrity with offline verification -- not dashboards, not analytics, not monitoring.
