# Evidence Pointers

Instead of copying code, this file points to where proof lives.

## Hash Verification (P0)
- `server/routes.ts` - verify pipeline, POST /api/verify
- `samples/valid_capsule.json` - test capsule with matching hash
- `samples/tampered_capsule.json` - test capsule with hash mismatch

## Forensic Detectors (P0)
- `server/routes.ts` - forensics generation in verify pipeline
- Detectors: risk_keywords, high_entropy_patterns, pii_heuristics
- Based on: verified_transcript OR submitted_payload

## Signature Verification (P2)
- `server/key-registry.ts` - Ed25519 key registry
- `server/routes.ts` - signature verification in verify pipeline
- Test keys: test-key-001, test-key-002-rotated, revoked-key-001, expired-key-001

## Chain Verification (P2)
- `server/chain-verification.ts` - chain link verification
- Chain hash formula: SHA256(c14n(capsule_core))
- Fields: expected_previous_hash, observed_previous_hash, link_match

## Key Governance (P3)
- `server/key-registry.ts` - ACTIVE/REVOKED/EXPIRED status
- Fields: valid_from, valid_to, issuer_label, revoked_reason

## Public Verification (P3)
- `GET /api/public/receipts/:id/verify` - shareable verification
- TRANSCRIPT_MODE: full, redacted, hidden
- Never leaks raw transcript in hidden mode

## Rate Limiting & Auth (P4)
- `server/rate-limiter.ts` - per-IP burst + sustained limits
- `server/auth.ts` - API key authentication
- Public: 100/min, Private: 50/min, Burst: 10/sec

## Research Dataset (P5)
- `shared/research-schema.ts` - Zod schemas for research records
- `server/research-builder.ts` - builds anonymized records
- `GET /api/research/export` - anonymized export endpoint

## Privacy Guarantees (P5)
- Research exports exclude: transcripts, receipt_ids, IP addresses, exact timestamps, PII values
- Includes only: categorical outcomes, boolean flags, bucketed statistics

## LLM Integration (P6)
- `shared/llm-observation-schema.ts` - observation schema with constraints
- `server/llm-sensor.ts` - LLM sensor service with data isolation
- Endpoints: POST /observe, GET /observations, POST /observe/multi

## LLM Constraints (P6)
- Language hygiene: forbidden words rejected, hedging enforced
- Data isolation: LLM receives only transcript, never verification data
- Observations separate from interpretations and research records
- Kill switch hides and blocks all observations

## Kill Switch
- `server/routes.ts` - POST /api/receipts/:id/kill
- Irreversible, blocks all interpretation and LLM observation
- Stored in receipts table: hindsightKillSwitch = 1

## P6 Acceptance Gate (Evidence Packet)
- `samples/p6_evidence_packet.md` - Full acceptance gate evidence
- Tests: data isolation, language hygiene, storage isolation, kill switch, multi-model, security
- All 6 test categories passed

## Sample Test Commands
```bash
# Verify a receipt
curl -X POST -H "Content-Type: application/json" -H "x-api-key: dev-test-key-12345" \
  -d @samples/valid_capsule.json http://localhost:5000/api/verify

# Public verification
curl http://localhost:5000/api/public/receipts/{receipt_id}/verify

# Generate LLM observation
curl -X POST -H "Content-Type: application/json" -H "x-api-key: dev-test-key-12345" \
  -d '{"observation_type": "paraphrase"}' \
  http://localhost:5000/api/receipts/{receipt_id}/observe

# Multi-model disagreement
curl -X POST -H "Content-Type: application/json" -H "x-api-key: dev-test-key-12345" \
  -d '{"observation_type": "ambiguity", "model_ids": ["mock-sensor", "mock-sensor"]}' \
  http://localhost:5000/api/receipts/{receipt_id}/observe/multi

# Export research dataset
curl -H "x-api-key: dev-test-key-12345" http://localhost:5000/api/research/export
```
