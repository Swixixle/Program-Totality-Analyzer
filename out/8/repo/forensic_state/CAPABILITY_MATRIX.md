# Capability Matrix

This prevents reviewers from hallucinating features.

| Capability | Implemented | Phase | Notes |
|-----------|-------------|-------|-------|
| Hash verification | YES | P0 | Deterministic SHA-256, c14n-v1 canonicalization |
| Signature verification | YES | P2 | Ed25519 only, key registry |
| Chain verification | YES | P2 | GENESIS/LINKED/BROKEN statuses |
| Key governance | YES | P3 | ACTIVE/REVOKED/EXPIRED, valid_from/valid_to |
| Public verification | YES | P3 | Rate-limited, respects TRANSCRIPT_MODE |
| Rate limiting | YES | P4 | Per-IP burst + sustained limits |
| API authentication | YES | P4 | x-api-key header required for private endpoints |
| Kill switch | YES | P0 | Irreversible, blocks all interpretation |
| Interpretation system | YES | P0 | FACT/INTERPRETATION/UNCERTAINTY, append-only |
| Forensic detectors | YES | P0 | Risk keywords, high-entropy, PII heuristics |
| Forensic export | YES | P1 | JSON report with all verification data |
| Research dataset | YES | P5 | Anonymized, aggregatable, consent-based |
| LLM observations | YES | P6 | Sensor mode only, data-isolated |
| Transcript storage | NO | - | Never exported, hidden mode available |
| LLM judgment | NO | - | Explicitly forbidden by design |
| Truth scoring | NO | - | Explicitly forbidden by design |
| Truth arbitration | NO | - | Explicitly forbidden by design |
| Multi-model reconciliation | NO | - | Disagreement displayed without resolution |
| Behavioral interpretation | NO | - | LLMs observe, never interpret |

## Verification Status Logic

| Hash Match | Signature Status | Chain Status | Result |
|------------|-----------------|--------------|--------|
| YES | VALID | GENESIS or LINKED | VERIFIED |
| YES | UNTRUSTED_ISSUER | Any | PARTIALLY_VERIFIED |
| YES | NO_SIGNATURE | Any | PARTIALLY_VERIFIED |
| NO | Any | Any | UNVERIFIED |
| Any | INVALID | Any | UNVERIFIED |
| Any | Any | BROKEN | UNVERIFIED |

## LLM Sensor Constraints

| Constraint | Enforcement |
|-----------|-------------|
| Forbidden words | Rejected with error |
| Hedging required | Auto-prefixed if missing |
| Confidence statement | Mandatory, constant text |
| Limitations array | Mandatory, min 2 items |
| Data isolation | LLM receives only transcript |
| Kill switch | Hides and blocks all observations |
| Research boundary | Observations never in research export |
