# AI Receipts: Competitive Landscape

**Version**: 0.2.0  
**Last updated**: 2026-02-12

---

## Category Definition

AI Receipts occupies the intersection of **AI governance tooling** and
**cryptographic audit infrastructure**. The closest comparisons fall into
three categories:

1. AI observability platforms (monitoring AI model behavior)
2. Audit log / tamper-evidence systems (securing event records)
3. AI governance / compliance frameworks (policy and documentation)

No existing product combines all three in a single forensic verification
system with offline-verifiable cryptographic proofs.

---

## Comparison Matrix

| Capability | AI Receipts | AI Observability (e.g. Langfuse, Helicone) | Audit/Immutable Logs (e.g. Immudb, Amazon QLDB) | AI Governance (e.g. Credo AI, IBM OpenPages) |
|---|---|---|---|---|
| SHA-256 hash chain | Yes (c14n-v1 canonical) | No | Yes (varies) | No |
| Ed25519 signed checkpoints | Yes (with chain continuity) | No | No (DB-level integrity) | No |
| Offline verification | Yes (standalone verifier) | No | No (DB-dependent) | No |
| External anchoring (S3 WORM, TSA) | Yes (dual anchor) | No | Partial (DB-native) | No |
| Forensic export packs | Yes (self-contained JSON) | Partial (data export) | Partial (query-based) | No |
| LLM content observation | Yes (non-judgmental sensors) | Yes (evals, scoring) | No | Partial (policy checks) |
| Kill switch (irreversible) | Yes | No | No | No |
| Append-only interpretations | Yes (FACT/INTERPRETATION/UNCERTAINTY) | No | No | No |
| Regulatory alignment mapping | Yes (6 frameworks) | No | Partial (SOC 2) | Yes (primary focus) |
| Key rotation with proof | Yes (key ring + playbooks) | N/A | Partial | N/A |
| Tamper detection + evidence | Yes (bit-level mutation) | No | Yes (DB-level) | No |
| Post-quantum migration path | Documented (ML-DSA) | N/A | No | No |
| Open proof bundle format | Yes (CI-generated, signed) | No | No | No |

---

## Detailed Comparisons

### vs. AI Observability Platforms (Langfuse, Helicone, Weights & Biases)

**What they do well**: Real-time monitoring of LLM calls, token usage tracking,
prompt/response logging, latency metrics, A/B testing of prompts, cost tracking.

**Where AI Receipts differs**:

- Observability platforms trust their own database. AI Receipts produces
  cryptographic proofs that a third party can verify without trusting anyone.
- Observability platforms evaluate output quality (scoring, evals). AI Receipts
  explicitly avoids truth judgments, providing integrity verification only.
- Observability platforms are designed for developers optimizing AI systems.
  AI Receipts is designed for operators who need to prove records were not altered.
- No observability platform produces a standalone artifact that can be independently
  verified years later without access to the original system.

**Complementary**: AI Receipts can ingest transcripts logged by observability
platforms and provide the cryptographic integrity layer they lack.

### vs. Immutable Database Systems (Amazon QLDB, Immudb)

**What they do well**: Append-only ledgers with cryptographic verification,
SQL query interfaces, built-in tamper detection, managed infrastructure.

**Where AI Receipts differs**:

- QLDB/Immudb verification requires access to the running database. AI Receipts
  verification is fully offline with a standalone binary.
- These systems provide generic immutable storage. AI Receipts adds domain-specific
  features: interpretation taxonomy, kill switches, LLM sensors, forensic detectors.
- External anchoring to S3 WORM and RFC3161 TSA provides trust boundaries independent
  of the database provider. QLDB's trust boundary is Amazon itself.
- AI Receipts publishes signed proof bundles through CI with reproducibility gates
  and Sigstore signing. Database systems don't produce distributable proof artifacts.

**Complementary**: AI Receipts could use QLDB or Immudb as its storage backend
while adding the AI-specific forensic layer on top.

### vs. AI Governance Platforms (Credo AI, IBM OpenPages, Holistic AI)

**What they do well**: Policy management, risk assessment frameworks, bias
detection, model documentation, compliance workflow automation, stakeholder
reporting.

**Where AI Receipts differs**:

- Governance platforms focus on policy and process. AI Receipts focuses on
  cryptographic evidence that policies were followed.
- Governance platforms produce reports and dashboards. AI Receipts produces
  verifiable proof artifacts.
- Governance platforms require trust in the platform. AI Receipts proofs are
  independently verifiable.
- AI Receipts does not compete on policy management, risk scoring, or bias
  detection. It provides the tamper-evident evidence layer that governance
  frameworks can reference.

**Complementary**: Governance platforms define what should happen. AI Receipts
proves what did happen, with cryptographic evidence that the record was not
altered.

---

## Unique Positioning

AI Receipts is the only system that combines:

1. **Cryptographic hash chain** with deterministic canonicalization (not just
   database-level integrity)
2. **Signed checkpoints** with chain continuity and key rotation support
3. **Offline-verifiable proof bundles** that work without any network access
4. **External dual anchoring** to independent trust boundaries
5. **AI-domain-specific forensics** (LLM sensors, interpretation taxonomy,
   kill switches) that generic audit systems lack
6. **Non-judgmental design** that proves integrity without claiming truth

The competitive moat is the combination: no single competitor addresses the
full stack from cryptographic primitives through AI-specific forensic features
to regulatory alignment documentation.

---

## Target Audience Contrast

| Audience | Typical Tool | AI Receipts |
|---|---|---|
| ML Engineer optimizing prompts | Langfuse, Helicone | Not primary audience |
| Compliance Officer documenting controls | Credo AI, IBM OpenPages | Uses AI Receipts proofs as evidence |
| Security Team verifying audit integrity | Immudb, QLDB, Splunk | Direct use case |
| Legal/Regulatory requiring tamper-proof records | Custom solutions, paper trails | Direct use case |
| Third-party auditor needing independent verification | Manual review, attestation | Verifier release + proof bundles |

---

## Limitations to Acknowledge

- AI Receipts does not provide real-time monitoring or dashboards (observability gap)
- No built-in bias detection or fairness metrics (governance gap)
- Single-operator model limits multi-tenant enterprise deployment
- No managed SaaS offering (self-hosted only)
- LLM sensor observations are descriptive, not evaluative (by design)

These are deliberate scope boundaries, not accidental omissions. See
[NON_GOALS.md](NON_GOALS.md) for the full boundaries document.
