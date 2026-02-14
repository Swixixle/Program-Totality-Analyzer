# Cryptographic Agility Plan

Version: 1.0
Last Updated: 2026-02-12

This document describes the cryptographic primitives used by AI Receipts, the abstraction boundaries that enable algorithm migration, and the roadmap for post-quantum cryptography (PQC) readiness.

---

## Current Cryptographic Primitives

| Function | Algorithm | Key Size | Standard | Module |
|----------|-----------|----------|----------|--------|
| Hash chain | SHA-256 | 256-bit | FIPS 180-4 | `server/audit-canon.ts` |
| Checkpoint signing | Ed25519 | 256-bit | RFC 8032 | `server/checkpoint-signer.ts` |
| Canonicalization | c14n-v1 (custom) | N/A | Internal | `server/audit-canon.ts` |
| Receipt verification | SHA-256 | 256-bit | FIPS 180-4 | `server/c14n.ts` |

---

## Abstraction Boundaries

### Hash Function Abstraction

The hash function is isolated in `server/audit-canon.ts`:

```typescript
hashAuditPayload(payload: AuditPayload): string
```

All audit event hashing flows through this single function. To migrate to a new hash algorithm:

1. Add a new `hashAuditPayloadV2()` function using the replacement algorithm
2. Update `payloadV` field to `2` for new events
3. The verifier already dispatches on `payloadV`, so old events remain verifiable
4. Update the offline verifier to support both hash versions

### Signature Algorithm Abstraction

The checkpoint signer in `server/checkpoint-signer.ts` isolates all signing operations:

```typescript
signCheckpoint(payload: string): { signature: string; publicKeyId: string; signatureAlg: string }
verifyCheckpointSignature(payload: string, signature: string, publicKey: string): boolean
```

The `signatureAlg` field is stored per-checkpoint, enabling mixed-algorithm verification. To migrate:

1. Implement a new signer module (e.g., `checkpoint-signer-dilithium.ts`)
2. Set `signatureAlg` to the new algorithm identifier (e.g., `ML-DSA-65`)
3. Update the verifier to dispatch on `signatureAlg`
4. Old checkpoints remain verifiable with their original algorithm

### Canonicalization Versioning

The `payloadV` field on every audit event records which canonicalization version produced the hash:

- `payloadV: 1` uses `auditPayloadV1()` with `stableStringifyStrict`
- Future versions increment `payloadV` and use updated canonicalization

This ensures forward and backward compatibility: old events are always verifiable using their recorded canonicalization version.

---

## Migration Path: SHA-256 to SHA-3

SHA-256 is not known to be vulnerable, but SHA-3 (Keccak) provides algorithmic diversity.

### Steps

1. Add `hashAuditPayloadV2()` using SHA3-256 from Node.js `crypto` module
2. Increment `payloadV` to `2` for new events
3. Update CI golden tests to cover both v1 and v2 payloads
4. Update forensic pack manifest to list both algorithms
5. Update offline verifier to dispatch on `payloadV`

### Compatibility

- Existing chain links remain SHA-256 (payloadV: 1)
- New events use SHA3-256 (payloadV: 2)
- The chain itself is not broken: each event stores its own hash, and `prevHash` references the prior event's hash regardless of algorithm
- Segment verification checks `payloadV` before selecting the hash function

### Timeline

- No immediate action required
- Implement when SHA-256 deprecation guidance is issued by NIST

---

## Migration Path: Ed25519 to Post-Quantum Signatures

NIST standardized ML-DSA (FIPS 204, formerly CRYSTALS-Dilithium) in 2024 as the primary PQC signature scheme.

### Phase 1: Dual-Sign Preparation (Current)

The `signatureAlg` field already supports per-checkpoint algorithm identification. No code changes needed for this phase.

### Phase 2: Hybrid Signing

Implement dual signatures on each checkpoint:

```
signatureAlg: "Ed25519+ML-DSA-65"
signature: base64(Ed25519_sig || ML-DSA-65_sig)
```

Verification succeeds only if both signatures are valid. This provides:
- Backward compatibility (Ed25519 remains trusted)
- Forward security (ML-DSA-65 protects against quantum adversaries)

### Phase 3: PQC-Only Signing

Once confidence in ML-DSA is established:

```
signatureAlg: "ML-DSA-65"
signature: base64(ML-DSA-65_sig)
```

Old checkpoints remain verifiable with their recorded `signatureAlg`.

### Key Size Considerations

| Algorithm | Public Key | Signature | Security Level |
|-----------|-----------|-----------|---------------|
| Ed25519 | 32 bytes | 64 bytes | ~128-bit classical |
| ML-DSA-44 | 1,312 bytes | 2,420 bytes | NIST Level 2 |
| ML-DSA-65 | 1,952 bytes | 3,309 bytes | NIST Level 3 |
| ML-DSA-87 | 2,592 bytes | 4,627 bytes | NIST Level 5 |

Recommendation: ML-DSA-65 (NIST Level 3) balances security and size for checkpoint signing.

### Node.js Support

- Node.js does not yet natively support ML-DSA
- When available in `crypto` module or via `liboqs` bindings, integrate as a drop-in signer
- Monitor: https://github.com/nicktimko/liboqs-node and Node.js crypto roadmap

### Timeline

| Phase | Target | Trigger |
|-------|--------|---------|
| Phase 1 (current) | Complete | Algorithm field already in schema |
| Phase 2 (hybrid) | 2026-2027 | Node.js PQC support or liboqs bindings available |
| Phase 3 (PQC-only) | 2028+ | Industry consensus on ML-DSA maturity |

---

## Hash Chain Integrity Under Algorithm Migration

The hash chain's integrity model supports algorithm transitions because:

1. Each event stores its own `hash` and `payloadV`
2. The `prevHash` field references the prior event's stored hash, not a recomputed value
3. Verification replays use the `payloadV` to select the correct hash function
4. Chain continuity is maintained across algorithm boundaries

This means a chain can contain:
```
Event 1: payloadV=1, hash=SHA-256(...)
Event 2: payloadV=1, hash=SHA-256(...), prevHash=Event1.hash
...
Event N: payloadV=2, hash=SHA3-256(...), prevHash=Event(N-1).hash
```

The transition event (N) uses the new algorithm but its `prevHash` still correctly references the prior event's SHA-256 hash.

---

## Canonicalization Stability

The `stableStringifyStrict` function in `server/audit-canon.ts` is the canonical serializer. It is protected by:

1. **Golden tests**: 35 deterministic test cases in `golden-audit-chain.test.ts`
2. **CI drift guard**: `scripts/ci-canon-drift-guard.sh` detects unauthorized modifications
3. **Payload versioning**: `payloadV` field ensures old events use old canonicalization

Any change to canonicalization logic requires incrementing `payloadV` and adding a new payload builder.

---

## Threat Model Integration

See `docs/THREAT_MODEL.md` for cryptographic threat scenarios including:

- Hash collision attacks against SHA-256
- Key compromise for Ed25519 checkpoint signing
- Quantum computing threats to current primitives

This crypto agility plan addresses the "quantum computing" threat by providing a concrete migration path with no chain-breaking transitions.

---

## References

- NIST FIPS 180-4: Secure Hash Standard (SHA-256)
- NIST FIPS 204: Module-Lattice-Based Digital Signature Standard (ML-DSA)
- RFC 8032: Edwards-Curve Digital Signature Algorithm (Ed25519)
- NIST SP 800-131A Rev. 2: Transitioning the Use of Cryptographic Algorithms
- NIST AI 100-1: AI Risk Management Framework
