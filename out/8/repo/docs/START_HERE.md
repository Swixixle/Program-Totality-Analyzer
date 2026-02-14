# AI Receipts: Start Here

**90-Second Overview**: AI Receipts provides cryptographic proof that AI conversation transcripts have not been tampered with. It does not claim truth about what the AI said -- only that the record is intact.

## What This System Proves

1. **Hash chain integrity** -- Every audit event is SHA-256 chained to its predecessor, making silent modification detectable.
2. **Checkpoint signatures** -- Ed25519 signed checkpoints anchor the chain at intervals, binding it to a verifiable key.
3. **Tamper detection** -- Any change to any event breaks the chain from that point forward.
4. **Offline verification** -- A standalone verifier replays the chain without database access.

## What This System Does NOT Prove

- Whether the AI output is factually correct
- Whether the conversation actually happened as described
- Whether the participants are who they claim to be

See [WHAT_THIS_PROVES.md](./WHAT_THIS_PROVES.md) for the full epistemology.

## Pilot Packet (send this to a reviewer)

| Document | Audience | What it covers |
|----------|----------|---------------|
| [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md) | Non-technical (GC, CMO, investor) | 2-page overview of what/why/how |
| [OBJECTIONS_AND_PRECISE_ANSWERS.md](./OBJECTIONS_AND_PRECISE_ANSWERS.md) | GC, CMO, CISO | Predictable questions with precise answers |
| [REGULATORY_MATRIX_EXCERPT.md](./REGULATORY_MATRIX_EXCERPT.md) | Compliance officer | 10-row quick scan across 6 frameworks |
| [PROOF_BUNDLE.md](./PROOF_BUNDLE.md) | Technical reviewer / auditor | Bundle spec: what files exist, what each proves |
| [PILOT_RUNBOOK.md](./PILOT_RUNBOOK.md) | Technical operator | Step-by-step from clone to verified proof |
| Verifier release ZIP | Anyone | Self-contained verifier + public key + README |
| Proof bundle ZIP | Anyone | End-to-end evidence artifact from CI |

## Reading Order (Technical Deep-Dive)

| # | Document | What you learn |
|---|----------|----------------|
| 1 | **This file** | System purpose and reading map |
| 2 | [WHAT_THIS_PROVES.md](./WHAT_THIS_PROVES.md) | Epistemological boundaries |
| 3 | [FORENSIC_EXPORT_PACK.md](./FORENSIC_EXPORT_PACK.md) | Pack format, fields, verification steps |
| 4 | [PROOF_BUNDLE.md](./PROOF_BUNDLE.md) | Bundle spec: files, expected outputs, failure meanings |
| 5 | [THREAT_MODEL.md](./THREAT_MODEL.md) | Attack vectors, mitigations, key custody, external anchoring |
| 6 | [CRYPTO_AGILITY.md](./CRYPTO_AGILITY.md) | Signature abstraction and PQC roadmap |
| 7 | [REGULATORY_ALIGNMENT.md](./REGULATORY_ALIGNMENT.md) | Full regulatory mapping (21 CFR 11, HIPAA, SOC 2, EU AI Act) |
| 8 | [API_CONTRACTS.md](./API_CONTRACTS.md) | REST endpoints and request/response schemas |
| 9 | [RATE_LIMIT_POLICY.md](./RATE_LIMIT_POLICY.md) | Per-IP burst and sustained limits |
| 10 | [KILL_SWITCH.md](./KILL_SWITCH.md) | Irreversible interpretation disablement |
| 11 | [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) | Current gaps and planned work |
| 12 | [NON_GOALS.md](./NON_GOALS.md) | What this system explicitly does NOT do |
| 13 | [COMPETITIVE_COMPARISON.md](./COMPETITIVE_COMPARISON.md) | Positioning vs. observability, audit, and governance tools |
| 14 | [EXTERNAL_ANCHORING.md](./EXTERNAL_ANCHORING.md) | What anchoring prevents/doesn't, threat delta, IAM policy |
| 15 | [PILOT_SETUP_AWS_ANCHOR_ACCOUNT.md](./PILOT_SETUP_AWS_ANCHOR_ACCOUNT.md) | AWS S3 Object Lock setup for anchoring |
| 16 | [TSA_PROVIDERS.md](./TSA_PROVIDERS.md) | RFC3161 TSA provider configs and fingerprint pinning |
| 17 | [OBJECTIONS_AND_PRECISE_ANSWERS.md](./OBJECTIONS_AND_PRECISE_ANSWERS.md) | Stakeholder Q&A one-pager |
| 18 | [PILOT_RUNBOOK.md](./PILOT_RUNBOOK.md) | End-to-end pilot flow |

## Key Scripts

| Script | Purpose |
|--------|---------|
| `scripts/proof_run.ts` | End-to-end proof generation: tests, events, checkpoints, export, verify |
| `scripts/export_forensic_pack.ts` | Export audit trail as verifiable JSON pack |
| `scripts/verify_forensic_pack.ts` | Offline hash chain + checkpoint verifier (supports key ring) |
| `scripts/build_verifier_release.ts` | Package standalone verifier into release zip |
| `scripts/anchor_smoke.ts` | Anchor backend smoke test (S3/TSA/log-only) |
| `scripts/tsa_smoke.ts` | RFC3161 TSA-specific smoke test |

## Verifying a Pack

```bash
# Hash chain only
npx tsx scripts/verify_forensic_pack.ts pack.json

# With Ed25519 signature verification (single key)
npx tsx scripts/verify_forensic_pack.ts pack.json --public-key checkpoint_public.pem

# With key ring (supports rotated keys)
npx tsx scripts/verify_forensic_pack.ts pack.json --key-ring keys/
```

## Architecture at a Glance

```
Receipt --> Verify (SHA-256) --> Immutable Lock
                                      |
                               Audit Event (chained)
                                      |
                               Checkpoint (Ed25519 signed, kid-tagged)
                                      |
                         +------------+------------+
                         |                         |
                  Forensic Pack              External Anchor
             (offline-verifiable)          (S3 WORM / RFC 3161)
```

## Release Process

Tags (`vX.Y.Z`) trigger the release workflow which:

1. Runs full test suite + typecheck + drift guards
2. Generates proof bundle (evidence artifact)
3. Builds verifier release zip (compiled JS + public key)
4. Computes SHA-256 checksums for all artifacts
5. Creates GitHub Release with all artifacts attached
