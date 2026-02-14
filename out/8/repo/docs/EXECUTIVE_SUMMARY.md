# AI Receipts: Executive Summary

## What It Is

AI Receipts is a forensic verification system that provides cryptographic proof that records of AI conversations have not been tampered with. Think of it as a tamper-evident seal for AI interaction logs.

## The Problem

Organizations using AI assistants (for healthcare, legal, financial decisions) need to prove that the AI's output record is intact -- that nobody changed what the AI said after the fact. This is not about whether the AI was correct; it's about whether the record is trustworthy.

## How It Works

**1. Every action creates a chained record.**  
Each operator action (verify a receipt, add an interpretation, export data) is logged as an audit event. Each event includes a cryptographic hash of the previous event, forming an unbreakable chain. Modify any single record and every subsequent hash mismatches.

**2. Signed checkpoints anchor the chain.**  
At regular intervals, the system creates Ed25519 signed checkpoints -- digital signatures that bind the chain to a verifiable key. These checkpoints are themselves chained, creating a secondary integrity layer.

**3. Offline verification requires no trust.**  
A self-contained verifier (runs on any computer with Node.js) replays the entire chain independently. No database access, no API keys, no network connection required. If the chain is intact, it reports PASS. If any record was modified, it pinpoints the exact location of the tampering.

## What It Proves (and What It Doesn't)

| It Proves | It Does Not Prove |
|-----------|-------------------|
| The record has not been modified since creation | The AI output was factually correct |
| Events occurred in the recorded order | The conversation actually happened |
| Checkpoints were signed by a specific key | The participants are who they claim to be |
| Tampering is detectable and localized | The system is secure against all threats |

## Key Differentiators

- **Self-contained verification**: No vendor lock-in. Download the verifier, run it yourself.
- **Tamper detection, not prevention**: The system doesn't try to prevent tampering (impossible in software). Instead, it makes tampering detectable -- the honest version of the problem.
- **No epistemic overreach**: The system never claims "this AI output is true." It claims "this record is intact." This distinction matters for regulatory compliance.

## Regulatory Relevance

The system maps to requirements in:

- **21 CFR Part 11** (FDA electronic records): Audit trails, integrity, electronic signatures
- **HIPAA**: Data integrity controls for healthcare-adjacent AI
- **SOC 2 Type II**: Security, processing integrity, monitoring
- **EU AI Act**: Traceability, transparency, accountability for AI systems
- **ISO 27001**: Information security management controls

See the [Regulatory Matrix](./REGULATORY_MATRIX_EXCERPT.md) for the 10-row compliance officer quick reference.

## Deliverables

| Artifact | What It Contains |
|----------|-----------------|
| Forensic Pack (JSON) | Complete audit trail with hash chain + signed checkpoints |
| Proof Bundle | End-to-end evidence that the cryptographic machinery works |
| Verifier Release (ZIP) | Standalone offline verifier + public key + README |
| Documentation | Threat model, regulatory alignment, proof bundle spec |

## Contact

For pilot discussions, technical deep-dives, or regulatory alignment reviews, reach out to the project team.
