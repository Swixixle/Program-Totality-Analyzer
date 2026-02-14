# System State Manifest

## Purpose
This folder contains cryptographically and procedurally verifiable
evidence that the system operates as claimed, without revealing IP.

## Guarantees
- No raw transcripts
- No private keys
- No business logic
- No environment secrets

## Last Updated
2026-02-03T07:05:08Z

## Current Phase
P6 - LLM Integration Sensor Mode (ACCEPTED - All Acceptance Gate Tests Passed)

## Enabled Capabilities
- Hash verification (SHA-256, P0)
- Canonicalization (c14n-v1)
- Forensic detectors (risk keywords, high-entropy, PII heuristics)
- Signature verification (Ed25519, P2)
- Chain verification (GENESIS/LINKED/BROKEN, P2)
- Key governance (ACTIVE/REVOKED/EXPIRED, P3)
- Public verification endpoint (P3)
- Rate limiting + API authentication (P4)
- Anonymized research exports (P5)
- LLM observations - sensor mode only (P6)

## Explicit Non-Capabilities
- No LLM judgment of truth/validity
- No scoring or ranking
- No truth arbitration
- No behavioral interpretation by LLMs
- LLMs cannot affect verification_status
- No reconciliation of multi-model disagreement

## Schema Versions
- ai-receipt/1.0 (receipt capsule)
- research-record/1.0 (anonymized research)
- research-dataset/1.0 (export format)
- research-consent/1.0 (consent model)
- llm-observation/1.0 (LLM sensor output)

## Verification Statuses
- VERIFIED: Hash match + VALID signature + (LINKED|GENESIS chain)
- PARTIALLY_VERIFIED: Hash match + (UNTRUSTED_ISSUER|NO_SIGNATURE)
- UNVERIFIED: Hash mismatch OR INVALID signature OR BROKEN chain]
