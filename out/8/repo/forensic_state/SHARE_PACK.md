# AI Receipts Forensic Share Pack

## What This System Is

AI Receipts is a forensic verification system for AI conversation transcripts. It provides cryptographic verification of receipt capsules using SHA-256 hash verification, Ed25519 digital signatures, and receipt chain linking. The system enforces strict separation between verification (cryptographic truth) and interpretation (human/LLM analysis), with LLMs operating in sensor-only mode - observing but never judging truth or validity.

## What It Proves

- **Hash Verification (P0)**: SHA-256 hash of canonicalized transcript matches claimed hash
- **Signature Verification (P2)**: Ed25519 signatures are cryptographically valid
- **Chain Verification (P2)**: Receipt chains are linked via previous_receipt_hash
- **Key Governance (P3)**: Keys have lifecycle status (ACTIVE/REVOKED/EXPIRED) with temporal validity
- **Rate Limiting & Auth (P4)**: API endpoints are protected against abuse
- **Research Privacy (P5)**: Anonymized exports contain NO identifying data
- **LLM Sensor Mode (P6)**: LLMs observe only, never receive verification data, never judge truth

## What It Refuses To Do

- LLMs cannot see verification_status, signature_status, chain_status, or forensics
- LLMs cannot use forbidden words: correct, incorrect, true, false, hallucination, proves, verified, invalid
- Kill switch permanently and irreversibly blocks all interpretation/observation
- Interpretations are append-only (no UPDATE/DELETE)
- Verified receipts are immutable (locked from modification)
- Research exports never contain: raw transcripts, receipt IDs, IP addresses, exact timestamps, PII values

## How to Verify

```bash
# Verify the EVENT_LOG chain integrity
npm run forensic:verify

# Generate current state snapshot
npm run state:snapshot

# Build redacted share pack (fails if forbidden strings detected)
npm run share:build

# Verify a test capsule (replace with synthetic test ID)
curl -X POST -H "Content-Type: application/json" -H "x-api-key: [API_KEY_REDACTED]" \
  -d @samples/valid_capsule.json [DEPLOYMENT_URL_REDACTED]/api/verify

# Public verification (no auth required)
curl [DEPLOYMENT_URL_REDACTED]/api/public/receipts/[RECEIPT_ID]/verify
```

## Evidence Pointers

All paths are relative to project root:

| Phase | Evidence Location |
|-------|-------------------|
| P0 | `samples/valid_capsule.json`, `samples/tampered_capsule.json` |
| P2 | `server/key-registry.ts`, `server/chain-verification.ts` |
| P3 | `server/key-registry.ts` (key governance) |
| P4 | `server/rate-limiter.ts`, `server/auth.ts` |
| P5 | `shared/research-schema.ts`, `server/research-builder.ts` |
| P6 | `samples/p6_evidence_packet.md`, `shared/llm-observation-schema.ts` |
| State | `forensic_state/EVENT_LOG.jsonl` (hash-chained) |
| Manifest | `forensic_state/STATE_MANIFEST.md` |
| Capability | `forensic_state/CAPABILITY_MATRIX.md` |

## Verification Chain

The EVENT_LOG.jsonl is hash-chained:
- Each line contains `prev_line_hash` and `line_hash`
- `line_hash = SHA256(prev_line_hash + canonical(line_without_hash_fields))`
- Run `npm run forensic:verify` to validate the entire chain

## Redaction Policy

This share pack applies automatic redactions (see REDACTION_RULES.md):
- Deployment URLs → `[DEPLOYMENT_URL_REDACTED]`
- IP addresses → `[IP_REDACTED]`
- API keys → `[API_KEY_REDACTED]`
- Non-synthetic receipt IDs → `[RECEIPT_ID_REDACTED]`

## Integrity Guarantee

This folder is designed to be copied and shared without leaking:
- No private keys or seed strings
- No API keys or secrets
- No deployment URLs or IP addresses
- No raw transcript content
- No real receipt IDs (only synthetic test IDs like p0-*, p1-*, etc.)
